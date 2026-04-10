import React from 'react';
import { View, Image, StyleSheet, Text } from 'react-native';
import { AVATARS } from '../utils/avatars';

interface BlobAvatarProps {
  avatarKey?: string;
  size?: number;
  initials?: string;
  color?: string;
  isActive?: boolean;
}

export default function BlobAvatar({ avatarKey, size = 80, initials, color = '#EDD9B8', isActive }: BlobAvatarProps) {
  // Organic blob shape with asymmetric radii for the ring / fallback
  const blobStyle = {
    position: 'absolute' as const,
    width: size + 8,
    height: size + 8,
    borderTopLeftRadius: (size + 8) * 0.38,
    borderTopRightRadius: (size + 8) * 0.62,
    borderBottomRightRadius: (size + 8) * 0.63,
    borderBottomLeftRadius: (size + 8) * 0.37,
    borderWidth: 2,
    borderColor: '#C9705A',
  };

  const hasImage = avatarKey && AVATARS[avatarKey];

  return (
    <View style={[styles.container, { width: size + 8, height: size + 8 }]}>
      {isActive && <View style={blobStyle} />}
      
      <View style={[
        { width: size, height: size, alignItems: 'center', justifyContent: 'center', backgroundColor: color, overflow: 'hidden' },
        hasImage || isActive 
          ? { borderRadius: size / 2 } // Perfect circle if it's an image or active ring surrounds it
          : {  // Flat blob if not active and no image
              borderTopLeftRadius: size * 0.38,
              borderTopRightRadius: size * 0.62,
              borderBottomRightRadius: size * 0.63,
              borderBottomLeftRadius: size * 0.37,
            }
      ]}>
        {hasImage ? (
          <Image source={AVATARS[avatarKey]} style={styles.image} />
        ) : (
          <Text style={[styles.initials, { fontSize: size * 0.35 }]}>{initials}</Text>
        )}
      </View>
      
      {isActive && (
        <View style={styles.activityIndicator}>
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
