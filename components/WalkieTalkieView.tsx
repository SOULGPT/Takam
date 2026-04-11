import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, DeviceEventEmitter, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { shadow } from '../lib/theme/shadows';

interface WalkieTalkieViewProps {
  partnerName: string;
  onStartTalk: () => void;
  onStopTalk: () => void;
  onBack: () => void;
  status?: string;
}

export default function WalkieTalkieView({ 
  partnerName, 
  onStartTalk, 
  onStopTalk, 
  onBack,
  status = 'Frequency Linked' 
}: WalkieTalkieViewProps) {
  const [isTalking, setIsTalking] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isTalking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 1000, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: Platform.OS !== 'web' }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [isTalking]);

  const handlePressIn = () => {
    setIsTalking(true);
    onStartTalk();
  };

  const handlePressOut = () => {
    setIsTalking(false);
    onStopTalk();
  };

  return (
    <View style={styles.container}>
      {/* Back Button */}
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backIcon}>←</Text>
        <Text style={styles.backText}>BACK TO VIBES</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        {/* Connectivity Status */}
        <View style={styles.statusBox}>
          <Text style={styles.statusLabel}>{status}</Text>
          <View style={styles.partnerTitleRow}>
            <Text style={styles.partnerTitle}>Talking to {partnerName}</Text>
            <View style={styles.activeDot} />
          </View>
        </View>

        {/* The Big Button */}
        <View style={styles.micContainer}>
          <Animated.View style={[
            styles.pulseAura, 
            { transform: [{ scale: pulseAnim }], opacity: isTalking ? 0.4 : 0 }
          ]} />
          
          <TouchableOpacity
            style={styles.micBtn}
            activeOpacity={0.9}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
          >
            <LinearGradient
              colors={['#D97B60', '#C9705A']}
              style={styles.micBtnGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.micIcon}>🎙️</Text>
              <Text style={styles.talkText}>{isTalking ? 'TALKING...' : 'PTT: TALK'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <Text style={styles.hintText}>Push and hold to send message</Text>

        {/* Sliders Mockup */}
        <View style={styles.controls}>
           <View style={styles.sliderGroup}>
              <View style={styles.sliderHeader}>
                <Text style={styles.sliderLabel}>SENSITIVITY</Text>
                <Text style={styles.sliderValue}>75%</Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: '75%', backgroundColor: '#C9705A' }]} />
              </View>
           </View>
           
           <View style={styles.sliderGroup}>
              <View style={styles.sliderHeader}>
                <Text style={styles.sliderLabel}>VOLUME</Text>
                <Text style={styles.sliderValue}>HIGH</Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: '90%', backgroundColor: '#44674D' }]} />
              </View>
           </View>

           <View style={styles.toggleRow}>
              <Text style={styles.toggleText}>Continuous Mode</Text>
              <View style={styles.toggleSwitch}>
                <View style={styles.toggleKnob} />
              </View>
           </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 20,
    alignItems: 'center',
  },
  backBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  backIcon: { fontSize: 18, color: '#8C6246' },
  backText: { fontSize: 10, fontWeight: '800', color: '#8C6246', letterSpacing: 1 },

  content: {
    width: '100%',
    backgroundColor: 'rgba(253, 250, 244, 0.8)',
    borderRadius: 32,
    padding: 32,
    alignItems: 'center',
    ...shadow('#3D2B1F', { width: 0, height: 24 }, 0.08, 48, 12),
  },
  statusBox: {
    alignItems: 'center',
    marginBottom: 40,
  },
  statusLabel: { fontSize: 10, fontWeight: '800', color: '#913523', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  partnerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  partnerTitle: { fontSize: 20, fontWeight: '800', color: '#3D2B1F' },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#C9705A' },

  micContainer: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  pulseAura: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#C9705A',
  },
  micBtn: {
    width: 180,
    height: 180,
    borderRadius: 90,
    overflow: 'hidden',
    ...shadow('#000', { width: 0, height: 10 }, 0.1, 20, 5),
  },
  micBtnGrad: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micIcon: { fontSize: 60, marginBottom: 8 },
  talkText: { fontSize: 14, fontWeight: '900', color: '#FDFAF4', letterSpacing: 1 },

  hintText: { fontSize: 12, color: '#8C6246', opacity: 0.6, fontWeight: '600' },

  controls: {
    width: '100%',
    marginTop: 48,
    gap: 24,
  },
  sliderGroup: { width: '100%', gap: 10 },
  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sliderLabel: { fontSize: 10, fontWeight: '800', color: '#8C6246', letterSpacing: 1 },
  sliderValue: { fontSize: 10, fontWeight: '800', color: '#C9705A' },
  track: { width: '100%', height: 6, backgroundColor: '#EDD9B8', borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(237, 217, 184, 0.3)',
    padding: 16,
    borderRadius: 12,
  },
  toggleText: { fontSize: 14, fontWeight: '800', color: '#3D2B1F' },
  toggleSwitch: { width: 44, height: 24, borderRadius: 12, backgroundColor: '#C9705A', justifyContent: 'center', paddingHorizontal: 4 },
  toggleKnob: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#FDFAF4', alignSelf: 'flex-end' },
});
