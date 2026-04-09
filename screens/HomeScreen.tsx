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

const { width, height } = Dimensions.get('window');

const VIBES = [
  { id: 'miss_you',       emoji: '🌙', label: 'I Miss You',         color: '#8B7BA8' },
  { id: 'love',           emoji: '🌹', label: 'Sending Love',        color: '#C9705A' },
  { id: 'thinking_of_you',emoji: '🌸', label: 'Thinking of You',     color: '#B5947A' },
];

export default function HomeScreen() {
  const nav = useNavigation<any>();
  const { profile, bonds, bondMembers, activeBondId, setActiveBondId } = useStore();
  const [sending, setSending] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState<string | null>(null);
  
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
  const handleVibeReceived = useCallback((vibe: any) => {
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
      <StatusBar barStyle="dark-content" backgroundColor="#F5ECD7" />
      <LinearGradient
        colors={['#FDFAF4', '#F5ECD7', '#EDD9B8']}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Active Bond Switcher (Top pill) ─────────── */}
      {activeBonds.length > 1 && (
        <View style={styles.bondSwitcherWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bondSwitcherScroll}>
            {activeBonds.map((b) => {
              const meta = BOND_META[b.bond_type] ?? BOND_META.other;
              const bPartner = bondMembers[b.id];
              const bName = bPartner?.display_name || bPartner?.username || meta.label;
              const isActive = b.id === activeBondId;

              return (
                <TouchableOpacity
                  key={b.id}
                  style={[styles.bondPill, isActive && { backgroundColor: meta.color, borderColor: meta.color }]}
                  onPress={() => setActiveBondId(b.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.bondPillEmoji, isActive && { opacity: 1 }]}>{meta.emoji}</Text>
                  <Text style={[styles.bondPillText, isActive && { color: '#FDFAF4', fontWeight: '700' }]}>
                    {bName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── Partner card ─────────────────────────────────────────────── */}
      <Animated.View style={[styles.partnerCard, activeBonds.length <= 1 && { marginTop: 100 }]}>
        <View style={styles.avatarRow}>
          {/* My avatar */}
          <View style={[styles.avatar, { backgroundColor: '#C9705A' }]}>
            <Text style={styles.avatarText}>{initials(myName)}</Text>
          </View>

          {/* Bond connector */}
          <View style={styles.connectorWrap}>
            <Text style={styles.connectorIcon}>{bondMeta.emoji}</Text>
            <View style={[styles.connectorLine, { backgroundColor: bondMeta.color }]} />
          </View>

          {/* Partner avatar */}
          <View style={[styles.avatar, { backgroundColor: bondMeta.color }]}>
            <Text style={styles.avatarText}>{initials(partnerName)}</Text>
          </View>
        </View>

        <Text style={styles.partnerName}>{partnerName}</Text>
        <Text style={styles.partnerSub}>
          {bondMeta.emoji} {bondMeta.label} Bond · Connected
        </Text>
      </Animated.View>

      {/* ── Open Chat Button ──────────────────────────────────────────── */}
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

      {/* ── Vibe buttons ─────────────────────────────────────────────── */}
      <View style={styles.vibesSection}>
        <Text style={styles.vibesLabel}>Send a Vibe</Text>
        <View style={styles.vibeGrid}>
          {VIBES.map((vibe) => (
            <TouchableOpacity
              key={vibe.id}
              style={[
                styles.vibeButton,
                sending === vibe.id && styles.vibeButtonSending,
              ]}
              onPress={() => handleSend(vibe.id)}
              disabled={!!sending}
              activeOpacity={0.8}
            >
              {sending === vibe.id ? (
                <ActivityIndicator color={vibe.color} />
              ) : (
                <>
                  <Text style={styles.vibeEmoji}>{vibe.emoji}</Text>
                  <Text style={[styles.vibeLabel, { color: vibe.color }]}>
                    {vibe.label}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

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

  // ── Overlay ──
  overlay: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  overlayEmoji: { fontSize: 96, marginBottom: 16 },
  overlayTitle: { fontSize: 32, fontWeight: '800', color: '#FDFAF4', letterSpacing: 0.5, textAlign: 'center' },
  overlaySub: { fontSize: 16, color: '#FDFAF4', opacity: 0.8, marginTop: 8 },

  // ── Empty State ──
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
    marginTop: -40,
  },
  emptyEmoji: { fontSize: 64 },
  emptyTitle: { fontSize: 24, fontWeight: '800', color: '#3D2B1F', textAlign: 'center' },
  emptySub: { fontSize: 15, color: '#8C6246', textAlign: 'center', lineHeight: 22 },
  emptyBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 12,
    shadowColor: '#9B3D2C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  emptyBtnGrad: { paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center' },
  emptyBtnText: { fontSize: 15, fontWeight: '700', color: '#FDFAF4' },

  // ── Active Bond Switcher ──
  bondSwitcherWrap: {
    paddingTop: 56,
    paddingBottom: 8,
  },
  bondSwitcherScroll: {
    paddingHorizontal: 16,
    gap: 10,
  },
  bondPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FDFAF4',
    borderWidth: 1.5,
    borderColor: '#D9BC8A',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  bondPillEmoji: { fontSize: 14, opacity: 0.8 },
  bondPillText: { fontSize: 13, fontWeight: '600', color: '#8C6246' },

  // ── Partner card ─────────────────────────────────────────────────────────
  partnerCard: {
    marginTop: 40,
    alignItems: 'center',
    paddingHorizontal: 28,
    gap: 16,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#F5ECD7',
    shadowColor: '#3D2B1F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FDFAF4',
  },
  connectorWrap: {
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  connectorIcon: { fontSize: 24, marginBottom: 6 },
  connectorLine: {
    width: 48,
    height: 3,
    borderRadius: 2,
    opacity: 0.7,
  },
  partnerName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#3D2B1F',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  partnerSub: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8C6246',
    textAlign: 'center',
  },

  // ── Chat Button ─────────────────────────────────────────────────────────
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDFAF4',
    marginHorizontal: 40,
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#D9BC8A',
    shadowColor: '#3D2B1F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  chatIcon: { fontSize: 18, marginRight: 8 },
  chatBtnText: { fontSize: 15, fontWeight: '700', color: '#3D2B1F' },
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

  // ── Sent feedback ─────────────────────────────────────────────────────────
  sentBadge: {
    marginHorizontal: 28,
    marginTop: 16,
    backgroundColor: '#EDD9B8',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  sentText: {
    fontSize: 13,
    color: '#5C3D2E',
    fontWeight: '600',
  },

  // ── Vibe buttons ─────────────────────────────────────────────────────────
  vibesSection: {
    marginTop: 32,
    paddingHorizontal: 24,
    gap: 14,
  },
  vibesLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B5947A',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  vibeGrid: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  vibeButton: {
    backgroundColor: '#FDFAF4',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
    width: (width - 48 - 24) / 3,
    borderWidth: 1.5,
    borderColor: '#D9BC8A',
    shadowColor: '#3D2B1F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  vibeButtonSending: {
    opacity: 0.6,
  },
  vibeEmoji: { fontSize: 28 },
  vibeLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 15,
  },
});
