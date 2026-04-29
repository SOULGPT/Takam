import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform, Animated as RNAnimated, StatusBar } from 'react-native';
import { LiveKitRoom, useTracks, VideoTrack, AudioSession } from '@livekit/react-native';
import { Track } from 'livekit-client';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useCallStore } from '../store/useCallStore';
import { useLiveKit } from '../hooks/useLiveKit';
import { shadow } from '../lib/theme/shadows';
import { OrganicBlobMask } from '../components/Call/OrganicBlobMask';
import { AuraAnimation } from '../components/Call/AuraAnimation';
import { ParchmentGrain } from '../components/Call/ParchmentGrain';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

const { width, height } = Dimensions.get('window');

// ── Heartbeat Asset (Minimal Rhythmic Pulse) ───────────────────────────
const HEARTBEAT_URI = 'https://lbjsqukecleknnynhqxj.supabase.co/storage/v1/object/public/assets/heartbeat_pulse.wav';

function CallContent({ partnerName, initiationFade }: { partnerName: string, initiationFade: RNAnimated.Value }) {
  const tracks = useTracks([Track.Source.Camera]);
  const localTrack = tracks.find((t) => t.participant.isLocal);
  const remoteTrack = tracks.find((t) => !t.participant.isLocal);

  return (
    <View style={styles.content}>
      <View style={styles.remoteWrapper}>
        {remoteTrack ? (
          <OrganicBlobMask width={width * 0.9} height={height * 0.6}>
            <VideoTrack
              trackRef={remoteTrack}
              style={styles.fullVideo}
              objectFit="cover"
            />
          </OrganicBlobMask>
        ) : (
          <RNAnimated.View style={[styles.initiationContainer, { opacity: initiationFade }]}>
            <Text style={styles.garamondText}>Neural Link Establishing...</Text>
            <Text style={styles.partnerName}>{partnerName}</Text>
          </RNAnimated.View>
        )}
      </View>

      <View style={styles.localWrapper}>
        {localTrack && (
          <OrganicBlobMask width={140} height={180}>
            <VideoTrack
              trackRef={localTrack}
              style={styles.fullVideo}
              objectFit="cover"
              zOrder={1}
            />
          </OrganicBlobMask>
        )}
      </View>
    </View>
  );
}

export default function CallScreen() {
  const { status, caller } = useCallStore();
  const { token, url, endCall } = useLiveKit();
  const [initiationFade] = useState(new RNAnimated.Value(1));
  const soundRef = useRef<Audio.Sound | null>(null);

  // Configure Audio Session for LiveKit
  useEffect(() => {
    // 6. Audio Optimization: Hardcode category to playAndRecord with voiceChat
    if (AudioSession) {
      AudioSession.setAppleAudioConfiguration({
        audioCategory: 'playAndRecord',
        audioMode: 'voiceChat',
      });
    }
  }, []);

  // ── Generative Heartbeat Ritual (expo-av + Haptics) ──────────────────
  useEffect(() => {
    let interval: any;
    
    async function setupAudio() {
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: HEARTBEAT_URI },
          { shouldPlay: true, isLooping: true, volume: 0.3 }
        );
        soundRef.current = sound;
      } catch (e) {
        console.warn('Heartbeat audio failed, continuing with haptic ritual only.');
      }
    }

    if (status === 'calling' || status === 'ringing' || (status === 'connected')) {
      setupAudio();
      interval = setInterval(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setTimeout(() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }, 200);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, [status]);

  if (status === 'idle') return null;

  const partnerName = caller?.display_name ?? caller?.username ?? 'The Partner';

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <View style={StyleSheet.absoluteFill}>
        <AuraAnimation />
      </View>
      <ParchmentGrain opacity={0.05} />

      {url && token ? (
        <View style={{ flex: 1 }}>
          <LiveKitRoom
            serverUrl={url}
            token={token}
            connect={true}
            audio={true}
            video={true}
            onDisconnected={() => {
              endCall();
            }}
          >
            <CallContent partnerName={partnerName} initiationFade={initiationFade} />
          </LiveKitRoom>
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.remoteWrapper}>
            <RNAnimated.View style={[styles.initiationContainer, { opacity: initiationFade }]}>
              <Text style={styles.garamondText}>Neural Link Establishing...</Text>
              <Text style={styles.partnerName}>{partnerName}</Text>
            </RNAnimated.View>
          </View>
        </View>
      )}

      <View style={styles.controls}>
        <View style={styles.controlBlurContainer}>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="shield-outline" size={22} color="#C47A52" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.endCallBtn} onPress={endCall}>
            <View style={styles.endCallInner}>
              <Feather name="x" size={24} color="#F5F0E8" />
            </View>
            <Text style={styles.endLabel}>CLOSE SANCTUARY</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="mic-outline" size={22} color="#7A8C7E" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2D1F1A' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  remoteWrapper: {
    width: width,
    height: height * 0.7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  localWrapper: {
    position: 'absolute',
    bottom: 140,
    right: 30,
    ...shadow('#000', { width: 0, height: 10 }, 0.3, 20, 10),
  },
  fullVideo: { width: '100%', height: '100%' },
  initiationContainer: { alignItems: 'center' },
  garamondText: {
    color: '#D9BC8A',
    fontSize: 24,
    fontFamily: 'CormorantGaramond_400Regular_Italic',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.5
  },
  partnerName: {
    color: '#F5F0E8',
    fontSize: 32,
    fontWeight: '300',
    fontFamily: 'CormorantGaramond_700Bold',
    letterSpacing: 2
  },
  controls: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center'
  },
  controlBlurContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(217, 188, 138, 0.1)',
    gap: 40
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  endCallBtn: { alignItems: 'center', gap: 8 },
  endCallInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#C47A52',
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow('#C47A52', { width: 0, height: 4 }, 0.4, 10, 4),
  },
  endLabel: {
    color: '#D9BC8A',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontFamily: 'CormorantGaramond_400Regular_Italic',
    opacity: 0.8
  }
});
