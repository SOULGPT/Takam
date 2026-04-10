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
  Modal,
  Alert,
  Dimensions,
  ImageBackground,
  Image,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Swipeable } from 'react-native-gesture-handler';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useStore, BOND_META, CHAT_THEMES, ChatThemeOption } from '../store/useStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { playSound } from '../lib/sound';

type Message = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_system?: boolean;
  reply_to_id?: string;
  is_pinned?: boolean;
};

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const { session, profile, activeBondId, bonds, bondMembers, updateBond } = useStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  
  // Context Menu State
  const [contextMenuMsg, setContextMenuMsg] = useState<Message | null>(null);
  const [contextPos, setContextPos] = useState({ x: 0, y: 0 });
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;

  // Theme State
  const [themePickerVisible, setThemePickerVisible] = useState(false);
  const activeBond = bonds.find((b) => b.id === activeBondId);
  const activeBondKey = activeBond?.theme || 'classic';
  const th = CHAT_THEMES[activeBondKey as ChatThemeOption] || CHAT_THEMES.classic;

  const handleChangeTheme = async (newTheme: ChatThemeOption) => {
    setThemePickerVisible(false);
    if (!activeBondId || !session?.user || !activeBond) return;
    
    updateBond({ ...activeBond, theme: newTheme }); 
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await supabase.from('bonds').update({ theme: newTheme }).eq('id', activeBondId);
    
    const sysMsg: Message = {
      id: `sys-${Date.now()}`,
      sender_id: session.user.id,
      content: `[TAKAM SYSTEM] @${profile?.username || 'User'} changed the theme to ${CHAT_THEMES[newTheme].name} ✨`,
      created_at: new Date().toISOString(),
      is_system: true,
    };
    setMessages(prev => [sysMsg, ...prev]);

    await supabase.from('messages').insert({
      bond_id: activeBondId,
      sender_id: session.user.id,
      content: sysMsg.content,
      is_system: true
    });
  };

  const partnerProfile = activeBondId ? bondMembers[activeBondId] : null;

  const openContextMenu = (msg: Message, e: any) => {
    const y = e.nativeEvent.pageY;
    const x = e.nativeEvent.pageX;
    
    // Clamp Y to prevent clipping at the extreme top/bottom
    const { height, width } = Dimensions.get('window');
    const clampedY = Math.min(Math.max(y, 150), height - 250); 
    
    setContextPos({ x, y: clampedY });
    setContextMenuMsg(msg);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true })
    ]).start();
  };

  const closeContextMenu = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0, duration: 150, useNativeDriver: true })
    ]).start(() => setContextMenuMsg(null));
  };

  const handleActionCopy = async () => {
    if (contextMenuMsg) await Clipboard.setStringAsync(contextMenuMsg.content);
    closeContextMenu();
  };

  const handleActionReply = () => {
    setReplyTarget(contextMenuMsg);
    closeContextMenu();
  };

  const handleActionPin = async () => {
    if (!contextMenuMsg || !activeBondId) return;
    const toggled = !contextMenuMsg.is_pinned;
    
    // Update local UI optimistic
    setMessages(prev => prev.map(m => {
      if (m.id === contextMenuMsg.id) return { ...m, is_pinned: toggled };
      if (toggled && m.is_pinned) return { ...m, is_pinned: false };
      return m;
    }));
    
    await supabase.from('messages').update({ is_pinned: false }).eq('bond_id', activeBondId); 
    if (toggled) {
      await supabase.from('messages').update({ is_pinned: true }).eq('id', contextMenuMsg.id);
    }
    closeContextMenu();
  };

  const handleActionReport = () => {
    Alert.alert('Reported', 'This message has been flagged for review by Takam.', [{ text: 'OK', onPress: closeContextMenu }]);
  };

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
      reply_to_id: replyTarget?.id,
    };
    setMessages((prev) => [newMsg, ...prev]);
    setReplyTarget(null);

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          bond_id: activeBondId,
          sender_id: session.user.id,
          content: txt,
          reply_to_id: replyTarget?.id || null,
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
      const isMilestone = item.content.toLowerCase().includes('milestone');
      
      if (isMilestone) {
        return (
          <View style={styles.milestoneContainer}>
            <View style={styles.milestoneIconBox}>
              <Text style={{ fontSize: 32 }}>❤️</Text>
            </View>
            <Text style={styles.milestoneTitle}>New Milestone Unlocked</Text>
            <Text style={styles.milestoneDesc}>{item.content.replace('[TAKAM SYSTEM]', '').trim()}</Text>
          </View>
        );
      }

      return (
        <View style={styles.systemBubbleWrap}>
          <View style={styles.systemBubble}>
             <Text style={styles.systemBubbleText}>{item.content}</Text>
          </View>
        </View>
      );
    }

    const isMe = item.sender_id === session?.user?.id;
    const parentMsg = item.reply_to_id ? messages.find(m => m.id === item.reply_to_id) : null;

    const renderRightSwipe = () => (
      <View style={{ justifyContent: 'center', paddingHorizontal: 20 }}>
         <Text style={{ fontSize: 24, opacity: 0.5 }}>↩️</Text>
      </View>
    );

    return (
      <Swipeable
        renderRightActions={isMe ? renderRightSwipe : undefined}
        renderLeftActions={!isMe ? renderRightSwipe : undefined}
        onSwipeableOpen={() => {
          setReplyTarget(item);
          Haptics.selectionAsync();
        }}
      >
        <View style={[styles.bubbleWrap, isMe ? styles.bubbleMeWrap : styles.bubbleThemWrap]}>
          <View style={{ maxWidth: '85%' }}>
            {/* Meta Row: Name + Time above bubble */}
            <View style={[styles.bubbleMeta, isMe ? styles.bubbleMetaMe : null]}>
              {!isMe && <Text style={styles.bubbleName}>{partnerName}</Text>}
              <Text style={styles.bubbleTime}>
                {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
              {isMe && <Text style={styles.bubbleName}>YOU</Text>}
            </View>

            <TouchableOpacity 
              activeOpacity={0.85}
              delayLongPress={250}
              onLongPress={(e) => openContextMenu(item, e)}
              style={[
                styles.bubble, 
                isMe ? styles.bubbleMe : styles.bubbleThem, 
                { backgroundColor: isMe ? th.myBubbleColor : th.themBubbleColor }
              ]}
            >
              {parentMsg && (
                <View style={[styles.bubbleReplyInner, { backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)' }]}>
                  <Text style={[styles.bubbleReplyName, { color: isMe ? th.myBubbleText : th.themBubbleText }]}>{parentMsg.sender_id === session?.user?.id ? 'You' : partnerName}</Text>
                  <Text style={[styles.bubbleReplyText, { color: isMe ? th.myBubbleText : th.themBubbleText }]} numberOfLines={1}>{parentMsg.content}</Text>
                </View>
              )}
              <Text style={[styles.bubbleText, isMe ? styles.bubbleMeText : null, { color: isMe ? th.myBubbleText : th.themBubbleText }]}>{item.content}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Swipeable>
    );
  };

  const pinnedMessage = messages.find(m => m.is_pinned);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient colors={th.bgColors} style={StyleSheet.absoluteFill} />
      
      <ImageBackground 
        source={require('../assets/chat-bg-pattern.png')} 
        style={StyleSheet.absoluteFill}
        imageStyle={{ opacity: 0.04, tintColor: th.textColor }}
        resizeMode="repeat"
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: th.borderColor }]}>
        <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
        
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: th.textColor }]}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <View style={[styles.headerAvatarContainer, { borderColor: th.myBubbleColor }]}>
            {partnerProfile?.avatar_url ? (
              <Image source={{ uri: partnerProfile.avatar_url }} style={styles.headerAvatar} />
            ) : (
              <View style={[styles.headerAvatar, { backgroundColor: th.myBubbleColor }]}>
                <Text style={styles.headerAvatarText}>
                  {partnerInitial}
                </Text>
              </View>
            )}
            <View style={[styles.onlineIndicator, isPartnerOnline && styles.onlineIndicatorActive]} />
          </View>
          
          <View>
            <Text style={[styles.headerTitle, { color: th.textColor }]}>{partnerName}</Text>
            <Text style={styles.headerStatus}>{isPartnerOnline ? 'Online' : 'Offline'}</Text>
          </View>
        </View>

        <TouchableOpacity onPress={() => setThemePickerVisible(true)}>
          <Text style={{ fontSize: 24 }}>🎨</Text>
        </TouchableOpacity>
      </View>

      {/* Pinned Message */}
      {pinnedMessage && (
        <View style={styles.pinnedBanner}>
          <Text style={styles.pinnedIcon}>📌</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.pinnedLabel}>Pinned Message</Text>
            <Text style={styles.pinnedText} numberOfLines={1}>{pinnedMessage.content}</Text>
          </View>
        </View>
      )}

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

      {/* Context Menu Modal */}
      <Modal visible={!!contextMenuMsg} transparent animationType="none" onRequestClose={closeContextMenu}>
        <View style={StyleSheet.absoluteFill}>
          <Animated.View style={[styles.contextBackdrop, { opacity: fadeAnim }]}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeContextMenu} activeOpacity={1} />
          </Animated.View>
          
          <Animated.View style={[
            styles.contextMenu, 
            { 
              top: contextPos.y - 60,
              transform: [{ scale: scaleAnim }],
              opacity: fadeAnim
            }
          ]}>
             <Text style={styles.contextHeader}>Options</Text>
             <Text style={styles.contextSnippet} numberOfLines={1}>{contextMenuMsg?.content}</Text>
             
             <View style={styles.contextButtonGroup}>
                <TouchableOpacity style={styles.contextButton} onPress={handleActionReply}>
                  <Text style={styles.contextButtonText}>↩️ Reply</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contextButton} onPress={handleActionCopy}>
                  <Text style={styles.contextButtonText}>📋 Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contextButton} onPress={handleActionPin}>
                  <Text style={styles.contextButtonText}>{contextMenuMsg?.is_pinned ? '📌 Unpin' : '📌 Pin to Top'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.contextButton, { borderBottomWidth: 0 }]} onPress={handleActionReport}>
                  <Text style={[styles.contextButtonText, { color: '#D32F2F' }]}>⚠️ Report</Text>
                </TouchableOpacity>
             </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Theme Picker Modal */}
      <Modal visible={themePickerVisible} animationType="slide" transparent onRequestClose={() => setThemePickerVisible(false)}>
         <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: th.headerBgColor, padding: 24, paddingBottom: insets.bottom + 24, borderTopLeftRadius: 32, borderTopRightRadius: 32 }}>
               <Text style={{ fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 20, color: th.textColor }}>Select Chat Theme</Text>
               <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
                  {(Object.keys(CHAT_THEMES) as ChatThemeOption[]).map(key => {
                    const themeObj = CHAT_THEMES[key];
                    return (
                       <TouchableOpacity key={key} onPress={() => handleChangeTheme(key)} style={{ width: 80, alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <LinearGradient colors={themeObj.bgColors} style={{ width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: activeBondKey === key ? '#C9705A' : th.borderColor }} />
                          <Text style={{ fontSize: 12, fontWeight: '600', color: th.textColor }}>{themeObj.name}</Text>
                       </TouchableOpacity>
                    );
                  })}
               </View>
               <TouchableOpacity onPress={() => setThemePickerVisible(false)} style={{ marginTop: 24, padding: 16, backgroundColor: th.inputBgColor, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: th.borderColor }}>
                 <Text style={{ fontWeight: '700', color: th.textColor }}>Cancel</Text>
               </TouchableOpacity>
            </View>
         </View>
      </Modal>

      {/* Input Area Group */}
      <View style={[styles.inputAreaWrapper, { paddingBottom: insets.bottom + 16 }]}>
        {replyTarget && (
          <View style={[styles.replyBanner, { backgroundColor: th.inputBgColor, borderLeftColor: th.myBubbleColor }]}>
            <View style={styles.replyBannerContent}>
              <Text style={[styles.replyBannerLabel, { color: th.myBubbleColor }]}>
                Replying to {replyTarget.sender_id === session?.user?.id ? 'yourself' : partnerName}
              </Text>
              <Text style={styles.replyBannerSnippet} numberOfLines={1}>
                {replyTarget.content}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReplyTarget(null)} style={styles.replyBannerClose}>
              <Text style={{ fontSize: 18, color: th.textColor }}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.inputFloatContainer, { backgroundColor: th.headerBgColor, borderColor: th.borderColor }]}>
          {/* Attachment Button */}
          <TouchableOpacity style={styles.inputActionBtn} activeOpacity={0.8}>
            <Text style={{ fontSize: 24 }}>🖼️</Text>
          </TouchableOpacity>

          <TextInput
            style={[styles.input, { color: th.textColor }]}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Share a thought..."
            placeholderTextColor={th.textColor + '80'}
            multiline
            onKeyPress={(e) => {
              if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter') {
                // @ts-ignore
                if (!e.nativeEvent.shiftKey) { e.preventDefault(); handleSend(); }
              }
            }}
          />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <TouchableOpacity style={styles.inputSecondaryBtn}>
              <Text style={{ fontSize: 20, opacity: 0.6 }}>😊</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.sendBtn, (!inputText.trim() || sending) && { opacity: 0.5 }]}
              onPress={handleSend}
              disabled={!inputText.trim() || sending}
            >
              <LinearGradient
                colors={[th.myBubbleColor, th.myBubbleColor + 'CC']}
                style={styles.sendBtnGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.sendIcon}>➔</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
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
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: '#D9BC8A',
    backgroundColor: 'transparent', // Using BlurView
  },
  backBtn: { marginRight: 8, padding: 8 },
  backText: { fontSize: 24, fontWeight: '600', color: '#8C6246' },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerAvatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    padding: 3,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 27,
  },
  headerAvatarText: { fontSize: 22, fontWeight: '800', color: '#FDFAF4' },
  headerTitle: { fontSize: 19, fontWeight: '800', color: '#3D2B1F' },
  headerStatus: { fontSize: 10, fontWeight: '700', color: '#8C6246', letterSpacing: 1, textTransform: 'uppercase', opacity: 0.8 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerActionBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EDD9B8', justifyContent: 'center', alignItems: 'center' },
  onlineIndicator: { position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#B5947A', borderWidth: 2, borderColor: '#F5ECD7' },
  onlineIndicatorActive: { backgroundColor: '#4CAF50' },

  // List
  listContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120, gap: 12 },
  
  // Bubbles
  bubbleWrap: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  bubbleMeWrap: { justifyContent: 'flex-end' },
  bubbleThemWrap: { justifyContent: 'flex-start' },
  
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, marginLeft: 4 },
  bubbleMetaMe: { alignSelf: 'flex-end', marginRight: 4 },
  bubbleName: { fontSize: 12, fontWeight: '800', color: '#8C6246', textTransform: 'uppercase', letterSpacing: 1 },
  bubbleTime: { fontSize: 10, color: '#B5947A' },

  bubble: {
    maxWidth: '100%',
    padding: 20,
    shadowColor: '#3D2B1F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
    borderRadius: 24,
  },
  bubbleMe: {
    borderBottomRightRadius: 8,
  },
  bubbleThem: {
    borderBottomLeftRadius: 8,
  },
  bubbleText: { fontSize: 16, lineHeight: 24, color: '#3D2B1F' },
  bubbleMeText: { color: '#FDFAF4' },

  // Input Area Wrapper
  inputAreaWrapper: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    paddingHorizontal: 20,
    backgroundColor: 'transparent'
  },
  inputFloatContainer: {
    padding: 8,
    borderRadius: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#3D2B1F',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 10,
    borderWidth: 1,
  },
  replyBanner: { 
    marginBottom: 8, 
    padding: 12, 
    borderRadius: 20, 
    flexDirection: 'row', 
    alignItems: 'center',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2
  },
  replyBannerContent: { flex: 1, paddingLeft: 12 },
  replyBannerLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 2 },
  replyBannerSnippet: { fontSize: 13, color: '#8C6246', opacity: 0.8 },
  replyBannerClose: { padding: 8 },

  input: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    maxHeight: 120,
  },
  inputActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#D3FBDA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputSecondaryBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  sendBtnGrad: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendIcon: { fontSize: 18, color: '#FDFAF4', fontWeight: '800' },

  // Interactive UI Styles
  replyBannerCloseText: { fontSize: 18, color: '#8C6246', fontWeight: 'bold' },

  pinnedBanner: { flexDirection: 'row', backgroundColor: '#FDFAF4', borderBottomWidth: 1.5, borderBottomColor: '#D9BC8A', paddingHorizontal: 20, paddingVertical: 12, alignItems: 'center', gap: 12 },
  pinnedIcon: { fontSize: 18 },
  pinnedLabel: { fontSize: 11, fontWeight: '700', color: '#C9705A', textTransform: 'uppercase' },
  pinnedText: { fontSize: 13, color: '#3D2B1F', fontWeight: '500' },

  contextBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(26, 21, 19, 0.4)' },
  contextMenu: { position: 'absolute', right: 40, width: 250, backgroundColor: '#FDFAF4', borderRadius: 20, padding: 8, shadowColor: '#000', shadowOffset: { height: 10, width: 0 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 15 },
  contextHeader: { fontSize: 12, fontWeight: '700', color: '#C5A870', textAlign: 'center', paddingTop: 12, paddingBottom: 8, textTransform: 'uppercase' },
  contextButtonGroup: { backgroundColor: '#F5ECD7', borderRadius: 12, overflow: 'hidden' },
  contextButton: { paddingVertical: 16, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EDD9B8' },
  contextButtonText: { fontSize: 16, fontWeight: '600', color: '#C9705A' },
  contextSnippet: { fontSize: 14, color: '#8C6246', textAlign: 'center', paddingHorizontal: 16, paddingBottom: 16, fontStyle: 'italic' },
  
  systemBubbleWrap: { alignItems: 'center', marginVertical: 16 },
  systemBubble: { backgroundColor: '#EDD9B8', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  systemBubbleText: { fontSize: 12, fontWeight: '700', color: '#8C6246', textAlign: 'center' },

  milestoneContainer: { alignItems: 'center', marginVertical: 32, paddingHorizontal: 40 },
  milestoneIconBox: { width: 80, height: 80, backgroundColor: '#EDD9B8', borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 12, transform: [{ rotate: '3deg' }] },
  milestoneTitle: { fontSize: 18, fontWeight: '800', color: '#3D2B1F', marginBottom: 4 },
  milestoneDesc: { fontSize: 13, color: '#8C6246', textAlign: 'center', opacity: 0.8 },
});
