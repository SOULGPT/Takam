<<<<<<< HEAD
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useCallStore } from '../store/useCallStore';

const { width } = Dimensions.get('window');

export default function CallScreen() {
  const { status, resetCall } = useCallStore();

  if (status === 'idle') return null;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#2D1F1A', '#1A0F09']} style={StyleSheet.absoluteFill} />
      
      <View style={styles.content}>
        <Ionicons name="videocam-off-outline" size={64} color="#B5947A" />
        <Text style={styles.title}>The Sanctuary Awaits</Text>
        <Text style={styles.message}>
          The Private Sanctuary is an immersive HD experience designed specifically for mobile hardware. 
        </Text>
        <Text style={styles.subMessage}>
          Please open TAKAM on your phone to manifest this bond.
        </Text>

        <TouchableOpacity style={styles.closeBtn} onPress={resetCall}>
          <Text style={styles.closeBtnText}>RETURN TO CHAT</Text>
        </TouchableOpacity>
      </View>
=======
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { RTCView } from '../lib/webrtc';
import { useCallStore } from '../store/useCallStore';
import { useStore } from '../store/useStore';
import { OrganicBlobMask } from '../components/Call/OrganicBlobMask';
import { Heartbeat } from '../components/Call/Heartbeat';
import { BlurView } from 'expo-blur';
import { shadow } from '../lib/theme/shadows';

const { width, height } = Dimensions.get('window');

/**
 * CallScreen
 * The Private Sanctuary. 
 * Implements the Organic Blob Mask, Animated Aura, and Heartbeat Pulse.
 */
export default function CallScreen() {
  const { 
    status, 
    resetCall, 
    localStream, 
    remoteStream, 
    activeBondId, 
    caller, 
    isInitiator,
    setCallStatus 
  } = useCallStore();
  const { bondMembers } = useStore();
  const [isMuted, setIsMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  // Identify partner
  const partnerProfile = activeBondId ? bondMembers[activeBondId] : (caller || null);
  const partnerName = partnerProfile?.display_name || partnerProfile?.username || 'Beloved';

  if (status === 'idle') return null;

  const handleEndCall = () => {
    // In a real app, this would also signal the other peer to hang up
    resetCall();
  };

  const handleAcceptCall = () => {
    setCallStatus('connected');
    // In a real app, this would trigger the WebRTC answer process
  };

  const renderCallControls = () => {
    if (status === 'ringing') {
      return (
        <View style={styles.controlRow}>
          <TouchableOpacity style={[styles.controlBtn, styles.declineBtn]} onPress={handleEndCall}>
            <Ionicons name="close" size={32} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.controlBtn, styles.acceptBtn]} onPress={handleAcceptCall}>
            <Ionicons name="checkmark" size={32} color="#FFF" />
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.controlRow}>
        <TouchableOpacity style={styles.subControlBtn} onPress={() => setIsMuted(!isMuted)}>
          <Ionicons name={isMuted ? "mic-off" : "mic"} size={24} color="#F5ECD7" />
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.controlBtn, styles.endBtn]} onPress={handleEndCall}>
          <MaterialCommunityIcons name="phone-hangup" size={32} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.subControlBtn} onPress={() => setCameraOff(!cameraOff)}>
          <Ionicons name={cameraOff ? "videocam-off" : "videocam"} size={24} color="#F5ECD7" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1A1513', '#2D1F1A', '#1A1513']} style={StyleSheet.absoluteFill} />
      
      {/* Heartbeat Pulse (Tactile Presence) */}
      <Heartbeat isActive={status === 'connected'} />

      {/* Main Experience: The Organic Blob */}
      <View style={styles.experienceContainer}>
        <OrganicBlobMask color={status === 'connected' ? '#C9705A' : '#B5947A'}>
          {status === 'connected' && remoteStream ? (
            <RTCView
              streamURL={remoteStream.toURL()}
              style={styles.fullVideo}
              objectFit="cover"
            />
          ) : (
            <View style={styles.placeholderVideo}>
              <Text style={styles.placeholderEmoji}>
                {status === 'connected' ? '👤' : '🔔'}
              </Text>
              <Text style={styles.placeholderText}>
                {status === 'connected' ? 'Connecting Resonance...' : 'Manifesting Presence...'}
              </Text>
            </View>
          )}
        </OrganicBlobMask>
      </View>

      {/* Self View (Small Blob) */}
      {status === 'connected' && localStream && !cameraOff && (
        <View style={styles.selfViewContainer}>
          <RTCView
            streamURL={localStream.toURL()}
            style={styles.selfVideo}
            objectFit="cover"
          />
        </View>
      )}

      {/* UI Overlay */}
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topInfo}>
          <Text style={styles.statusLabel}>
            {status === 'calling' && 'INVOKING SANCTUARY...'}
            {status === 'ringing' && 'SANCTUARY REQUESTED...'}
            {status === 'connected' && 'IN THE SANCTUARY'}
          </Text>
          <Text style={styles.partnerName}>{partnerName.toUpperCase()}</Text>
        </View>

        <View style={styles.bottomActions}>
          {renderCallControls()}
        </View>
      </View>

      {/* Background Blur for aesthetic depth */}
      <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
