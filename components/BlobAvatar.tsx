import React from 'react';
import { View, Image, StyleSheet, Text } from 'react-native';

interface BlobAvatarProps {
  uri?: string;
  size?: number;
  initials?: string;
  color?: string;
  isActive?: boolean;
}

export default function BlobAvatar({ uri, size = 80, initials, color = '#EDD9B8', isActive }: BlobAvatarProps) {
  const borderRadiusBase = size / 2;
  
  // Approximating the organic blob shape with asymmetric radii
  const blobStyle = {
    width: size,
    height: size,
    borderTopLeftRadius: size * 0.38,
    borderTopRightRadius: size * 0.62,
    borderBottomRightRadius: size * 0.63,
    borderBottomLeftRadius: size * 0.37,
    backgroundColor: color,
    overflow: 'hidden' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  };

  return (
    <View style={[styles.container, { width: size + 8, height: size + 8 }]}>
      <View style={[blobStyle, isActive && styles.activeRing]}>
        {uri ? (
          <Image source={{ uri }} style={styles.image} />
        ) : (
          <Text style={[styles.initials, { fontSize: size * 0.35 }]}>{initials}</Text>
        )}
      </View>
      {isActive && (
        <View style={styles.activityIndicator}>
           {/* Visual for graphic_eq / pulse would go here */}
           <View style={styles.miniPulse} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  initials: {
    fontWeight: '800',
    color: '#FDFAF4',
  },
  activeRing: {
    borderWidth: 2,
    borderColor: '#C9705A',
  },
  activityIndicator: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#C9705A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FDFAF4',
  },
  miniPulse: {
    width: 8,
    height: 8,
    backgroundColor: '#FDFAF4',
    borderRadius: 4,
  }
});
