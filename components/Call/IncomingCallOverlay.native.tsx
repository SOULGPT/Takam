import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Dimensions } from 'react-native';
import { Canvas, Circle, Group, Blur } from '@shopify/react-native-skia';
import { useSharedValue, useDerivedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useCallStore } from '../../store/useCallStore';
import { audioPulse } from '../../services/AudioPulseService';

const { width, height } = Dimensions.get('window');

export const IncomingCallOverlay = () => {
  const { status, caller, setCallStatus, resetCall } = useCallStore();
  const t = useSharedValue(0);

  useEffect(() => {
    if (status === 'ringing') {
      audioPulse.startPulse();
      t.value = withRepeat(
        withTiming(1, { duration: 800, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      audioPulse.stopPulse();
      t.value = 0;
    }
  }, [status]);

  const auraRadius = useDerivedValue(() => {
    return 100 + t.value * 200;
  });

  const auraOpacity = useDerivedValue(() => {
    return 1 - t.value;
  });

  if (status !== 'ringing') return null;

  return (
    <Modal transparent animationType="fade">
      <View style={styles.container}>
        {/* Animated Aura Background */}
        <Canvas style={StyleSheet.absoluteFill}>
          <Group>
            <Circle cx={width / 2} cy={height / 2 - 50} r={auraRadius} color="#C47A52" opacity={auraOpacity}>
              <Blur blur={20} />
            </Circle>
          </Group>
        </Canvas>

        <View style={styles.content}>
          <View style={styles.logoCircle}>
             <Ionicons name="infinite-outline" size={40} color="#F5ECD7" />
          </View>
          
          <Text style={styles.callingText}>The Sanctuary Awaits</Text>
          <Text style={styles.profileName}>{caller?.display_name || 'Your Partner'}</Text>
          
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btn, styles.decline]} onPress={resetCall}>
               <Ionicons name="close" size={28} color="#F5ECD7" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.btn, styles.accept]} 
              onPress={() => setCallStatus('connected')}
            >
               <Ionicons name="videocam" size={28} color="#F5ECD7" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2D1F1A', justifyContent: 'center', alignItems: 'center' },
  content: { alignItems: 'center', gap: 20 },
  logoCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(196, 122, 82, 0.2)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#C47A52' },
  callingText: { fontSize: 14, color: '#B5947A', fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase' },
  profileName: { fontSize: 32, color: '#F5ECD7', fontWeight: '800', fontFamily: 'CormorantGaramond_700Bold' },
  actions: { flexDirection: 'row', gap: 40, marginTop: 40 },
  btn: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center' },
  decline: { backgroundColor: '#A0412D' },
  accept: { backgroundColor: '#C47A52' },
});
