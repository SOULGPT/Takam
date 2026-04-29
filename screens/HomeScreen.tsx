import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  StatusBar,
  Animated,
  Dimensions,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore, BOND_META } from '../store/useStore';
import { useVibes, sendVibe } from '../hooks/useVibes';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { playSound } from '../lib/sound';
import { shadow } from '../lib/theme/shadows';
import { useAudioRecorder, requestRecordingPermissionsAsync, AudioModule, RecordingPresets } from 'expo-audio';
import { playBurst } from '../lib/walkieTalkie';

const { width, height } = Dimensions.get('window');

const VIBES = [
  { id: 'thought', emoji: '🧠', label: 'Thinking of You', color: '#44674D' },
  { id: 'love', emoji: '❤', label: 'Sending Love', color: '#C9705A' },
  { id: 'checkin', emoji: '👋', label: 'Just Checking In', color: '#B5947A' },
];

export default function HomeScreen() {
  const nav = useNavigation<any>();
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const { profile, bonds, bondMembers, activeBondId, setActiveBondId } = useStore();
  const [sending, setSending] = useState<string | null>(null);

  const handleVibeReceived = useCallback(async (vibe: any) => {
    if (vibe.vibe_type === 'walkie_burst' && vibe.content) {
      try { await playBurst(vibe.content); } catch (e) { console.error(e); }
      return;
    }
    playSound(vibe.vibe_type as any);
  }, []);

  useVibes(handleVibeReceived);

  const handleSend = async (type: string) => {
    if (!activeBondId) return;
    setSending(type);
    try {
      await sendVibe(activeBondId, type);
    } catch (e) {
      Alert.alert('Error', 'Failed to send vibe');
    } finally {
      setSending(null);
    }
  };

  const activeBond = bonds.find(b => b.id === activeBondId);
  const partnerProfile = activeBondId ? bondMembers[activeBondId] : null;

  if (!activeBond || !partnerProfile) {
    return (
      <View style={styles.root}>
        <LinearGradient colors={['#FDFAF4', '#F5ECD7']} style={StyleSheet.absoluteFill} />
        <View style={styles.center}>
          <Text style={styles.title}>No Connection Active</Text>
          <TouchableOpacity style={styles.btn} onPress={() => nav.navigate('Connections')}>
            <Text style={styles.btnText}>Go to Connections</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const partnerName = partnerProfile.display_name || partnerProfile.username || 'Partner';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient colors={['#FDFAF4', '#F5ECD7']} style={StyleSheet.absoluteFill} />
      
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.logo}>TAKAM</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.welcome}>Sending to {partnerName}</Text>
          <View style={styles.vibeList}>
            {VIBES.map(v => (
              <TouchableOpacity key={v.id} style={[styles.vibeCard, { backgroundColor: v.color }]} onPress={() => handleSend(v.id)}>
                 <Text style={styles.vibeText}>{v.emoji} {v.label}</Text>
                 {sending === v.id && <ActivityIndicator color="#FFF" style={{ marginLeft: 10 }} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.chatBtn} onPress={() => nav.navigate('Chat')}>
        <Text style={styles.chatBtnText}>Open Chat</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 30, paddingTop: 60 },
  header: { marginBottom: 30 },
  logo: { fontSize: 24, fontWeight: '900', color: '#3D2B1F' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 20 },
  btn: { backgroundColor: '#C9705A', padding: 15, borderRadius: 12 },
  btnText: { color: '#FFF', fontWeight: '700' },
  content: { gap: 20 },
  welcome: { fontSize: 18, color: '#3D2B1F', fontWeight: '600' },
  vibeList: { gap: 12 },
  vibeCard: { padding: 20, borderRadius: 16, flexDirection: 'row', alignItems: 'center' },
  vibeText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  chatBtn: { position: 'absolute', bottom: 30, left: 30, right: 30, backgroundColor: '#FFF', padding: 18, borderRadius: 16, alignItems: 'center', ...shadow('#000', {width:0, height:4}, 0.1, 10, 4) },
  chatBtnText: { color: '#3D2B1F', fontWeight: '800' }
});
