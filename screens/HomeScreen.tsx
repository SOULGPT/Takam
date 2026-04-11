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
  Platform,
  Modal,
  TextInput,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore, BOND_META } from '../store/useStore';
import { useVibes, sendVibe } from '../hooks/useVibes';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { playSound } from '../lib/sound';
import { shadow } from '../lib/theme/shadows';

// New Velvet Pulse Components
import BlobAvatar from '../components/BlobAvatar';
import VibeCard from '../components/VibeCard';
import WalkieTalkieView from '../components/WalkieTalkieView';
import { startRecording, stopRecordingAndUpload, playBurst, requestMicrophonePermission } from '../lib/walkieTalkie';

// Tap-To-Bond Feature
import AuraGlow from '../components/AuraGlow';
import TapBondModal from '../components/TapBondModal';
import { useNfcHandshake } from '../hooks/useNfcHandshake';

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
  const { profile, bonds, bondMembers, activeBondId, setActiveBondId, unreadCounts, groups, groupUnreadCounts, setActiveGroupId, activeGroupId } = useStore();
  const [sending, setSending] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [isWalkieActive, setIsWalkieActive] = useState(false);
  
  // Custom Vibe State
  const [isCustomModalVisible, setIsCustomModalVisible] = useState(false);
  const [customEmoji, setCustomEmoji] = useState('✨');
  const [customTitle, setCustomTitle] = useState('');
  const [customMsg, setCustomMsg] = useState('');
  const [isCustomSending, setIsCustomSending] = useState(false);

  // Tap-to-Bond State
  const { isScanning, startHandshake, stopHandshake, isProcessing } = useNfcHandshake();
  const [pendingBondData, setPendingBondData] = useState<any>(null);

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

  // 1b. Listen for PROXIMITY HANDSHAKES (Bonds with status 'pending')
  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase.channel('proximity_bonds')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'bonds', 
        filter: `status=eq.pending` 
      }, async (payload: any) => {
        const bond = payload.new;
        const isParticipant = bond.user_a === profile.id || bond.user_b === profile.id;
        
        if (isParticipant) {
          const partnerId = bond.user_a === profile.id ? bond.user_b : bond.user_a;
          
          // Fetch partner profile for modal
          const { data: partner } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', partnerId)
            .single();

          if (partner) {
            setPendingBondData({
              id: bond.id,
              partnerId: partner.id,
              partnerName: partner.display_name || partner.username || 'Mysterious Soul',
              partnerAvatar: partner.avatar_url,
              partnerNature: (partner as any).nature_profile?.social === 'introvert' ? 'sage' : 'terracotta'
            });
            // Auto-stop scanning if we were the initiator
            stopHandshake();
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.id]);

  // 2. Consume Vibe Queue naturally
  useEffect(() => {
    if (vibeQueue.length > 0 && !playingVibe) {
      const nextVibe = vibeQueue[0];
      setPlayingVibe(nextVibe);
      setVibeQueue(q => q.slice(1));
      
      // Play sound mapping based on vibe_type
      playSound(nextVibe.vibe_type as any);
      
      // Fade & pop in, then pulse
      Animated.sequence([
        Animated.parallel([
          Animated.timing(overlayOpacity, { toValue: 1, duration: 400, useNativeDriver: Platform.OS !== 'web' }),
          Animated.spring(overlayScale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: Platform.OS !== 'web' }),
        ]),
        Animated.timing(overlayScale, { toValue: 1.15, duration: 400, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(overlayScale, { toValue: 1.0, duration: 400, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(overlayScale, { toValue: 1.1, duration: 400, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(overlayScale, { toValue: 1.0, duration: 400, useNativeDriver: Platform.OS !== 'web' }),
      ]).start();

      // Fade out after 3.5s
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(overlayOpacity, { toValue: 0, duration: 500, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(overlayScale, { toValue: 1.5, duration: 500, useNativeDriver: Platform.OS !== 'web' }),
        ]).start(() => {
          // Mark read in DB AFTER the experience
          supabase.from('vibes').update({ read_at: new Date().toISOString() }).eq('id', nextVibe.id).then();
          useStore.getState().clearUnread(nextVibe.bond_id); // Optimistically clear because user just saw it

          setPlayingVibe(null);
          overlayScale.setValue(0.5); // Reset properly
        });
      }, 3500);
    }
  }, [vibeQueue, playingVibe]);

  // 3. Listener from useVibes hook (just push to queue)
  const handleVibeReceived = useCallback(async (vibe: any) => {
    // Special handling for Walkie Bursts (Auto-Play)
    if (vibe.vibe_type === 'walkie_burst' && vibe.content) {
      try {
        await playBurst(vibe.content, async () => {
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

  const activeBond = bonds.find(b => b.id === activeBondId);
  const partnerProfile = activeBondId ? bondMembers[activeBondId] : null;

  const handleSend = async (vibeType: string, content?: string) => {
    if (!activeBondId || (vibeType !== 'custom' && sending)) return;
    if (vibeType !== 'custom') setSending(vibeType);
    
    try {
      await sendVibe(activeBondId, vibeType, content);
      setLastSent(vibeType);
      setTimeout(() => setLastSent(null), 3000);
    } catch (e: any) {
      Alert.alert('Could not send', e.message ?? 'Try again.');
    } finally {
      if (vibeType !== 'custom') setSending(null);
    }
  };

  const handleSendCustom = async () => {
    if (!customTitle.trim()) {
      Alert.alert('Title Required', 'Please give your vibe a name.');
      return;
    }
    
    const wordCount = customMsg.trim().split(/\s+/).length;
    if (customMsg.trim() && wordCount > 10) {
      Alert.alert('Too Long', 'Messages are limited to 10 words for maximum impact.');
      return;
    }

    setIsCustomSending(true);
    const customData = JSON.stringify({
      emoji: customEmoji || '✨',
      title: customTitle,
      message: customMsg
    });

    try {
      await handleSend('custom', customData);
      setIsCustomModalVisible(false);
      setCustomEmoji('✨');
      setCustomTitle('');
      setCustomMsg('');
    } finally {
      setIsCustomSending(false);
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
  
  const initials = (name: string) =>
    name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  const activeBonds = bonds.filter(b => b.status === 'active');
  const activeVibeDef = VIBES.find((v) => v.id === playingVibe?.vibe_type) ?? VIBES[0];
  
  // Custom Vibe Resolver
  const getDisplayData = () => {
    if (playingVibe?.vibe_type === 'custom' && playingVibe.content) {
      try {
        const parsed = JSON.parse(playingVibe.content);
        return {
          emoji: parsed.emoji || '✨',
          title: parsed.title || 'Custom Vibe',
          sub: parsed.message || `Received from ${partnerName}`,
          color: '#D9BC8A' // Gold/Amber for custom vibes
        };
      } catch (e) {
        return { ...activeVibeDef, color: '#D9BC8A' };
      }
    }
    return {
      emoji: activeVibeDef.emoji,
      title: activeVibeDef.label,
      sub: activeVibeDef.sub,
      color: activeVibeDef.color
    };
  };

  const display = getDisplayData();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient
        colors={['#FDFAF4', '#F5ECD7', '#EDD9B8']}
        style={StyleSheet.absoluteFill}
      />

      {/* Skia Aura (NFC Active) */}
      <AuraGlow isActive={isScanning} />

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 60, paddingBottom: 100 }}>
        {/* Header with Tap-to-Bond Trigger */}
        <View style={styles.header}>
          <Text style={styles.logoText}>TAKAM</Text>
          <TouchableOpacity 
            style={[styles.tapBtn, isScanning && styles.tapBtnActive]} 
            onPress={isScanning ? stopHandshake : startHandshake}
          >
            <Text style={styles.tapBtnIcon}>{isScanning ? '✨' : '📳'}</Text>
            <Text style={styles.tapBtnText}>{isScanning ? 'TAP NOW' : 'TAP TO BOND'}</Text>
          </TouchableOpacity>
        </View>

        {/* Group Bonds Section */}
        {groups.length > 0 && (
          <View style={[styles.bondsSection, { marginTop: 10 }]}>
            <View style={styles.bondsHeader}>
              <Text style={styles.bondsLabel}>Group Bonds</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bondSwitcherScroll}>
              {groups.map((g) => {
                const isActive = g.id === activeGroupId;
                const unread = groupUnreadCounts[g.id] || 0;
                return (
                  <TouchableOpacity key={g.id} style={styles.bondMember} onPress={() => setActiveGroupId(g.id)} activeOpacity={0.8}>
                    <View>
                      <BlobAvatar 
                        initials={g.cover_emoji}
                        color="#3D2B1F"
                        isActive={isActive}
                        size={isActive ? 90 : 75}
                      />
                      {unread > 0 && (
                        <View style={[styles.unreadBadge, isActive && { top: 0, right: 0 }]}>
                          <Text style={styles.unreadBadgeText}>
                            {unread > 99 ? '99+' : unread}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.bondMemberName, isActive && { color: '#C9705A', fontWeight: '800' }]}>{g.name}</Text>
                    <Text style={styles.bondMemberRole}>Group</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

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
                <TouchableOpacity key={b.id} style={styles.bondMember} onPress={() => setActiveBondId(b.id)} activeOpacity={0.8}>
                   <View>
                     <BlobAvatar 
                        avatarKey={bPartner?.avatar_url || undefined}
                        initials={initials(pName)} 
                        color={BOND_META[b.bond_type]?.color || '#B5947A'}
                        isActive={isActive}
                        size={isActive ? 90 : 75}
                      />
                      {unreadCounts[b.id] > 0 && (
                        <View style={[styles.unreadBadge, isActive && { top: 0, right: 0 }]}>
                          <Text style={styles.unreadBadgeText}>
                            {unreadCounts[b.id] > 99 ? '99+' : unreadCounts[b.id]}
                          </Text>
                        </View>
                      )}
                   </View>
                   <Text style={[styles.bondMemberName, isActive && { color: '#C9705A', fontWeight: '800' }]}>{pName}</Text>
                   <Text style={styles.bondMemberRole}>{BOND_META[b.bond_type]?.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

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
                <TouchableOpacity style={styles.walkieToggle} onPress={() => setIsWalkieActive(true)}>
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
                <VibeCard 
                  title="Custom Vibe"
                  description="Create your own unique gesture"
                  emoji="✨"
                  color="#D9BC8A"
                  onPress={() => setIsCustomModalVisible(true)}
                />
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={isCustomModalVisible} animationType="slide" transparent onRequestClose={() => setIsCustomModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setIsCustomModalVisible(false)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Custom Vibe</Text>
              <TouchableOpacity onPress={() => setIsCustomModalVisible(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
               <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Choose Emoji</Text>
                  <TextInput 
                    style={styles.emojiInput}
                    value={customEmoji}
                    onChangeText={setCustomEmoji}
                    placeholder="✨"
                    placeholderTextColor="rgba(0,0,0,0.2)"
                  />
               </View>
               <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Title</Text>
                  <TextInput 
                    style={styles.textInput}
                    value={customTitle}
                    onChangeText={setCustomTitle}
                    placeholder="e.g. Thinking of sunset..."
                    placeholderTextColor="rgba(0,0,0,0.2)"
                  />
               </View>
               <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Message (10 words max)</Text>
                  <TextInput 
                    style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
                    value={customMsg}
                    onChangeText={setCustomMsg}
                    placeholder="I just saw the most amazing sky..."
                    placeholderTextColor="rgba(0,0,0,0.2)"
                    multiline
                  />
               </View>
            </View>
            <TouchableOpacity style={styles.sendBtn} onPress={handleSendCustom} disabled={isCustomSending}>
              {isCustomSending ? <ActivityIndicator color="#FFF" /> : <Text style={styles.sendBtnText}>SEND TO {partnerName.toUpperCase()}</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <TouchableOpacity 
        style={styles.chatButton} 
        onPress={() => nav.navigate(activeGroupId ? 'GroupChat' : 'Chat')} 
        activeOpacity={0.8}
      >
        <Text style={styles.chatIcon}>💬</Text>
        <Text style={styles.chatBtnText}>Open {activeGroupId ? 'Group Chat' : 'Chat'}</Text>
        {activeBond && unreadCounts[activeBond.id] > 0 && (
          <View style={styles.chatUnreadBadge}>
            <Text style={styles.chatUnreadBadgeText}>{unreadCounts[activeBond.id]}</Text>
          </View>
        )}
        {activeGroupId && groupUnreadCounts[activeGroupId] > 0 && (
          <View style={styles.chatUnreadBadge}>
            <Text style={styles.chatUnreadBadgeText}>{groupUnreadCounts[activeGroupId]}</Text>
          </View>
        )}
      </TouchableOpacity>

      {lastSent && (
        <View style={styles.sentBadge}>
          <Text style={styles.sentText}>
            {lastSent === 'custom' ? '✨' : VIBES.find((v) => v.id === lastSent)?.emoji}{' '}
            Vibe sent to {partnerName} ✓
          </Text>
        </View>
      )}

      {playingVibe && (
        <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: display.color, opacity: overlayOpacity }]}>
          <Animated.View style={{ transform: [{ scale: overlayScale }], alignItems: 'center', paddingHorizontal: 40 }}>
            <Text style={styles.overlayEmoji}>{display.emoji}</Text>
            <Text style={styles.overlayTitle}>{display.title}</Text>
            <Text style={styles.overlaySub}>{display.sub}</Text>
          </Animated.View>
        </Animated.View>
      )}

      {/* Tap-to-Bond Modal */}
      <TapBondModal 
        pendingBond={pendingBondData}
        onClose={() => setPendingBondData(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5ECD7' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 10,
  },
  logoText: { fontSize: 24, fontWeight: '900', color: '#3D2B1F', letterSpacing: -1 },
  tapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(217, 188, 138, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D9BC8A',
  },
  tapBtnActive: {
    backgroundColor: '#1A1A1A',
    borderColor: '#1A1A1A',
  },
  tapBtnIcon: { fontSize: 14, marginRight: 6 },
  tapBtnText: { fontSize: 10, fontWeight: '800', color: '#3D2B1F', letterSpacing: 1 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, gap: 16, marginTop: -40 },

  emptyEmoji: { fontSize: 64 },
  emptyTitle: { fontSize: 24, fontWeight: '900', color: '#3D2B1F', marginBottom: 12, textAlign: 'center' },
  emptySub: { fontSize: 15, color: '#8C6246', textAlign: 'center', lineHeight: 22, opacity: 0.8 },
  emptyBtn: { marginTop: 10, borderRadius: 20, overflow: 'hidden' },
  emptyBtnGrad: { paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center' },
  emptyBtnText: { fontSize: 15, fontWeight: '700', color: '#FDFAF4' },
  bondsSection: { marginTop: 24 },
  bondsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 16 },
  bondsLabel: { fontSize: 10, fontWeight: '800', color: '#8C6246', letterSpacing: 1.5, textTransform: 'uppercase' },
  onlineBadge: { backgroundColor: 'rgba(160, 65, 45, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  onlineText: { fontSize: 9, fontWeight: '800', color: '#A0412D' },
  bondSwitcherScroll: { paddingHorizontal: 16, gap: 12, paddingBottom: 10 },
  bondMember: { alignItems: 'center', width: 100 },
  bondMemberName: { fontSize: 13, fontWeight: '700', color: '#3D2B1F', marginTop: 8 },
  bondMemberRole: { fontSize: 9, fontWeight: '800', color: '#8C6246', textTransform: 'uppercase', opacity: 0.6 },
  unreadBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: '#DB4B4B', borderRadius: 12, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6, borderWidth: 2, borderColor: '#FDFAF4', zIndex: 10 },
  unreadBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  mainContent: { flex: 1, paddingHorizontal: 24, marginTop: 24, paddingBottom: 40 },
  vibesContainer: { gap: 20 },
  vibesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  vibesTitle: { fontSize: 20, fontWeight: '800', color: '#3D2B1F' },
  walkieToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(160, 65, 45, 0.1)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24 },
  walkieToggleIcon: { fontSize: 14 },
  walkieToggleText: { fontSize: 10, fontWeight: '800', color: '#A0412D', letterSpacing: 1 },
  vibeCardList: { gap: 12 },
  overlay: { justifyContent: 'center', alignItems: 'center', zIndex: 9999, pointerEvents: 'none' },
  overlayEmoji: { 
    fontSize: 120, 
    marginBottom: 20, 
    ...Platform.select({
      ios: {
        textShadowColor: 'rgba(0,0,0,0.2)',
        textShadowOffset: { width: 0, height: 4 },
        textShadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
      web: {
        textShadow: '0 4px 20px rgba(0,0,0,0.2)'
      }
    })
  },
  overlayTitle: { fontSize: 34, fontWeight: '900', color: '#FDFAF4', textAlign: 'center' },
  overlaySub: { fontSize: 18, color: '#FDFAF4', opacity: 0.9, marginTop: 8, fontWeight: '600', textAlign: 'center' },
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
    ...shadow('#3D2B1F', { width: 0, height: 0 }, 0.1, 20, 8),
  },
  chatIcon: { fontSize: 18, marginRight: 8 },
  chatBtnText: { fontSize: 16, fontWeight: '800', color: '#3D2B1F' },
  chatUnreadBadge: { marginLeft: 8, backgroundColor: '#C9705A', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  chatUnreadBadgeText: { fontSize: 11, fontWeight: '800', color: '#FDFAF4' },
  sentBadge: { position: 'absolute', top: 120, left: 40, right: 40, backgroundColor: '#EDD9B8', borderRadius: 12, paddingVertical: 10, alignItems: 'center', zIndex: 10 },
  sentText: { fontSize: 13, color: '#5C3D2E', fontWeight: '600' },

  // Modal Styles
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(61, 43, 31, 0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FDFAF4', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#3D2B1F' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.05)', justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { fontSize: 14, color: '#3D2B1F', fontWeight: '800' },
  modalBody: { gap: 16 },
  inputGroup: { gap: 8 },
  inputLabel: { fontSize: 12, fontWeight: '800', color: '#8C6246', textTransform: 'uppercase', letterSpacing: 0.5 },
  emojiInput: { fontSize: 32, backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 16, padding: 12, textAlign: 'center', width: 80 },
  textInput: { fontSize: 16, backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 16, padding: 16, color: '#3D2B1F', fontWeight: '600' },
  sendBtn: { 
    marginTop: 24, 
    backgroundColor: '#D97B60', 
    borderRadius: 24, 
    paddingVertical: 18, 
    alignItems: 'center', 
    ...shadow('#D97B60', { width: 0, height: 4 }, 0.3, 10, 5),
  },
  sendBtnText: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
});
