import React, { useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import dayjs from '../../lib/utils/timezone';

interface SyncLineProps {
  topOffset?: number; // Minutes from start of day (0-1440)
  rowHeight?: number; // Height of one hour in pixels
}

export default function SyncLine({ rowHeight = 80 }: SyncLineProps) {
  const translateY = useSharedValue(0);

  const updateLine = () => {
    const now = dayjs();
    const minutes = now.hour() * 60 + now.minute();
    translateY.value = withTiming((minutes / 60) * rowHeight, { duration: 1000 });
  };

  useEffect(() => {
    updateLine();
    const interval = setInterval(updateLine, 60000); // Heartbeat: every minute
    return () => clearInterval(interval);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <View style={styles.line} />
      <View style={styles.dot} />
      <View style={styles.labelContainer}>
        <Text style={styles.labelText}>NOW</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
  },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: '#C9705A',
    opacity: 0.8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#C9705A',
    position: 'absolute',
    left: '50%',
    marginLeft: -4,
  },
  labelContainer: {
    position: 'absolute',
    right: 4,
    backgroundColor: '#C9705A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  labelText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
