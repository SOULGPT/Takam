import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { 
  Canvas, 
  Path, 
  Skia, 
  useComputedValue, 
  useClockValue,
  rect,
  Group,
  BlendMode
} from '@shopify/react-native-skia';

interface OrganicBlobMaskProps {
  children: React.ReactNode;
  width: number;
  height: number;
}

export const OrganicBlobMask: React.FC<OrganicBlobMaskProps> = ({ children, width, height }) => {
  const clock = useClockValue();

  // ── Undulating Blob Path Logic ─────────────────────────────────────────────
  const blobPath = useComputedValue(() => {
    const t = clock.current / 2000;
    const path = Skia.Path.Make();
    
    const center = { x: width / 2, y: height / 2 };
    const radius = Math.min(width, height) * 0.42;

    // We create 8 points and move them slightly with Sin/Cos
    const points = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const offset = Math.sin(t + i) * 15; // The "undulation" factor
      const r = radius + offset;
      points.push({
        x: center.x + Math.cos(angle) * r,
        y: center.y + Math.sin(angle) * r,
      });
    }

    path.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      path.quadTo(p1.x, p1.y, midX, midY);
    }
    path.close();
    return path;
  }, [clock]);

  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      {/* The RTCView or Video goes here */}
      <View style={StyleSheet.absoluteFill}>
        {children}
      </View>

      {/* The Skia Overlay (The Stencil) */}
      <Canvas style={StyleSheet.absoluteFill}>
        <Group>
          {/* 1. Fill the whole screen with Deep Plum */}
          <Path 
            path={Skia.Path.MakeFromRect(rect(0, 0, width, height))} 
            color="#2D1F1A" 
          />
          {/* 2. Cut a "Hole" with the Undulating Blob */}
          <Path 
            path={blobPath} 
            blendMode={BlendMode.Clear}
          />
        </Group>
      </Canvas>
    </View>
  );
};
