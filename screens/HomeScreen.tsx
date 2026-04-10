import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StatusBar,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore, BOND_META } from '../store/useStore';
import { useVibes, sendVibe } from '../hooks/useVibes';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { playSound } from '../lib/sound';

// New Velvet Pulse Components
import BlobAvatar from '../components/BlobAvatar';
import VibeCard from '../components/VibeCard';
import WalkieTalkieView from '../components/WalkieTalkieView';
import { startRecording, stopRecordingAndUpload, playBurst, requestMicrophonePermission } from '../lib/walkieTalkie';

const { width, height } = Dimensions.get('window');

const VIBES = [
  { 
    id: 'thought', 
    emoji: '🧠', 
    label: 'Thinking of You', 
    sub: 'Send a gentle mental nudge', 
    color: '#44674D' 
  },
  { 
    id: 'love', 
    emoji: '❤', 
    label: 'Sending Love', 
    sub: 'A warm pulse of affection', 
    color: '#C9705A' 
  },
  { 
    id: 'checkin', 
    emoji: '👋', 
    label: 'Just Checking In', 
    sub: 'Saying hi without the noise', 
    color: '#B5947A' 
  },
];

export default function HomeScreen() {
  const nav = useNavigation<any>();
  const { profile, bonds, bondMembers, activeBondId, setActiveBondId } = useStore();
  const [sending, setSending] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [isWalkieActive, setIsWalkieActive] = useState(false);

  
  const [unreadCount, setUnreadCount] = useState(0);

  // ── Vibe Queue State ────────────────────────────────────────────────────────
  const [vibeQueue, setVibeQueue] = useState<any[]>([]);
  const [playingVibe, setPlayingVibe] = useState<any | null>(null);

  // Overlay animations
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const overlayScale   = useRef(new Animated.Value(0.8)).current;

  // 1. Fetch unread messages & vibes on activeBondId change
  useEffect(() => {
    if (!activeBondId || !profile?.id) return;
    
    // Fetch unread messages
    const fetchUnreadMsgs = async () => {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('bond_id', activeBondId)
        .is('read_at', null)
        .neq('sender_id', profile.id);

      if (count !== null) setUnreadCount(count);
    };
    fetchUnreadMsgs();

    // Fetch unread vibes
    const fetchUnreadVibes = async () => {
      const { data } = await supabase
        .from('vibes')
        .select('*')
        .eq('bond_id', activeBondId)
        .is('read_at', null)
        .neq('sender_id', profile.id)
        .order('created_at', { ascending: true });
        
      if (data && data.length > 0) {
        setVibeQueue(data);
      }
    };
    fetchUnreadVibes();

    const channel = supabase.channel(`home_unread:${activeBondId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `bond_id=eq.${activeBondId}` }, (payload: any) => {
        const msg = payload.new as any;
        if (msg.sender_id !== profile.id && !msg.read_at) {
          setUnreadCount(c => c + 1);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `bond_id=eq.${activeBondId}` }, () => {
        fetchUnreadMsgs();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeBondId, profile?.id]);

  // 2. Consume Vibe Queue naturally
  useEffect(() => {
    if (vibeQueue.length > 0 && !playingVibe) {
      const nextVibe = vibeQueue[0];
      setPlayingVibe(nextVibe);
      setVibeQueue(q => q.slice(1));
      
      // Play sound mapping based on vibe_type
      playSound(nextVibe.vibe_type as any);
      
      // Fade & pop in
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(overlayScale, { toValue: 1, friction: 6, tension: 50, useNativeDriver: true }),
      ]).start();

      // Mark read in DB
      supabase.from('vibes').update({ read_at: new Date().toISOString() }).eq('id', nextVibe.id).then();
      
      // Fade out after 2.5s
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(overlayOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
          Animated.timing(overlayScale, { toValue: 0.8, duration: 400, useNativeDriver: true }),
        ]).start(() => {
          setPlayingVibe(null);
        });
      }, 2500);
    }
  }, [vibeQueue, playingVibe]);

  // 3. Listener from useVibes hook (just push to queue)
  const handleVibeReceived = useCallback(async (vibe: any) => {
    // Special handling for Walkie Bursts (Auto-Play)
    if (vibe.vibe_type === 'walkie_burst' && vibe.content) {
      try {
        await playBurst(vibe.content, async () => {
          // Cleanup after play (Ephemeral logic)
          // We mark as read and could theoretically delete the asset here if we had an edge function
          console.log('Walkie burst finished playing');
        });
      } catch (e) {
        console.error('Failed to auto-play walkie burst', e);
      }
      return;
    }
    setVibeQueue(q => [...q, vibe]);
  }, []);

  useVibes(handleVibeReceived);

  // ────────────────────────────────────────────────────────────────────────────

  const activeBond = bonds.find(b => b.id === activeBondId);
  const partnerProfile = activeBondId ? bondMembers[activeBondId] : null;

  const handleSend = async (vibeType: string) => {
    if (!activeBondId || sending) return;
    setSending(vibeType);
    try {
      await sendVibe(activeBondId, vibeType);
      setLastSent(vibeType);
      setTimeout(() => setLastSent(null), 3000);
    } catch (e: any) {
      Alert.alert('Could not send', e.message ?? 'Try again.');
    } finally {
      setSending(null);
    }
  };

  const handleStartTalk = async () => {
    if (!(await requestMicrophonePermission())) {
      Alert.alert('Permission Denied', 'Mic access is needed for Walkie-Talkie');
      return;
    }
    try {
      await startRecording();
    } catch (e) {
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const handleStopTalk = async () => {
    try {
      const audioUrl = await stopRecordingAndUpload(activeBondId!, profile!.id);
      if (audioUrl) {
        await sendVibe(activeBondId!, 'walkie_burst', audioUrl);
      }
    } catch (e) {
      console.error('Failed to send Walkie Burst', e);
    }
  };

  const navToConnections = () => {
    nav.navigate('Connections');
  };

  if (!activeBond || !partnerProfile) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="dark-content" backgroundColor="#F5ECD7" />
        <LinearGradient colors={['#FDFAF4', '#F5ECD7', '#EDD9B8']} style={StyleSheet.absoluteFill} />
        
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>👥</Text>
          <Text style={styles.emptyTitle}>Select a Connection</Text>
          <Text style={styles.emptySub}>
             You don't have an active connection selected. Go to your Connections tab to add someone or select an existing bond.
          </Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={navToConnections} activeOpacity={0.87}>
            <LinearGradient
              colors={['#D97B60', '#C9705A']}
              style={styles.emptyBtnGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.emptyBtnText}>Go to Connections</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const bondMeta = BOND_META[activeBond.bond_type] ?? BOND_META.other;
  const partnerName = partnerProfile.display_name ?? partnerProfile.username ?? `Your ${bondMeta.label}`;
  const myName = profile?.display_name ?? profile?.username ?? 'You';

  const initials = (name: string) =>
    name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  const activeBonds = bonds.filter(b => b.status === 'active');
  const activeVibeDef = VIBES.find((v) => v.id === playingVibe?.vibe_type) ?? VIBES[0];

  return (
    <View style={styles.root}>
      {/* ── Background Decoration ── */}
      <StatusBar barStyle="dark-content" />
      <LinearGradient
        colors={['#FDFAF4', '#F5ECD7', '#EDD9B8']}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 60, paddingBottom: 100 }}>
        {/* ── Active Bond Switcher (Organic Blobs) ─────────── */}
        <View style={styles.bondsSection}>
          <View style={styles.bondsHeader}>
            <Text style={styles.bondsLabel}>Active Bonds</Text>
            <View style={styles.onlineBadge}>
              <Text style={styles.onlineText}>{activeBonds.length} Online</Text>
            </View>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bondSwitcherScroll}>
            {activeBonds.map((b) => {
              const bPartner = bondMembers[b.id];
              const pName = bPartner?.display_name || bPartner?.username || 'Partner';
              const isActive = b.id === activeBondId;

              return (
                <TouchableOpacity
                  key={b.id}
                  style={styles.bondMember}
                  onPress={() => setActiveBondId(b.id)}
                  activeOpacity={0.8}
                >
                  <BlobAvatar 
                    initials={initials(pName)} 
                    color={BOND_META[b.bond_type]?.color || '#B5947A'}
                    isActive={isActive}
                    size={isActive ? 90 : 75}
                  />
                  <Text style={[styles.bondMemberName, isActive && { color: '#C9705A', fontWeight: '800' }]}>{pName}</Text>
                  <Text style={styles.bondMemberRole}>{BOND_META[b.bond_type]?.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Dynamic Layout: Vibes vs Walkie ────────────────────────────────── */}
        <View style={styles.mainContent}>
          {isWalkieActive ? (
            <WalkieTalkieView 
              partnerName={partnerName}
              onBack={() => setIsWalkieActive(false)}
              onStartTalk={handleStartTalk}
              onStopTalk={handleStopTalk}
            />
          ) : (
            <View style={styles.vibesContainer}>
              <View style={styles.vibesHeader}>
                <Text style={styles.vibesTitle}>Send Vibes to {partnerName}</Text>
                <TouchableOpacity 
                  style={styles.walkieToggle} 
                  onPress={() => setIsWalkieActive(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.walkieToggleIcon}>📶</Text>
                  <Text style={styles.walkieToggleText}>START WALKIE</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.vibeCardList}>
                {VIBES.map((v) => (
                  <VibeCard 
                    key={v.id}
                    title={v.label}
                    description={v.sub}
                    emoji={v.emoji}
                    color={v.color}
                    onPress={() => handleSend(v.id)}
                    loading={sending === v.id}
                  />
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Open Chat Button (Pinned to Bottom-ish) ────────────────────────────────── */}
      <TouchableOpacity 
        style={styles.chatButton} 
        onPress={() => nav.navigate('Chat')} 
        activeOpacity={0.8}
      >
        <Text style={styles.chatIcon}>💬</Text>
        <Text style={styles.chatBtnText}>Open Chat</Text>
        {unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>


      {/* ── Feedback after sending ────────────────────────────────────── */}
      {lastSent && (
        <View style={styles.sentBadge}>
          <Text style={styles.sentText}>
            {VIBES.find((v) => v.id === lastSent)?.emoji}{' '}
            Vibe sent to {partnerName} ✓
          </Text>
        </View>
      )}

      {/* ── Persistent Vibe Overlay (Absolute Full Screen) ──────────── */}
      {playingVibe && (
        <Animated.View style={[
            StyleSheet.absoluteFill,
            styles.overlay,
            { backgroundColor: activeVibeDef.color, opacity: overlayOpacity }
          ]}
          pointerEvents="none"
        >
          <Animated.View style={{ transform: [{ scale: overlayScale }], alignItems: 'center' }}>
            <Text style={styles.overlayEmoji}>{activeVibeDef.emoji}</Text>
            <Text style={styles.overlayTitle}>{activeVibeDef.label}</Text>
            <Text style={styles.overlaySub}>Received from {partnerName}</Text>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5ECD7' },

  // Empty State (Missing Styles restored)
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
    marginTop: -40,
  },
  emptyEmoji: { fontSize: 64 },
  emptyTitle: { fontSize: 24, fontWeight: '900', color: '#3D2B1F', marginBottom: 12, textAlign: 'center' },
  emptySub: { fontSize: 15, color: '#8C6246', textAlign: 'center', lineHeight: 22, opacity: 0.8 },
  emptyBtn: { marginTop: 10, borderRadius: 20, overflow: 'hidden' },
  emptyBtnGrad: { paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center' },
  emptyBtnText: { fontSize: 15, fontWeight: '700', color: '#FDFAF4' },

  // Header (Restored Minimal Style)
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 16 
  },
  logoText: { 
    fontSize: 28, 
    fontWeight: '900', 
    color: '#3D2B1F', 
    letterSpacing: -1 
  },
  settingsBtn: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: '#FDFAF4', 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2
  },

  // Active Bonds Section
  bondsSection: { marginTop: 24, paddingHorizontal: 0 },
  bondsHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 24,
    marginBottom: 16 
  },
  bondsLabel: { fontSize: 10, fontWeight: '800', color: '#8C6246', letterSpacing: 1.5, textTransform: 'uppercase' },
  onlineBadge: { backgroundColor: 'rgba(160, 65, 45, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  onlineText: { fontSize: 9, fontWeight: '800', color: '#A0412D' },
  
  bondSwitcherScroll: { paddingHorizontal: 16, gap: 12, paddingBottom: 10 },
  bondMember: { alignItems: 'center', width: 100 },
  bondMemberName: { fontSize: 13, fontWeight: '700', color: '#3D2B1F', marginTop: 8 },
  bondMemberRole: { fontSize: 9, fontWeight: '800', color: '#8C6246', textTransform: 'uppercase', opacity: 0.6 },

  // Main Content
  mainContent: { flex: 1, paddingHorizontal: 24, marginTop: 24, paddingBottom: 40 },
  vibesContainer: { gap: 20 },
  vibesHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: 10
  },
  vibesTitle: { fontSize: 20, fontWeight: '800', color: '#3D2B1F' },
  walkieToggle: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    backgroundColor: 'rgba(160, 65, 45, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24
  },
  walkieToggleIcon: { fontSize: 14 },
  walkieToggleText: { fontSize: 10, fontWeight: '800', color: '#A0412D', letterSpacing: 1 },
  vibeCardList: { gap: 12 },

  // ── Overlay ──
  overlay: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  overlayEmoji: { fontSize: 96, marginBottom: 16 },
  overlayTitle: { fontSize: 32, fontWeight: '800', color: '#FDFAF4', letterSpacing: 0.5, textAlign: 'center' },
  overlaySub: { fontSize: 16, color: '#FDFAF4', opacity: 0.8, marginTop: 8 },

  // ── Chat Button ──
  chatButton: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDFAF4',
    paddingVertical: 16,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#D9BC8A',
    shadowColor: '#3D2B1F',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  chatIcon: { fontSize: 18, marginRight: 8 },
  chatBtnText: { fontSize: 16, fontWeight: '800', color: '#3D2B1F' },
  unreadBadge: {
    marginLeft: 8,
    backgroundColor: '#C9705A',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: { fontSize: 11, fontWeight: '800', color: '#FDFAF4' },

  // ── Feedback Badge ──
  sentBadge: {
    position: 'absolute',
    top: 120,
    left: 40,
    right: 40,
    backgroundColor: '#EDD9B8',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    zIndex: 10,
  },
  sentText: { fontSize: 13, color: '#5C3D2E', fontWeight: '600' },
});
