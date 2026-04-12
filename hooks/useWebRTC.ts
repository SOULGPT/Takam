import { useEffect, useRef, useCallback } from 'react';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';
import { supabase } from '../lib/supabase';
import { useCallStore } from '../store/useCallStore';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:PLACEHOLDER_TURN_URL',
      username: 'PLACEHOLDER_USERNAME',
      credential: 'PLACEHOLDER_PASSWORD',
    },
  ],
};

const MEDIA_CONSTRAINTS = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: {
    width: { exact: 1920 },
    height: { exact: 1080 },
    frameRate: { exact: 30 },
    facingMode: 'user',
  },
};

export function useWebRTC() {
  const { 
    status, 
    activeBondId, 
    isInitiator, 
    setLocalStream, 
    setRemoteStream, 
    setCallStatus,
    resetCall 
  } = useCallStore();
  
  const pc = useRef<RTCPeerConnection | null>(null);
  const channel = useRef<any>(null);

  // ── Helper: Capping Opus Bitrate to 128kbps ─────────────────────────────────
  const capBitrate = (sdp: string) => {
    return sdp.replace(/a=fmtp:111 (.*)/g, 'a=fmtp:111 $1;maxaveragebitrate=128000');
  };

  const cleanup = useCallback(() => {
    pc.current?.close();
    pc.current = null;
    channel.current?.unsubscribe();
    channel.current = null;
  }, []);

  const initPC = useCallback(() => {
    if (pc.current) return pc.current;

    const _pc = new RTCPeerConnection(RTC_CONFIG);

    _pc.onicecandidate = (event) => {
      if (event.candidate && channel.current) {
        channel.current.send({
          type: 'broadcast',
          event: 'ICE_CANDIDATE',
          payload: { candidate: event.candidate },
        });
      }
    };

    _pc.onconnectionstatechange = () => {
      console.log('RTC Connection State:', _pc.connectionState);
      if (_pc.connectionState === 'connected') setCallStatus('connected');
      if (_pc.connectionState === 'failed' || _pc.connectionState === 'disconnected') {
        // Soft failure handled in UI
      }
    };

    _pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    pc.current = _pc;
    return _pc;
  }, [setRemoteStream, setCallStatus]);

  const startMedia = useCallback(async () => {
    try {
      const stream = await mediaDevices.getUserMedia(MEDIA_CONSTRAINTS);
      setLocalStream(stream);
      return stream;
    } catch (e) {
      console.error('Media Access Failed', e);
      return null;
    }
  }, [setLocalStream]);

  // ── Signaling Handshake ───────────────────────────────────────────────────
  useEffect(() => {
    if (!activeBondId) return;

    channel.current = supabase.channel(`call:${activeBondId}`);

    channel.current
      .on('broadcast', { event: 'OFFER' }, async ({ payload }: any) => {
        if (isInitiator) return;
        const _pc = initPC();
        const stream = await startMedia();
        if (stream) stream.getTracks().forEach(t => _pc.addTrack(t, stream));

        await _pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const answer = await _pc.createAnswer();
        await _pc.setLocalDescription(answer);

        channel.current.send({
          type: 'broadcast',
          event: 'ANSWER',
          payload: { sdp: { ...answer, sdp: capBitrate(answer.sdp!) } },
        });
      })
      .on('broadcast', { event: 'ANSWER' }, async ({ payload }: any) => {
        if (!isInitiator || !pc.current) return;
        await pc.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      })
      .on('broadcast', { event: 'ICE_CANDIDATE' }, async ({ payload }: any) => {
        if (!pc.current) return;
        try {
          await pc.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch (e) {}
      })
      .on('broadcast', { event: 'END_CALL' }, () => {
        cleanup();
        resetCall();
      })
      .subscribe();

    return () => {
      // Don't auto-cleanup on unmount if call is active (to support backgrounding)
    };
  }, [activeBondId, isInitiator, initPC, startMedia, cleanup, resetCall]);

  // ── Initiator: Send Offer ─────────────────────────────────────────────────
  useEffect(() => {
    if (status === 'calling' && isInitiator && channel.current) {
      (async () => {
        const _pc = initPC();
        const stream = await startMedia();
        if (stream) stream.getTracks().forEach(t => _pc.addTrack(t, stream));

        const offer = await _pc.createOffer();
        await _pc.setLocalDescription(offer);

        channel.current.send({
          type: 'broadcast',
          event: 'OFFER',
          payload: { sdp: { ...offer, sdp: capBitrate(offer.sdp!) } },
        });
      })();
    }
  }, [status, isInitiator, initPC, startMedia]);

  const endCall = () => {
    if (channel.current) {
      channel.current.send({ type: 'broadcast', event: 'END_CALL', payload: {} });
    }
    cleanup();
    resetCall();
  };

  return { endCall };
}
