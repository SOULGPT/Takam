import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  Dimensions, 
  FlatList,
  Platform,
  ActivityIndicator,
  Image
} from 'react-native';
import { shadow } from '../lib/theme/shadows';
import Animated, { 
  FadeIn, 
  FadeOut, 
  SlideInUp, 
  SlideOutDown, 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring 
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
// @ts-ignore
import { useFonts, CormorantGaramond_700Bold } from '@expo-google-fonts/cormorant-garamond';
import { supabase } from '../lib/supabase';
import { useStore, BondType } from '../store/useStore';
import AuraGlow from './AuraGlow';

const { width, height } = Dimensions.get('window');

const TITLES = [
  { id: 'partner',     label: 'Partner' },
  { id: 'longdistance', label: 'Long Distance Love' },
  { id: 'naturemate',  label: 'Nature Mate' },
  { id: 'vibesoul',    label: 'Vibe Soul' },
  { id: 'auratwin',    label: 'Aura Twin' },
];

const ITEM_HEIGHT = 60;

interface TapBondModalProps {
  pendingBond: { id: string; partnerId: string; partnerName: string; partnerAvatar: string | null } | null;
  onClose: () => void;
}

export default function TapBondModal({ pendingBond, onClose }: TapBondModalProps) {
  const [fontsLoaded] = useFonts({ CormorantGaramond_700Bold });
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isAccepting, setIsAccepting] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  // Progressive haptic pulse scale
  const hapticScale = useSharedValue(1);

  const handleAccept = async () => {
    if (!pendingBond) return;
    setIsAccepting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Switch toPicker
    setShowPicker(true);
    setIsAccepting(false);
  };

  const handleFinalize = async () => {
    if (!pendingBond) return;
    setIsAccepting(true);
    
    const selectedTitle = TITLES[selectedIdx].id;

    try {
      const { error } = await supabase
        .from('bonds')
        .update({ 
          status: 'active', 
          bond_type: 'other' // We map our custom titles to 'other' or expand BondType later
        }) 
        .eq('id', pendingBond.id);

      if (error) throw error;
      
      // Update local store or let subscription handle it
      onClose();
    } catch (e) {
      console.error('Finalize error:', e);
    } finally {
      setIsAccepting(false);
    }
  };

  if (!pendingBond) return null;

  return (
    <Modal visible={!!pendingBond} transparent animationType="none">
      <View style={styles.root}>
        {/* Skia Aura Background */}
        <AuraGlow isActive={true} />
        
        <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="light" />

        <Animated.View 
          entering={FadeIn.duration(1000)} 
          exiting={FadeOut}
          style={styles.container}
        >
          {/* Partner Card */}
          <Animated.View 
            entering={SlideInUp.springify().damping(12)}
            style={styles.card}
          >
            <View style={styles.avatarContainer}>
               {pendingBond.partnerAvatar ? (
                 <Image source={{ uri: pendingBond.partnerAvatar }} style={styles.avatar} />
               ) : (
                 <View style={styles.avatarPlaceholder}>
                   <Text style={styles.avatarInitial}>{pendingBond.partnerName[0]}</Text>
                 </View>
               )}
            </View>

            <Text style={styles.partnerName}>{pendingBond.partnerName}</Text>
            <Text style={styles.tagline}>A sacred frequency detected nearby.</Text>

            {!showPicker ? (
              <View style={styles.actions}>
                <TouchableOpacity 
                  style={styles.acceptBtn} 
                  onPress={handleAccept}
                >
                  <Text style={styles.acceptBtnText}>Accept Connection</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.rejectBtn} onPress={onClose}>
                  <Text style={styles.rejectBtnText}>Decline</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.pickerSection}>
                <Text style={styles.pickerLabel}>Relationship Title</Text>
                
                <View style={styles.wheelContainer}>
                  <FlatList
                    data={TITLES}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={ITEM_HEIGHT}
                    decelerationRate="fast"
                    onMomentumScrollEnd={(e) => {
                      const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
                      setSelectedIdx(idx);
                      Haptics.selectionAsync();
                    }}
                    renderItem={({ item, index }) => (
                      <View style={[styles.wheelItem, { height: ITEM_HEIGHT }]}>
                        <Text style={[
                          styles.wheelText, 
                          selectedIdx === index && styles.wheelTextActive,
                          fontsLoaded && { fontFamily: 'CormorantGaramond_700Bold' }
                        ]}>
                          {item.label}
                        </Text>
                      </View>
                    )}
                    contentContainerStyle={{ paddingVertical: ITEM_HEIGHT }}
                  />
                  {/* Selection Indicator */}
                  <View style={[styles.indicator, { pointerEvents: 'none' }]} />
                </View>

                <TouchableOpacity 
                  style={[styles.acceptBtn, { marginTop: 20 }]} 
                  onPress={handleFinalize}
                >
                  {isAccepting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.acceptBtnText}>Bond Forever</Text>}
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { width: '100%', alignItems: 'center' },
  card: {
    width: width * 0.85,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: 32,
    padding: 32,
    alignItems: 'center',
    ...shadow('#3D2B1F', { width: 0, height: 20 }, 0.1, 40, 10),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    backgroundColor: '#EDD9B8',
    marginBottom: 20,
    ...shadow('#000', { width: 0, height: 0 }, 0.1, 10, 8),
  },
  avatar: { width: '100%', height: '100%' },
  avatarPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 40, fontWeight: '800', color: '#FFF' },
  partnerName: { fontSize: 24, fontWeight: '900', color: '#1A1A1A', marginBottom: 4 },
  tagline: { fontSize: 13, color: '#888', marginBottom: 30, textAlign: 'center' },
  actions: { width: '100%', gap: 12 },
  acceptBtn: {
    width: '100%',
    backgroundColor: '#1A1A1A',
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: 'center',
  },
  acceptBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14, letterSpacing: 1, textTransform: 'uppercase' },
  rejectBtn: { paddingVertical: 12, alignItems: 'center' },
  rejectBtnText: { fontSize: 12, fontWeight: '700', color: '#BBB', textTransform: 'uppercase' },

  pickerSection: { width: '100%', alignItems: 'center' },
  pickerLabel: { fontSize: 10, fontWeight: '800', color: '#BBB', textTransform: 'uppercase', marginBottom: 16, letterSpacing: 2 },
  wheelContainer: { height: ITEM_HEIGHT * 3, width: '100%', overflow: 'hidden' },
  wheelItem: { justifyContent: 'center', alignItems: 'center' },
  wheelText: { fontSize: 22, color: '#CCC' },
  wheelTextActive: { color: '#1A1A1A', fontSize: 28 },
  indicator: {
    position: 'absolute',
    top: ITEM_HEIGHT,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  }
});
