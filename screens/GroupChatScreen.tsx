import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { useStore, Group, GroupMember } from '../store/useStore';

const { width } = Dimensions.get('window');

type GroupMessage = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  message_type: 'text' | 'vibe' | 'system';
  vibe_type?: string;
  sender_name?: string;
};

// VIBE OPTIONS (From User Request)
const GROUP_VIBES = [
  { id: 'thought', label: 'Thinking of You', emoji: '🧠', color: '#B5947A' },
  { id: 'love', label: 'Sending Love', emoji: '❤️', color: '#C9705A' },
  { id: 'morning', label: 'Good Morning', emoji: '☀️', color: '#D4A022' },
  { id: 'night', label: 'Good Night', emoji: '🌙', color: '#5A7EC9' },
  { id: 'checking', label: 'Just Checking In', emoji: '👋', color: '#5C8A6A' },
  { id: 'custom', label: 'Custom Vibe', emoji: '✨', color: '#C4A882' },
];

export default function GroupChatScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const { session, activeGroupId, groups, groupMembers, setGroupMembers, clearGroupUnread } = useStore();
  
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [vibeSheetVisible, setVibeSheetVisible] = useState(false);

  const activeGroup = groups.find(g => g.id === activeGroupId);
  const members = groupMembers[activeGroupId || ''] || [];
  const myMember = members.find(m => m.user_id === session?.user?.id);
  const isHostOrMod = myMember?.role === 'host' || myMember?.role === 'moderator';

  const flatListRef = useRef<FlatList>(null);

  // 1. Fetch Members & Messages
  useEffect(() => {
    if (!activeGroupId) return;

    const loadData = async () => {
      setLoading(true);
      // Fetch Members with Profiles
      const { data: memData } = await supabase
        .from('group_members')
        .select('*, profile:profiles(*)')
        .eq('group_id', activeGroupId);
      
      if (memData) setGroupMembers(activeGroupId, memData as any);

      // Fetch Recent Messages
      const { data: msgData } = await supabase
        .from('group_messages')
        .select('*')
        .eq('group_id', activeGroupId)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (msgData) setMessages(msgData as GroupMessage[]);
      setLoading(false);
      clearGroupUnread(activeGroupId);
    };

    loadData();

    // 2. Real-time Subscription
    const channel = supabase.channel(`group_chat:${activeGroupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${activeGroupId}` }, (payload) => {
        const newMsg = payload.new as GroupMessage;
        setMessages(prev => [newMsg, ...prev]);
        
        // Vibe Haptics
        if (newMsg.message_type === 'vibe' && newMsg.sender_id !== session?.user?.id) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeGroupId]);

  const handleSend = async () => {
    if (!inputText.trim() || !activeGroupId || !session?.user) return;
    const content = inputText.trim();
    setInputText('');

    await supabase.from('group_messages').insert({
      group_id: activeGroupId,
      sender_id: session.user.id,
      content,
      message_type: 'text',
    });
  };

  const handleSendVibe = async (vibe: typeof GROUP_VIBES[0]) => {
    if (!activeGroupId || !session?.user) return;
    setVibeSheetVisible(false);

    // If custom, prompt for text
    let customText = null;
    if (vibe.id === 'custom') {
      // For simplicity in MVP, we'll just send "Custom Vibe"
      // In production, we'd show a text input modal here
    }

    await supabase.from('group_vibes').insert({
      group_id: activeGroupId,
      sent_by: session.user.id,
      vibe_type: vibe.id,
      custom_text: customText,
    });

    // Also post it as a message so it shows in chat
    await supabase.from('group_messages').insert({
      group_id: activeGroupId,
      sender_id: session.user.id,
      content: `${vibe.emoji} Sent a Group Vibe: ${vibe.label}`,
      message_type: 'vibe',
      vibe_type: vibe.id,
    });
  };

  const renderItem = ({ item }: { item: GroupMessage }) => {
    const isMe = item.sender_id === session?.user?.id;
    const sender = members.find(m => m.user_id === item.sender_id);
    const senderName = sender?.profile?.display_name || sender?.profile?.username || 'Member';

    if (item.message_type === 'system') {
      return (
        <View style={styles.systemBubbleWrap}>
          <View style={styles.systemBubble}>
            <Text style={styles.systemBubbleText}>{item.content}</Text>
          </View>
        </View>
      );
    }

    if (item.message_type === 'vibe') {
      return (
        <View style={styles.vibeCardWrap}>
          <LinearGradient colors={['#FDF0D5', '#F5ECD7']} style={styles.vibeCard}>
             <Text style={styles.vibeEmoji}>✨</Text>
             <Text style={styles.vibeText}>{item.content}</Text>
             <Text style={styles.vibeSender}>from {isMe ? 'you' : senderName}</Text>
          </LinearGradient>
        </View>
      );
    }

    return (
      <View style={[styles.bubbleWrap, isMe ? styles.bubbleWrapMe : styles.bubbleWrapThem]}>
        {!isMe && <Text style={styles.senderName}>{senderName}</Text>}
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
          <Text style={[styles.bubbleText, isMe ? styles.textMe : styles.textThem]}>{item.content}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#121212', '#1A1A1A', '#0F0F0F']} style={StyleSheet.absoluteFill} />
      
      {/* Header */}
      <BlurView intensity={80} tint="dark" style={[styles.header, { paddingTop: insets.top + 8 }]}>
         <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
         </TouchableOpacity>
         <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{activeGroup?.name || 'Group Bond'}</Text>
            <Text style={styles.headerSub}>{members.length} members online</Text>
         </View>
         <TouchableOpacity onPress={() => nav.navigate('GroupSettings')} style={styles.settingsBtn}>
            <Ionicons name="information-circle-outline" size={24} color="#FFF" />
         </TouchableOpacity>
      </BlurView>

      <FlatList
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        inverted
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      />

      {/* Vibe Trigger (Mod/Host Only) */}
      {isHostOrMod && (
        <TouchableOpacity style={styles.vibeTrigger} onPress={() => setVibeSheetVisible(true)}>
           <Text style={styles.vibeTriggerText}>✨ SEND GROUP VIBE</Text>
        </TouchableOpacity>
      )}

      {/* Input */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={80}>
        <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 12 }]}>
           <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Message group..."
              placeholderTextColor="#888"
              multiline
           />
           <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
              <Ionicons name="arrow-up" size={24} color="#FFF" />
           </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Vibe Bottom Sheet (Simplified) */}
      {vibeSheetVisible && (
        <View style={styles.sheetOverlay}>
           <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setVibeSheetVisible(false)} />
           <Animated.View style={styles.sheetContent}>
              <Text style={styles.sheetTitle}>Broadcast a Vibe ⚡️</Text>
              <View style={styles.vibeGrid}>
                 {GROUP_VIBES.map(v => (
                   <TouchableOpacity key={v.id} style={styles.vibeOption} onPress={() => handleSendVibe(v)}>
                      <Text style={styles.vibeOptionEmoji}>{v.emoji}</Text>
                      <Text style={styles.vibeOptionLabel}>{v.label}</Text>
                   </TouchableOpacity>
                 ))}
              </View>
           </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1, marginLeft: 12 },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  headerSub: { color: '#888', fontSize: 12 },
  settingsBtn: { padding: 4 },

  bubbleWrap: { maxWidth: width * 0.75, marginVertical: 4 },
  bubbleWrapMe: { alignSelf: 'flex-end' },
  bubbleWrapThem: { alignSelf: 'flex-start' },
  senderName: { color: '#C4A882', fontSize: 10, fontWeight: '800', marginBottom: 2, marginLeft: 4, textTransform: 'uppercase' },
  bubble: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  bubbleMe: { backgroundColor: '#C4A882', borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: '#262626', borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, fontWeight: '600' },
  textMe: { color: '#FFF' },
  textThem: { color: '#E0E0E0' },

  systemBubbleWrap: { alignItems: 'center', marginVertical: 16 },
  systemBubble: { backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, borderHorizontalWidth: 1, borderColor: 'rgba(196, 168, 130, 0.3)' },
  systemBubbleText: { color: '#C4A882', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },

  vibeCardWrap: { alignItems: 'center', marginVertical: 12 },
  vibeCard: { width: width - 80, padding: 20, borderRadius: 24, alignItems: 'center', borderWidth: 1, borderColor: '#C4A882' },
  vibeEmoji: { fontSize: 32, marginBottom: 8 },
  vibeText: { fontSize: 14, fontWeight: '800', color: '#3D2B1F', textAlign: 'center' },
  vibeSender: { fontSize: 10, color: '#8C6246', marginTop: 4, fontWeight: '700' },

  vibeTrigger: { backgroundColor: 'rgba(196, 168, 130, 0.1)', marginHorizontal: 16, marginVertical: 8, paddingVertical: 12, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(196, 168, 130, 0.3)' },
  vibeTriggerText: { color: '#C4A882', fontSize: 11, fontWeight: '900', letterSpacing: 1 },

  inputContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  input: { flex: 1, color: '#FFF', fontSize: 16, minHeight: 44, paddingVertical: 12 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#C4A882', justifyContent: 'center', alignItems: 'center' },

  sheetOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end', zIndex: 100 },
  sheetContent: { backgroundColor: '#1A1A1A', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
  sheetTitle: { color: '#FFF', fontSize: 20, fontWeight: '900', marginBottom: 20, textAlign: 'center' },
  vibeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  vibeOption: { width: '30%', alignItems: 'center', gap: 8, paddingVertical: 12 },
  vibeOptionEmoji: { fontSize: 28 },
  vibeOptionLabel: { color: '#888', fontSize: 10, fontWeight: '800', textAlign: 'center' },
});
