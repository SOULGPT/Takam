<<<<<<< HEAD
import { StyleSheet, View } from 'react-native';
import { 
  Canvas, 
  Path, 
  Skia, 
  rect,
  Group,
  Blur,
  Shadow,
} from '@shopify/react-native-skia';
import { useSharedValue, useDerivedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import React, { useEffect, useMemo } from 'react';

interface OrganicBlobMaskProps {
  children: React.ReactNode;
  width: number;
  height: number;
}

export const OrganicBlobMask: React.FC<OrganicBlobMaskProps> = ({ children, width, height }) => {
  const clock = useSharedValue(0);

  useEffect(() => {
    clock.value = withRepeat(
      withTiming(1, { duration: 15000, easing: Easing.bezier(0.42, 0, 0.58, 1) }),
=======
import React, { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  Canvas,
  Group,
  Mask,
  Rect,
  Blur,
  Circle,
  Path,
  Skia,
  LinearGradient,
  vec,
} from '@shopify/react-native-skia';
import Animated, {
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  useDerivedValue,
} from 'react-native-reanimated';

/**
 * OrganicBlobMask
 * Creates a shimmering, living mask for the video call experience.
 * Uses HSL-tailored colors and smooth Skia blurs.
 */
export const OrganicBlobMask = ({ 
  children, 
  color = '#C9705A',
  width: propWidth,
  height: propHeight
}: { 
  children: React.ReactNode, 
  color?: string,
  width?: number,
  height?: number
}) => {
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const width = propWidth ?? winWidth;
  const height = propHeight ?? winHeight;
  
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
>>>>>>> 3a58390 (Initial commit)
      -1,
      true
    );
  }, []);

<<<<<<< HEAD
  // ── Undulating Blob Path Logic (Luxury Smoothness) ────────────────────────
  const blobPath = useDerivedValue(() => {
    const t = clock.value * 2 * Math.PI;
    const path = Skia.Path.Make();
    
    const center = { x: width / 2, y: height / 2 };
    const baseRadius = Math.min(width, height) * 0.45;
    const pointsCount = 10; // More points for smoother organic curves

    const points = [];
    for (let i = 0; i < pointsCount; i++) {
      const angle = (i / pointsCount) * Math.PI * 2;
      // Multi-frequency undulation for luxury feel
      const offset = 
        Math.sin(t + i * 1.5) * 12 + 
        Math.cos(t * 0.5 + i * 0.8) * 8;
      
      const r = baseRadius + offset;
      points.push({
        x: center.x + Math.cos(angle) * r,
        y: center.y + Math.sin(angle) * r,
      });
    }

    path.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < points.length; i++) {
      const curr = points[i];
      const next = points[(i + 1) % points.length];
      const midX = (curr.x + next.x) / 2;
      const midY = (curr.y + next.y) / 2;
      path.quadTo(curr.x, curr.y, midX, midY);
    }
    path.close();
    return path;
  }, [clock]);

  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      {/* ── Content Layer (Video/Feed) ────────────────────────────────────────── */}
      <View style={StyleSheet.absoluteFill}>
        {children}
      </View>

      {/* ── Skia Masking Layer (The Hider) ────────────────────────────────────── */}
      <Canvas style={StyleSheet.absoluteFill}>
        <Group>
          {/* 1. The Screen Filler (Deep Plum) */}
          <Path 
            path={Skia.Path.Make().addRect(rect(0, 0, width, height))} 
            color="#2D1F1A" 
          />
          {/* 2. The Transparent "Hole" (The Mask) */}
          <Path 
            path={blobPath} 
            blendMode="clear"
          />
        </Group>

        {/* ── Luxury Shimmer Border (Inner Glow) ─────────────────────────────── */}
        <Group>
           <Path 
             path={blobPath}
             color="rgba(217, 188, 138, 0.3)" // Gold Shimmer #D9BC8A
             style="stroke"
             strokeWidth={3}
           >
             <Blur blur={4} />
           </Path>
        </Group>
      </Canvas>
    </View>
  );
};
=======
  const blobRadius = useDerivedValue(() => {
    return (width * 0.4) + (pulse.value * 20);
  });

  const blurAmount = useDerivedValue(() => {
    return 15 + (pulse.value * 10);
  });

  return (
    <View style={[styles.container, propWidth ? { width: propWidth, height: propHeight, flex: 0 } : null]}>
      <Canvas style={styles.canvas}>
        <Mask
          mode="luminance"
          mask={
            <Group>
              <Circle cx={width / 2} cy={height / 2} r={blobRadius} color="white">
                <Blur blur={blurAmount} />
              </Circle>
            </Group>
          }
        >
          {/* The masked area - we'll use a placeholder gradient for now */}
          <Rect x={0} y={0} width={width} height={height}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(width, height)}
              colors={['#1A1513', color, '#1A1513']}
            />
          </Rect>
        </Mask>
      </Canvas>
      
      {/* Absolute overlay for the actual video content which will be clipped by the parent */}
      <View style={[styles.videoContainer, { 
        width: width * 0.85, 
        height: width * 0.85, 
        borderRadius: width * 0.4,
        top: (height / 2) - (width * 0.425),
        left: (width / 2) - (width * 0.425),
      }]}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1513',
  },
  canvas: {
    flex: 1,
  },
  videoContainer: {
    position: 'absolute',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  }
});
>>>>>>> 3a58390 (Initial commit)