>>>>>>> 3a58390 (Initial commit)
    </View>
  );
}

const styles = StyleSheet.create({
<<<<<<< HEAD
  container: { flex: 1, backgroundColor: '#2D1F1A', justifyContent: 'center', alignItems: 'center' },
  content: { 
    alignItems: 'center', 
    padding: 40, 
    maxWidth: 500,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(181, 148, 122, 0.2)'
  },
  title: { 
    color: '#F5ECD7', 
    fontSize: 28, 
    fontFamily: 'CormorantGaramond_700Bold', 
    marginTop: 20 
  },
  message: { 
    color: '#B5947A', 
    fontSize: 18, 
    textAlign: 'center', 
    marginTop: 20,
    lineHeight: 26,
    fontFamily: 'CormorantGaramond_400Regular'
  },
  subMessage: { 
    color: '#8A705E', 
    fontSize: 14, 
    textAlign: 'center', 
    marginTop: 10,
    fontStyle: 'italic'
  },
  closeBtn: { 
    marginTop: 40,
    backgroundColor: '#C47A52', 
    paddingHorizontal: 30, 
    paddingVertical: 15, 
    borderRadius: 30 
  },
  closeBtnText: { color: '#F5ECD7', fontWeight: '800', fontSize: 13, letterSpacing: 1.5 },
=======
  container: { flex: 1, backgroundColor: '#1A1513' },
  experienceContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullVideo: {
    width: '100%',
    height: '100%',
  },
  placeholderVideo: {
    flex: 1,
    backgroundColor: '#1A1513',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  placeholderEmoji: { fontSize: 64, marginBottom: 20 },
  placeholderText: { 
    color: '#F5ECD7', 
    fontSize: 14, 
    fontFamily: 'CormorantGaramond_400Regular_Italic',
    letterSpacing: 1,
    textAlign: 'center'
  },
  selfViewContainer: {
    position: 'absolute',
    bottom: 120,
    right: 24,
    width: 100,
    height: 140,
    borderRadius: 50,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(245, 236, 215, 0.3)',
    backgroundColor: '#000',
  },
  selfVideo: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    paddingTop: 60,
    paddingBottom: 40,
    justifyContent: 'space-between',
    zIndex: 10,
  },
  topInfo: {
    alignItems: 'center',
  },
  statusLabel: {
    color: '#B5947A',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 8,
  },
  partnerName: {
    color: '#F5ECD7',
    fontSize: 22,
    fontFamily: 'CormorantGaramond_700Bold',
    letterSpacing: 3,
  },
  bottomActions: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  controlBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow('#000', { width: 0, height: 4 }, 0.3, 8, 8),
  },
  subControlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 236, 215, 0.2)',
  },
  acceptBtn: { backgroundColor: '#44674D' },
  declineBtn: { backgroundColor: '#A0412D' },
  endBtn: { backgroundColor: '#A0412D' },
  closeBtnText: { color: '#F5ECD7', fontWeight: '800', fontSize: 13 },
>>>>>>> 3a58390 (Initial commit)
});
