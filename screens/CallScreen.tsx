import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { RTCView } from 'react-native-webrtc';
import { Ionicons } from '@expo/vector-icons';
import { useCallStore } from '../store/useCallStore';
import { useWebRTC } from '../hooks/useWebRTC';
import { OrganicBlobMask } from '../components/Call/OrganicBlobMask';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function CallScreen() {
  const { status, localStream, remoteStream } = useCallStore();
  const { endCall } = useWebRTC();
  const [showStatus, setShowStatus] = useState(false);

  useEffect(() => {
    if (status === 'connected' && !remoteStream) {
      setShowStatus(true);
    } else {
      setShowStatus(false);
    }
  }, [status, remoteStream]);

  if (status === 'idle') return null;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#2D1F1A', '#1A0F09']} style={StyleSheet.absoluteFill} />
      
      {/* ── Parchment Texture Overlay (Subtle) ────────────────────────────────── */}
      <View style={[styles.parchment, { opacity: 0.05, backgroundColor: '#F5F0E8' }]} pointerEvents="none" />

      {/* ── Remote Stream (Large Floating Blob) ───────────────────────────────── */}
      <View style={styles.remoteContainer}>
        {remoteStream ? (
          <OrganicBlobMask width={width} height={height * 0.7}>
            <RTCView
              streamURL={remoteStream.toURL()}
              style={styles.fullVideo}
              objectFit="cover"
            />
          </OrganicBlobMask>
        ) : (
          <View style={styles.placeholder}>
             <Text style={styles.placeholderText}>
               {showStatus ? "The connection is fading..." : "Initiating Sanctuary..."}
             </Text>
          </View>
        )}
      </View>

      {/* ── Local Stream (Small PIP Blob) ─────────────────────────────────────── */}
      <View style={styles.localContainer}>
        {localStream && (
          <OrganicBlobMask width={140} height={180}>
            <RTCView
              streamURL={localStream.toURL()}
              style={styles.fullVideo}
              objectFit="cover"
              zOrder={1}
            />
          </OrganicBlobMask>
        )}
      </View>

      {/* ── Minimalist Controls ────────────────────────────────────────────────── */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlBtn}>
           <Ionicons name="mic-off-outline" size={24} color="#F5ECD7" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.endBtn} onPress={endCall}>
           <Text style={styles.endBtnText}>CLOSE CONNECTION</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlBtn}>
           <Ionicons name="camera-reverse-outline" size={24} color="#F5ECD7" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2D1F1A' },
  parchment: { ...StyleSheet.absoluteFillObject, zIndex: 10 },
  remoteContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  localContainer: { position: 'absolute', bottom: 120, right: 20 },
  fullVideo: { width: '100%', height: '100%' },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  placeholderText: { color: '#B5947A', fontSize: 18, fontFamily: 'CormorantGaramond_400Regular', fontStyle: 'italic' },
  controls: { 
    position: 'absolute', 
    bottom: 40, 
    left: 0, 
    right: 0, 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center',
    gap: 30,
    paddingHorizontal: 20
  },
  controlBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  endBtn: { 
    backgroundColor: '#C47A52', 
    paddingHorizontal: 24, 
    paddingVertical: 14, 
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  endBtnText: { color: '#F5ECD7', fontWeight: '800', fontSize: 13, letterSpacing: 1.5 },
});
