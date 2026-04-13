import React from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import {
  Canvas,
  Fill,
  Shader,
  Skia,
} from '@shopify/react-native-skia';
import {
  useSharedValue,
  useDerivedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

// ── Living Parchment Shader (SkSL) ──────────────────────────────────────────
// A subtle, animated noise shader that simulates living grain on parchment.
const source = Skia.RuntimeEffect.Make(`
  uniform float time;
  uniform vec2 resolution;
  uniform float opacity;

  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  half4 main(vec2 fragCoord) {
    vec2 uv = fragCoord / resolution;
    
    // Create living, breathing grain
    float noise = random(uv + fract(time * 0.01));
    
    // Parchment Color Base (#F5F0E8)
    vec3 parchmentBase = vec3(0.961, 0.941, 0.910);
    
    // Modulate noise to be extremely subtle
    float grain = (noise * 0.1) + 0.95;
    
    return half4(parchmentBase, opacity * grain);
  }
`)!;

export const ParchmentGrain: React.FC<{ opacity?: number }> = ({ opacity }) => {
  const clock = useSharedValue(0);

  React.useEffect(() => {
    clock.value = withRepeat(
      withTiming(1, { duration: 5000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const uniforms = useDerivedValue(() => {
    return {
      time: clock.value * 100,
      resolution: [width, height],
      opacity: opacity ?? 0.05,
    };
  }, [clock]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill}>
        <Fill>
          <Shader source={source} uniforms={uniforms} />
        </Fill>
      </Canvas>
    </View>
  );
};
