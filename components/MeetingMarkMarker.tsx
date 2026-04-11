import React, { useEffect } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { shadow } from '../lib/theme/shadows';
import { Marker } from 'react-native-maps';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  Easing,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';

interface MeetingMarkMarkerProps {
  coordinate: { latitude: number; longitude: number };
  category: 'coffee' | 'dinner' | 'meet' | 'stay' | string;
  onPress: () => void;
}

const CATEGORY_EMOJIS: Record<string, string> = {
  coffee: '☕',
  dinner: '🍴',
  meet: '✈️',
  stay: '🏠',
};

const CATEGORY_COLORS: Record<string, string> = {
  coffee: '#D4A017',
  dinner: '#C9705A',
  meet: '#7A8C7E',
  stay: '#2D1F1A',
};

export default function MeetingMarkMarker({ coordinate, category, onPress }: MeetingMarkMarkerProps) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    // The "Soul" of the feature: Organic, resting heart rate heartbeat (2000ms)
    pulse.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
      -1,
      true
    );
  }, []);

  const animatedPulseStyle = useAnimatedStyle(() => {
    const scale = interpolate(pulse.value, [0, 1], [1, 1.4], Extrapolate.CLAMP);
    const opacity = interpolate(pulse.value, [0, 0.8, 1], [0.3, 0.1, 0], Extrapolate.CLAMP);
    
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  const markerColor = CATEGORY_COLORS[category] || '#C9705A';

  return (
    <Marker coordinate={coordinate} onPress={onPress}>
      <View style={styles.container}>
        {/* The Glowing Beacon Heartbeat */}
        <Animated.View style={[
          styles.pulseRing, 
          { backgroundColor: markerColor },
          animatedPulseStyle
        ]} />
        
        {/* The Mark (Pressed into Paper feel) */}
        <View style={[styles.markContainer, { borderColor: markerColor }]}>
          <Animated.Text style={styles.emoji}>
            {CATEGORY_EMOJIS[category] || '📍'}
          </Animated.Text>
        </View>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 60,
  },
  pulseRing: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  markContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F1E8', // Vintage Paper Color
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    // Shadow for "Pressed into paper" effect
    ...shadow('#000', { width: 0, height: 1 }, 0.1, 2, 3),
  },
  emoji: {
    fontSize: 14,
  },
});
