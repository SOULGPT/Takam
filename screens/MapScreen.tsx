import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  ActivityIndicator,
  TextInput,
  Image,
} from 'react-native';
import { shadow } from '../lib/theme/shadows';
import MapView, { PROVIDER_GOOGLE, Region } from 'react-native-maps';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import Animated, { 
  FadeIn, 
  FadeOut, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming,
  interpolate,
  useSharedValue,
  Easing,
} from 'react-native-reanimated';

import MapBridge from '../components/MapBridge';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { calculateMidpoint, Coordinate } from '../lib/haversine';
import VINTAGE_MAP_STYLE from '../assets/vintage_map_style';

const { width, height } = Dimensions.get('window');

// Categories for the "Ritual"
const CATEGORIES = [
  { id: 'coffee', label: 'Coffee', emoji: '☕', sub: 'Quick meetup' },
  { id: 'dinner', label: 'Dinner', emoji: '🍴', sub: 'Planned date' },
  { id: 'meet',   label: 'Meet',   emoji: '✈️', sub: 'Travel hub' },
  { id: 'stay',   label: 'Stay',   emoji: '🏠', sub: 'Hotel/Home' },
];

export default function MapScreen() {
  const { session, profile, activeBondId, bondMembers } = useStore();
  
  const [region, setRegion] = useState<Region | null>(null);
  const [marks, setMarks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Interaction State
  const [pendingMark, setPendingMark] = useState<Coordinate | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [note, setNote] = useState('');
  
  // Real-time View Sync State
  const [partnerRegion, setPartnerRegion] = useState<Region | null>(null);
  const [isPartnerActive, setIsPartnerActive] = useState(false);
  
  const glow = useSharedValue(0);

  useEffect(() => {
    if (isPartnerActive) {
      glow.value = withRepeat(
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      glow.value = 0;
    }
  }, [isPartnerActive]);

  const animatedGlowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(glow.value, [0, 1], [1, 1.4]) }],
    opacity: interpolate(glow.value, [0, 1], [0.3, 0.1]),
  }));
  
  const mapRef = useRef<MapView>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['40%'], []);

  const partner = activeBondId ? bondMembers[activeBondId] : null;

  // ── 1. INITIAL VIEW: HAVERSINE MIDPOINT ────────────────────────────────────
  useEffect(() => {
    const initMap = async () => {
      let center: Coordinate = { latitude: 0, longitude: 0 };
      
      try {
        // Request Permission
        const { status } = await Location.requestForegroundPermissionsAsync();
        let myLoc = null;
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          myLoc = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          
          // Update profile location (Neural Link)
          await supabase.from('profiles').update({
            last_latitude: myLoc.latitude,
            last_longitude: myLoc.longitude
          }).eq('id', session?.user.id);
        }

        const pLoc = partner ? { latitude: partner.last_latitude, longitude: partner.last_longitude } : null;

        if (myLoc && pLoc && pLoc.latitude) {
          center = calculateMidpoint(myLoc, pLoc as Coordinate);
        } else if (myLoc) {
          center = myLoc;
        } else if (pLoc && pLoc.latitude) {
          center = pLoc as Coordinate;
        }
      } catch (e) {
        console.error('Location init error:', e);
      }

      setRegion({
        latitude: center.latitude,
        longitude: center.longitude,
        latitudeDelta: 10,
        longitudeDelta: 10,
      });
      setLoading(false);
    };

    if (activeBondId) initMap();
  }, [activeBondId]);

  // ── 2. REAL-TIME: MARKS + VIEW SYNC ────────────────────────────────────────
  useEffect(() => {
    if (!activeBondId) return;

    // A. Fetch Marks
    fetchMarks();

    // B. Subscribe to Mark Changes
    const markChannel = supabase.channel('meeting_marks_realtime')
      .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'meeting_marks', 
          filter: `bond_id=eq.${activeBondId}` 
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setMarks(prev => [...prev, payload.new]);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      })
      .subscribe();

    // C. View Sync Broadcast Channel
    const syncChannel = supabase.channel(`map_sync:${activeBondId}`)
      .on('broadcast', { event: 'viewport' }, (payload) => {
        setPartnerRegion(payload.payload.region);
        setIsPartnerActive(true);
        // Reset activity after 5s
        setTimeout(() => setIsPartnerActive(false), 5000);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(markChannel);
      supabase.removeChannel(syncChannel);
    };
  }, [activeBondId]);

  const fetchMarks = async () => {
    const { data } = await supabase.from('meeting_marks').select('*').eq('bond_id', activeBondId);
    if (data) setMarks(data);
  };

  const broadcastViewport = useCallback((newRegion: Region) => {
    if (!activeBondId) return;
    supabase.channel(`map_sync:${activeBondId}`).send({
      type: 'broadcast',
      event: 'viewport',
      payload: { region: newRegion, senderId: session?.user.id }
    });
  }, [activeBondId, session]);

  // ── 3. ACTIONS ─────────────────────────────────────────────────────────────
  const handleLongPress = (e: any) => {
    const coord = e.nativeEvent.coordinate;
    setPendingMark(coord);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    bottomSheetRef.current?.expand();
  };

  const handleSaveMark = async () => {
    if (!pendingMark || !selectedCategory || !activeBondId) return;
    
    const { error } = await supabase.from('meeting_marks').insert({
      bond_id: activeBondId,
      created_by: session?.user.id,
      latitude: pendingMark.latitude,
      longitude: pendingMark.longitude,
      category: selectedCategory,
      label: note,
    });

    if (!error) {
      setPendingMark(null);
      setSelectedCategory(null);
      setNote('');
      bottomSheetRef.current?.close();
    }
  };

  const goToPartner = () => {
    if (partnerRegion && mapRef.current) {
      mapRef.current.animateToRegion(partnerRegion, 1000);
      Haptics.selectionAsync();
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#C9705A" />
        <Text style={styles.loadingText}>Opening the Bridge...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapBridge
        ref={mapRef}
        style={styles.map}
        initialRegion={region as Region}
        vintageMapStyle={VINTAGE_MAP_STYLE}
        marks={marks}
        pendingMark={pendingMark}
        selectedCategory={selectedCategory}
        onLongPress={handleLongPress}
        onRegionChangeComplete={broadcastViewport}
      />

      {/* Subtle Sync Button (Partner Avatar Glows) */}
      {isPartnerActive && partner && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.syncBtnContainer}>
          <TouchableOpacity onPress={goToPartner} style={styles.syncBtn}>
            <Animated.View style={[styles.avatarGlow, animatedGlowStyle]} />
            {partner.avatar_url ? (
              <Image source={{ uri: partner.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarTxt}>{partner.display_name?.[0]}</Text>
              </View>
            )}
            <Text style={styles.syncTxt}>Sync View</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      <View style={styles.header}>
        <Text style={styles.headerTag}>BRIDGE MODULE</Text>
        <Text style={styles.headerTitle}>Shared neural link</Text>
      </View>

      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backgroundStyle={styles.bottomSheetBg}
      >
        <BottomSheetView style={styles.bottomSheetContent}>
          <Text style={styles.ritualLabel}>WHAT ARE WE PLANNING?</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.catBtn, selectedCategory === cat.id && styles.catBtnActive]}
                onPress={() => setSelectedCategory(cat.id)}
              >
                <Text style={styles.catEmoji}>{cat.emoji}</Text>
                <Text style={[styles.catLabel, selectedCategory === cat.id && styles.catLabelActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <TextInput
            style={styles.noteInput}
            placeholder="Add a secret note..."
            placeholderTextColor="#8C6246"
            value={note}
            onChangeText={setNote}
          />

          <TouchableOpacity 
            style={[styles.saveBtn, !selectedCategory && styles.saveBtnDisabled]}
            disabled={!selectedCategory}
            onPress={handleSaveMark}
          >
            <Text style={styles.saveBtnText}>DROP THE MARK</Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F1E8' },
  map: { width: '100%', height: '100%' },
  loading: { flex: 1, backgroundColor: '#F5F1E8', justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, color: '#8C6246', fontWeight: '800', letterSpacing: 1 },
  
  header: { 
    position: 'absolute', 
    top: 60, 
    left: 24, 
    pointerEvents: 'none',
  },
  headerTag: { fontSize: 10, fontWeight: '800', color: '#C9705A', letterSpacing: 2 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#3D2B1F', marginTop: 4 },

  syncBtnContainer: { position: 'absolute', top: 60, right: 24 },
  syncBtn: { 
    backgroundColor: '#FFF', 
    padding: 6, 
    borderRadius: 30, 
    flexDirection: 'row', 
    alignItems: 'center',
    ...shadow('#000', { width: 0, height: 4 }, 0.1, 10, 5)
  },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarPlaceholder: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EDD9B8', justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { color: '#FFF', fontWeight: '800', fontSize: 12 },
  syncTxt: { marginLeft: 8, marginRight: 8, fontSize: 10, fontWeight: '800', color: '#3D2B1F', textTransform: 'uppercase' },
  avatarGlow: {
    position: 'absolute',
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#C9705A',
    opacity: 0.3,
  },

  bottomSheetBg: { backgroundColor: '#F5F1E8' },
  bottomSheetContent: { padding: 32, flex: 1 },
  ritualLabel: { fontSize: 10, fontWeight: '800', color: '#8C6246', letterSpacing: 1.5, marginBottom: 20 },
  categoryGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  catBtn: { alignItems: 'center', width: '22%', paddingVertical: 12, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.03)' },
  catBtnActive: { backgroundColor: '#1A1A1A' },
  catEmoji: { fontSize: 24, marginBottom: 4 },
  catLabel: { fontSize: 10, fontWeight: '800', color: '#3D2B1F' },
  catLabelActive: { color: '#FFF' },
  noteInput: { 
    backgroundColor: 'rgba(0,0,0,0.03)', 
    borderRadius: 16, 
    padding: 16, 
    fontSize: 14, 
    color: '#3D2B1F',
    marginBottom: 24
  },
  saveBtn: { backgroundColor: '#C9705A', paddingVertical: 18, borderRadius: 100, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.3 },
  saveBtnText: { color: '#FFF', fontWeight: '900', fontSize: 12, letterSpacing: 1 },
});
