import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useStore, BOND_META } from '../store/useStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { playSound } from '../lib/sound';

type Message = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_system?: boolean;
};

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const { session, profile, activeBondId, bonds, bondMembers } = useStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);

  const activeBond = bonds.find((b) => b.id === activeBondId);
  const partnerProfile = activeBondId ? bondMembers[activeBondId] : null;

  const [isPartnerOnline, setIsPartnerOnline] = useState(partnerProfile?.is_online ?? false);

  useEffect(() => {
    setIsPartnerOnline(partnerProfile?.is_online ?? false);
  }, [partnerProfile?.is_online]);

  useEffect(() => {
    if (!partnerProfile?.id) return;
    const chan = supabase.channel(`profile_online:${partnerProfile.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${partnerProfile.id}` }, (payload) => {
        setIsPartnerOnline(payload.new.is_online);
      }).subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [partnerProfile?.id]);

  // ── 1. Fetch Initial Messages ────────────────────────────────────────────────
  useEffect(() => {
    if (!session?.user || !activeBondId) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('bond_id', activeBondId)
        .order('created_at', { ascending: false })
        .limit(50); // Load last 50 for performance

      if (!error && data) {
        setMessages(data);
      }
      setLoading(false);
    };

    fetchMessages();
  }, [activeBondId, session?.user]);

  // ── 2. Real-time Subscription ────────────────────────────────────────────────
  useEffect(() => {
    if (!activeBondId || !session?.user) return;

    const channel = supabase
      .channel(`chat:${activeBondId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `bond_id=eq.${activeBondId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          // Avoid appending if we already have it from optimistic UI
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMessage.id)) return prev;
            
            // Only play sound if the message was sent by the partner
            if (newMessage.sender_id !== session.user.id) {
              playSound('receive');
            }
            
            return [newMessage, ...prev];
          });
        }
      )
      .subscribe();

    // Mark messages as read on view (we just blindly update read_at where recipient is us)
    // For MVP, we update any messages sent by partner where read_at is null
    const markRead = async () => {
      if (!partnerProfile) return;
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('bond_id', activeBondId)
        .eq('sender_id', partnerProfile.id)
        .is('read_at', null);
    };
    markRead();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeBondId, session?.user, partnerProfile]);

  // ── 3. Send Message ─────────────────────────────────────────────────────────
  const handleSend = async () => {
    const txt = inputText.trim();
    if (!txt || !session?.user || !activeBondId || sending) return;

    setSending(true);
    setInputText('');
    playSound('send');

    // Optimistic UI update
    const optId = `temp-${Date.now()}`;
    const newMsg: Message = {
      id: optId,
      sender_id: session.user.id,
      content: txt,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [newMsg, ...prev]);

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          bond_id: activeBondId,
          sender_id: session.user.id,
          content: txt,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Replace optimistic message with actual DB message
      if (data) {
        setMessages((prev) =>
          prev.map((m) => (m.id === optId ? (data as Message) : m))
        );
      }
    } catch (e: any) {
      console.error('Send error:', e);
      // Revert optimistic if error
      setMessages((prev) => prev.filter((m) => m.id !== optId));
      setInputText(txt);
    } finally {
      setSending(false);
    }
  };

  if (!activeBond || !partnerProfile) {
    return (
      <View style={styles.root}>
        <ActivityIndicator color="#C9705A" />
      </View>
    );
  }

  const meta = BOND_META[activeBond.bond_type] ?? BOND_META.other;
  const partnerName = partnerProfile.display_name ?? partnerProfile.username ?? 'Your Connection';
  const partnerInitial = partnerName.charAt(0).toUpperCase();

  const renderBubble = ({ item }: { item: Message }) => {
    if (item.is_system) {
      return (
        <View style={styles.systemBubbleWrap}>
          <View style={styles.systemBubble}>
             <Text style={styles.systemBubbleText}>{item.content}</Text>
          </View>
        </View>
      );
    }

    const isMe = item.sender_id === session?.user?.id;
    return (
      <View style={[styles.bubbleWrap, isMe ? styles.bubbleMeWrap : styles.bubbleThemWrap]}>
        {!isMe && (
          <View style={[styles.avatarSmall, { backgroundColor: meta.color }]}>
            <Text style={styles.avatarSmallText}>{partnerInitial}</Text>
          </View>
        )}
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
          <Text style={[styles.bubbleText, isMe && styles.bubbleMeText]}>{item.content}</Text>
          <Text style={[styles.bubbleTime, isMe && styles.bubbleMeTime]}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient colors={['#FDFAF4', '#F5ECD7', '#EDD9B8']} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => nav.goBack()} hitSlop={20}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <View style={[styles.headerAvatar, { backgroundColor: meta.color }]}>
            <Text style={styles.headerAvatarText}>{partnerInitial}</Text>
          </View>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.headerName}>{partnerName}</Text>
              <View style={[styles.onlineDot, isPartnerOnline && styles.onlineDotActive]} />
            </View>
            <Text style={styles.headerSub}>
              {isPartnerOnline ? '🟢 Online' : '⚪ Offline'} · {meta.emoji} {meta.label} Bond
            </Text>
          </View>
        </View>
      </View>

      {/* Messages List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#C9705A" />
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderBubble}
          inverted={true}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Input Area */}
      <View style={styles.inputArea}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Message..."
          placeholderTextColor="#C5A870"
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
        >
          <LinearGradient
            colors={inputText.trim() ? ['#D97B60', '#C9705A'] : ['#D9BC8A', '#C5A870']}
            style={styles.sendBtnGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.sendIcon}>↑</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5ECD7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: '#D9BC8A',
    backgroundColor: '#FDFAF4',
  },
  backBtn: { marginRight: 16 },
  backText: { fontSize: 24, fontWeight: '600', color: '#8C6246' },
  headerInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: { fontSize: 18, fontWeight: '800', color: '#FDFAF4' },
  headerName: { fontSize: 17, fontWeight: '800', color: '#3D2B1F' },
  headerSub: { fontSize: 12, color: '#8C6246', fontWeight: '500' },

  // List
  listContent: { paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  
  // Bubbles
  systemBubbleWrap: { alignItems: 'center', marginVertical: 16 },
  systemBubble: { backgroundColor: '#EDD9B8', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  systemBubbleText: { fontSize: 12, fontWeight: '700', color: '#8C6246', textAlign: 'center' },
  bubbleWrap: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12 },
  bubbleMeWrap: { justifyContent: 'flex-end' },
  bubbleThemWrap: { justifyContent: 'flex-start', gap: 8 },
  avatarSmall: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  avatarSmallText: { fontSize: 12, fontWeight: '700', color: '#FDFAF4' },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    shadowColor: '#3D2B1F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  bubbleMe: {
    backgroundColor: '#C9705A',
    borderColor: '#B05943',
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: '#FDFAF4',
    borderColor: '#D9BC8A',
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 15, lineHeight: 21, color: '#3D2B1F' },
  bubbleMeText: { color: '#FDFAF4' },
  bubbleTime: { fontSize: 10, color: '#8C6246', marginTop: 4, alignSelf: 'flex-end' },
  bubbleMeTime: { color: '#EDD9B8' },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D9BC8A' },
  onlineDotActive: { backgroundColor: '#4CAF50' },

  // Input
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1.5,
    borderTopColor: '#D9BC8A',
    backgroundColor: '#FDFAF4',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#F5ECD7',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#D9BC8A',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    color: '#3D2B1F',
    minHeight: 44,
    maxHeight: 120,
  },
  sendBtn: {
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 2,
  },
  sendBtnDisabled: { opacity: 0.7 },
  sendBtnGrad: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendIcon: { fontSize: 22, fontWeight: '800', color: '#FDFAF4' },
});
