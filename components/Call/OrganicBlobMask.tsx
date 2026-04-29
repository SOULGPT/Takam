import { StyleSheet, View } from 'react-native';
import { 
  Canvas, 
  Path, 
  Skia, 
  rect,
  Group,
  Blur,
} from '@shopify/react-native-skia';
import { useSharedValue, useDerivedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import React, { useEffect } from 'react';

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
      -1,
      true
    );
  }, []);

  const blobPath = useDerivedValue(() => {
    const t = clock.value * 2 * Math.PI;
    const path = Skia.Path.Make();
    
    const center = { x: width / 2, y: height / 2 };
    const baseRadius = Math.min(width, height) * 0.45;
    const pointsCount = 10; 

    const points = [];
    for (let i = 0; i < pointsCount; i++) {
      const angle = (i / pointsCount) * Math.PI * 2;
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
      <View style={StyleSheet.absoluteFill}>
        {children}
      </View>
      <Canvas style={StyleSheet.absoluteFill}>
        <Group>
          <Path 
            path={Skia.Path.Make().addRect(rect(0, 0, width, height))} 
            color="#2D1F1A" 
          />
          <Path 
            path={blobPath} 
            blendMode="clear"
          />
        </Group>
      </Canvas>
    </View>
  );
};
