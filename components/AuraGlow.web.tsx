import React from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

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
  if (!isActive) return null;

  const colorA = NATURE_COLORS[myNature] || NATURE_COLORS.terracotta;
  const colorB = NATURE_COLORS[partnerNature] || NATURE_COLORS.sage;

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
       <LinearGradient
         colors={[colorA, colorB, 'transparent']}
         style={{ width, height: height * 0.4 }}
         start={{ x: 0.5, y: 0 }}
         end={{ x: 0.5, y: 1 }}
       />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    pointerEvents: 'none',
  },
});
