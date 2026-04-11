import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  Platform 
} from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming, 
  interpolate 
} from 'react-native-reanimated';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { shadow } from '../../lib/theme/shadows';
import * as Haptics from 'expo-haptics';

interface CalendarFABProps {
  onAction: (action: 'Event' | 'Flight' | 'Sleep' | 'Work') => void;
}

const ACTIONS = [
  { id: 'Flight', icon: 'airplane', label: 'Add Flight', color: '#4A90E2' },
  { id: 'Event', icon: 'calendar', label: 'Add Date', color: '#C9705A' },
  { id: 'Sleep', icon: 'moon', label: 'Set Availability', color: '#8C6246' },
];

export default function CalendarFAB({ onAction }: CalendarFABProps) {
  const [isOpen, setIsOpen] = useState(false);
  const animation = useSharedValue(0);

  const toggleMenu = () => {
    const nextValue = isOpen ? 0 : 1;
    animation.value = withSpring(nextValue, { damping: 15, stiffness: 100 });
    setIsOpen(!isOpen);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const mainButtonStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(animation.value, [0, 1], [0, 135])}deg` }],
  }));

  const menuStyle = useAnimatedStyle(() => ({
    opacity: animation.value,
    transform: [{ scale: animation.value }, { translateY: interpolate(animation.value, [0, 1], [0, -10]) }],
    pointerEvents: animation.value > 0.5 ? 'auto' : 'none',
  }));

  return (
    <View style={styles.container}>
      {/* Expanding Menu */}
      <Animated.View style={[styles.menu, menuStyle]}>
        {ACTIONS.map((action, index) => (
          <TouchableOpacity 
            key={action.id} 
            style={styles.actionItem} 
            onPress={() => {
              toggleMenu();
              onAction(action.id as any);
            }}
          >
            <View style={[styles.actionIconBox, { backgroundColor: action.color }]}>
               <Ionicons name={action.icon as any} size={20} color="#FFF" />
            </View>
            <View style={styles.actionLabel}>
              <Text style={styles.actionLabelText}>{action.label}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </Animated.View>

      {/* Main Toggle Button */}
      <TouchableOpacity 
        style={styles.fab} 
        activeOpacity={0.9} 
        onPress={toggleMenu}
      >
        <Animated.View style={mainButtonStyle}>
          <Ionicons name="add" size={32} color="#FFF" />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    alignItems: 'flex-end',
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#C9705A',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        ...shadow('#C9705A', { width: 0, height: 8 }, 0.4, 12, 6),
      },
      android: {
        elevation: 10,
      },
      web: {
        boxShadow: '0 8px 12px rgba(201, 112, 90, 0.4)',
      },
    }),
  },
  menu: {
    marginBottom: 16,
    gap: 12,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  actionIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow('#000', { width: 0, height: 4 }, 0.1, 8, 4),
  },
  actionLabel: {
    backgroundColor: '#3D2B1F',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    position: 'absolute',
    right: 60,
  },
  actionLabelText: {
    color: '#FDFAF4',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  }
});
