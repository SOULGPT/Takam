import React, { useMemo } from 'react';
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

// ── Liquid Mesh Shader (SkSL) ────────────────────────────────────────────────
// A shimmering, luxury aura shader with Deep Plum, Terracotta, and Gold highlights.
const source = Skia.RuntimeEffect.Make(`
  uniform float time;
  uniform vec2 resolution;

  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  half4 main(vec2 fragCoord) {
    vec2 uv = fragCoord / resolution;
    
    // Create organic movement using multi-frequency sine waves
    float noise = sin(uv.x * 3.0 + time * 0.5) * cos(uv.y * 2.0 - time * 0.3);
    noise += sin(uv.y * 1.5 + time * 0.4) * 0.5;
    
    // Luxury Palette Colors (Deep Plum, Terracotta, Gold)
    vec3 deepPlum = vec3(0.176, 0.122, 0.102); // #2D1F1A
    vec3 terracotta = vec3(0.769, 0.478, 0.322); // #C47A52
    vec3 gold = vec3(0.851, 0.737, 0.541); // #D9BC8A
    
    // Blending based on noise and coordinates
    float blend1 = smoothstep(-1.0, 1.0, noise + sin(time * 0.2));
    float blend2 = smoothstep(0.0, 1.0, uv.y + noise * 0.3);
    
    vec3 color = mix(deepPlum, terracotta, blend1 * 0.6);
    color = mix(color, gold, blend2 * 0.2 * (0.5 + 0.5 * sin(time * 0.7)));
    
    // Subtle animated grain (vignette + shimmer)
    float vignette = 1.0 - length(uv - 0.5) * 1.2;
    color *= clamp(vignette, 0.8, 1.0);
    
    return half4(color, 1.0);
  }
`)!;

export const AuraAnimation: React.FC = () => {
  const clock = useSharedValue(0);

  React.useEffect(() => {
    clock.value = withRepeat(
      withTiming(1, { duration: 20000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const uniforms = useDerivedValue(() => {
    return {
      time: clock.value * 20,
      resolution: [width, height],
    };
  }, [clock]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Fill>
          <Shader source={source} uniforms={uniforms} />
        </Fill>
      </Canvas>
    </View>
  );
};
