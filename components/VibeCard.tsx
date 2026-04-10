import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface VibeCardProps {
  title: string;
  description: string;
  emoji: string;
  color: string;
  onPress: () => void;
  loading?: boolean;
}

export default function VibeCard({ title, description, emoji, color, onPress, loading }: VibeCardProps) {
  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={onPress} 
      activeOpacity={0.8}
      disabled={loading}
    >
      <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
        <Text style={styles.emoji}>{emoji}</Text>
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <Text style={styles.chevron}>➔</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FDFAF4',
    borderRadius: 24,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#3D2B1F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(217, 188, 138, 0.2)',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  emoji: {
    fontSize: 28,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#3D2B1F',
    marginBottom: 2,
  },
  description: {
    fontSize: 14,
    color: '#8C6246',
    opacity: 0.8,
  },
  chevron: {
    fontSize: 18,
    color: '#D9BC8A',
    marginLeft: 10,
    opacity: 0.5,
  }
});
