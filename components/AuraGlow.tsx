import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Dimensions, View } from 'react-native';
import { Canvas, Circle, Blur, Group, vec } from '@shopify/react-native-skia';
import Animated, { 
  useSharedValue, 
  useAnimatedProps, 
  withRepeat, 
  withTiming, 
  withDelay, 
  Easing,
  interpolateColor
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

// Editorial Palette (Nature Profiles)
export const NATURE_COLORS = {
  terracotta: '#C9705A',
  sage:       '#A6C5AD',
  ciel:       '#A5C7D9',
  ochre:      '#D4A017',
  sand:       '#EDD9B8',
};

interface AuraGlowProps {
  partnerNature?: keyof typeof NATURE_COLORS;
  myNature?: keyof typeof NATURE_COLORS;
  isActive: boolean;
}

export default function AuraGlow({ partnerNature = 'sage', myNature = 'terracotta', isActive }: AuraGlowProps) {
  const colorA = NATURE_COLORS[myNature] || NATURE_COLORS.terracotta;
  const colorB = NATURE_COLORS[partnerNature] || NATURE_COLORS.sage;

  // Shared values for movement
  const progress = useSharedValue(0);

  useEffect(() => {
    if (isActive) {
      progress.value = withRepeat(
        withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      );
    } else {
      progress.value = withTiming(0);
    }
  }, [isActive]);

  // Derived positions for organic movement
  const blob1X = useSharedValue(width / 2);
  const blob1Y = useSharedValue(0);
  const blob2X = useSharedValue(width / 2);
  const blob2Y = useSharedValue(0);

  useEffect(() => {
    if (isActive) {
      blob1X.value = withRepeat(withTiming(width * 0.7, { duration: 3500 }), -1, true);
      blob1Y.value = withRepeat(withTiming(height * 0.15, { duration: 4200 }), -1, true);
      blob2X.value = withRepeat(withTiming(width * 0.3, { duration: 3800 }), -1, true);
      blob2Y.value = withRepeat(withTiming(height * 0.1, { duration: 4500 }), -1, true);
    }
  }, [isActive]);

  if (!isActive) return null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
      <Canvas style={styles.canvas}>
        <Group>
          {/* Main Aura Glow (Center Top) */}
          <Circle cx={blob1X} cy={blob1Y} r={width * 0.8} color={colorA}>
            <Blur blur={60} />
          </Circle>
          
          {/* Secondary Aura Glow (Blending) */}
          <Circle cx={blob2X} cy={blob2Y} r={width * 0.9} color={colorB}>
            <Blur blur={80} />
          </Circle>

          {/* Core Handshake Glow (High Intensity) */}
          <Circle cx={width / 2} cy={0} r={width * 0.4} color="#FFFFFF">
            <Blur blur={100} />
          </Circle>
        </Group>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
  },
  overlay: {
    pointerEvents: 'none',
  },
});
