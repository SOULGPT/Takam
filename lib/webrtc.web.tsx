import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';

// Shim for RTCView on Web
export const RTCView = (props: any) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && props.streamURL) {
      // On web, if we are passing a stream object (or blob URL), we handle it.
      if (typeof props.streamURL === 'object') {
        videoRef.current.srcObject = props.streamURL;
      } else {
        videoRef.current.src = props.streamURL;
      }
    }
  }, [props.streamURL]);

  return (
    <View style={props.style}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={props.muted}
        style={{
          width: '100%',
          height: '100%',
          objectFit: props.objectFit || 'cover',
          transform: props.mirror ? 'scaleX(-1)' : 'none',
        } as any}
      />
    </View>
  );
};

// Types and Classes Shim
export const MediaStream = typeof window !== 'undefined' ? window.MediaStream : class {} as any;
export const RTCPeerConnection = typeof window !== 'undefined' ? window.RTCPeerConnection : class {} as any;
export const RTCIceCandidate = typeof window !== 'undefined' ? window.RTCIceCandidate : class {} as any;
export const RTCSessionDescription = typeof window !== 'undefined' ? window.RTCSessionDescription : class {} as any;
export const mediaDevices = typeof navigator !== 'undefined' ? navigator.mediaDevices : {
  getUserMedia: async () => { throw new Error('mediaDevices.getUserMedia not available'); },
  enumerateDevices: async () => [],
} as any;

// Add toURL to MediaStream prototype if missing (react-native-webrtc compatibility)
if (typeof MediaStream !== 'undefined' && MediaStream.prototype && !MediaStream.prototype.toURL) {
  (MediaStream.prototype as any).toURL = function() {
    return this; 
  };
}
