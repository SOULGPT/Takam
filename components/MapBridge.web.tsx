import React from 'react';
import { View, Text, StyleSheet, ImageBackground, Platform } from 'react-native';

// For the Web, we use a beautiful placeholder to avoid native bundler errors
// until a full Google Maps JS implementation is requested.

interface MapBridgeProps {
  marks: any[];
  pendingMark: any;
  selectedCategory: string | null;
  vintageMapStyle: any;
  onLongPress?: (e: any) => void;
}

const MapBridge = React.forwardRef<any, MapBridgeProps>((props, ref) => {
  const { marks, pendingMark, selectedCategory, onLongPress } = props;

  return (
    <View style={styles.webPlaceholder}>
      <ImageBackground 
        source={{ uri: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?q=80&w=2000' }} 
        style={styles.mapTexture}
        imageStyle={{ opacity: 0.2, filter: 'sepia(1) contrast(0.8)' } as any}
      >
        <View style={styles.overlay}>
          <Text style={styles.webTag}>BRIDGE MODULE • WEB PREVIEW</Text>
          <Text style={styles.webTitle}>The map experience is optimized for mobile.</Text>
          <Text style={styles.webSub}>Interactive markers and real-time syncing are active in the iOS/Android app.</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{marks.length}</Text>
              <Text style={styles.statLabel}>Shared Marks</Text>
            </View>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
});

const styles = StyleSheet.create({
  webPlaceholder: {
    flex: 1,
    backgroundColor: '#F5F1E8',
  },
  mapTexture: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    padding: 40,
    backgroundColor: 'rgba(245, 241, 232, 0.9)',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#C9705A',
    maxWidth: 500,
    alignItems: 'center',
  },
  webTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#C9705A',
    letterSpacing: 2,
    marginBottom: 16,
  },
  webTitle: {
    fontSize: 28,
    fontFamily: Platform.OS === 'web' ? 'serif' : undefined,
    color: '#3D2B1F',
    textAlign: 'center',
    marginBottom: 12,
  },
  webSub: {
    fontSize: 14,
    color: '#8C6246',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  statsRow: {
    flexDirection: 'row',
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#C9705A',
    textTransform: 'uppercase',
  },
});

export default MapBridge;
