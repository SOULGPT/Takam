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
import { Swipeable, PanGestureHandler, GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useStore, BOND_META, CHAT_THEMES, ChatThemeOption } from '../store/useStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { playSound } from '../lib/sound';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { startRecording as walkieStartRecording, stopRecording as walkieStopRecording } from '../lib/walkieTalkie';
import chatPattern from '../assets/chat-bg-pattern.png';

type Message = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_system?: boolean;
  reply_to_id?: string;
  is_pinned?: boolean;
  media_url?: string;
  media_type?: 'text' | 'image' | 'audio';
};

// ── Audio Bubble Helper ──────────────────────────────────────────────────────
const AudioBubble = ({ uri, isMe, theme }: { uri: string, isMe: boolean, theme: any }) => {
  const [playing, setPlaying] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [pos, setPos] = useState(0);
  const [duration, setDuration] = useState(1);

  useEffect(() => {
    return () => { if (sound) sound.unloadAsync(); };
  }, [sound]);

  const togglePlayback = async () => {
    if (sound) {
      if (playing) await sound.pauseAsync();
      else await sound.playAsync();
      setPlaying(!playing);
    } else {
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true },
        (status: any) => {
          if (status.isLoaded) {
            setPos(status.positionMillis);
            setDuration(status.durationMillis || 1);
            if (status.didJustFinish) {
              setPlaying(false);
              newSound.setPositionAsync(0);
            }
          }
        }
      );
      setSound(newSound);
      setPlaying(true);
    }
  };

  const progress = (pos / duration) * 100;

  return (
    <View style={styles.audioBubbleContainer}>
      <TouchableOpacity onPress={togglePlayback} style={[styles.playBtn, { backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)' }]}>
        <Ionicons 
          name={playing ? 'pause' : 'play'} 
          size={18} 
          color={isMe ? theme.myBubbleText : theme.themBubbleText} 
        />
      </TouchableOpacity>
      <View style={styles.audioMeta}>
        <View style={styles.track}>
          <View style={[styles.progress, { width: `${progress}%`, backgroundColor: isMe ? theme.myBubbleText : theme.themBubbleText }]} />
        </View>
        <Text style={[styles.audioTime, { color: isMe ? theme.myBubbleText : theme.themBubbleText }]}>
          {Math.floor(duration / 1000)}s
        </Text>
      </View>
    </View>
  );
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
  const [recordingPreviewUri, setRecordingPreviewUri] = useState<string | null>(null);
  const [isRecordingLocked, setIsRecordingLocked] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewSound, setPreviewSound] = useState<Audio.Sound | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  
  const slideX = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(0)).current;
  const lockAnim = useRef(new Animated.Value(0)).current; 

  // Cleanup preview sound
  useEffect(() => {
    return () => { if (previewSound) previewSound.unloadAsync(); };
  }, [previewSound]);
  
  // Media State
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const recordInterval = useRef<any>(null);

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

  // ── 3. Media Helpers ────────────────────────────────────────────────────────
  const uploadFile = async (uri: string, type: 'image' | 'audio') => {
    if (!activeBondId || !session?.user) return null;
    try {
      const ext = type === 'image' ? 'jpg' : 'm4a';
      const path = `${activeBondId}/${Date.now()}.${ext}`;
      
      // Convert to base64 for upload
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      const { decode } = await import('../lib/walkieTalkie');
      const bytes = decode(base64);

      const { data, error } = await supabase.storage
        .from('chat-media')
        .upload(path, bytes, { contentType: type === 'image' ? 'image/jpeg' : 'audio/m4a' });

      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('chat-media').getPublicUrl(data.path);
      return publicUrl;
    } catch (e) {
      console.error('Upload error:', e);
      return null;
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.6, // Compression as requested
    });

    if (!result.canceled && result.assets[0]) {
      const url = await uploadFile(result.assets[0].uri, 'image');
      if (url) handleSend(undefined, url, 'image');
    }
  };

  const startRecording = async () => {
    try {
      const started = await walkieStartRecording();
      if (!started) return;

      setIsRecording(true);
      setRecordDuration(0);
      recordInterval.current = setInterval(() => {
        setRecordDuration(d => d + 1);
      }, 1000);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {
      console.error('Record start error:', e);
    }
  };

  const stopRecording = async (shouldCancel: boolean = false, andPreview: boolean = false) => {
    try {
      const uri = await walkieStopRecording();
      setIsRecording(false);
      setIsRecordingLocked(false);
      if (recordInterval.current) clearInterval(recordInterval.current);

      if (shouldCancel) {
        if (uri) await FileSystem.deleteAsync(uri).catch(() => {});
        return;
      }

      if (andPreview && uri) {
        setRecordingPreviewUri(uri);
        return;
      }

      if (uri) {
        const url = await uploadFile(uri, 'audio');
        if (url) handleSend(undefined, url, 'audio');
        playSound('voice_sent');
      }
    } catch (err) {
      console.error('Stop recording error', err);
    }
  };

  const handlePreviewPlay = async () => {
    if (!recordingPreviewUri) return;
    if (previewPlaying && previewSound) {
      await previewSound.pauseAsync();
      setPreviewPlaying(false);
      return;
    }
    
    if (previewSound) {
      await previewSound.playAsync();
      setPreviewPlaying(true);
    } else {
      const { sound } = await Audio.Sound.createAsync(
        { uri: recordingPreviewUri },
        { shouldPlay: true },
        (status: any) => {
          if (status.isLoaded && status.didJustFinish) {
            setPreviewPlaying(false);
            sound.setPositionAsync(0);
          }
        }
      );
      setPreviewSound(sound);
      setPreviewPlaying(true);
    }
  };

  const handleSendPreview = async () => {
    if (!recordingPreviewUri) return;
    const uri = recordingPreviewUri;
    setRecordingPreviewUri(null);
    if (previewSound) {
      await previewSound.unloadAsync();
      setPreviewSound(null);
    }
    const url = await uploadFile(uri, 'audio');
    if (url) handleSend(undefined, url, 'audio');
    playSound('voice_sent');
  };

  const handleDiscardPreview = async () => {
    if (!recordingPreviewUri) return;
    const uri = recordingPreviewUri;
    setRecordingPreviewUri(null);
    if (previewSound) {
      await previewSound.unloadAsync();
      setPreviewSound(null);
    }
    await FileSystem.deleteAsync(uri).catch(() => {});
  };

  // ── 4. Send Message ─────────────────────────────────────────────────────────
  const handleSend = async (overrideText?: string, mediaUrl?: string, mediaType: 'text' | 'image' | 'audio' = 'text') => {
    const txt = (overrideText ?? inputText).trim();
    if (!mediaUrl && !txt) return;
    if (!session?.user || !activeBondId || sending) return;

    setSending(true);
    if (!mediaUrl) setInputText('');
    playSound('send');

    // Optimistic UI
    const optId = `temp-${Date.now()}`;
    const newMsg: Message = {
      id: optId,
      sender_id: session.user.id,
      content: txt || '', // DB now allows NULL, but we keep empty string for UI consistency
      created_at: new Date().toISOString(),
      reply_to_id: replyTarget?.id,
      media_url: mediaUrl,
      media_type: mediaType,
    };
    setMessages((prev) => [newMsg, ...prev]);
    const currentReplyTo = replyTarget?.id || null;
    setReplyTarget(null);

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          bond_id: activeBondId,
          sender_id: session.user.id,
          content: txt || null, // Pass NULL to DB if no text
          reply_to_id: currentReplyTo,
          media_url: mediaUrl,
          media_type: mediaType,
        })
        .select()
        .single();
      
      if (error) {
        console.error('Insert error details:', error);
        throw error;
      }
      if (data) {
        setMessages((prev) => prev.map((m) => (m.id === optId ? (data as Message) : m)));
      }
    } catch (e: any) {
      console.error('Full Send Error Details:', e);
      Alert.alert('Send Failed', `Couldn't send your message: ${e.message || 'Unknown error'}`);
      setMessages((prev) => prev.filter((m) => m.id !== optId));
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
              <Ionicons name="heart" size={32} color={th.myBubbleColor} />
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

    const renderMediaContent = () => {
      if (item.media_type === 'image') {
        return (
          <TouchableOpacity onPress={() => {/* Expand View */}}>
            <Image source={{ uri: item.media_url }} style={styles.bubbleImage} />
          </TouchableOpacity>
        );
      }
      if (item.media_type === 'audio') {
        return <AudioBubble uri={item.media_url!} isMe={isMe} theme={th} />;
      }
      return <Text style={[styles.bubbleText, { color: isMe ? th.myBubbleText : th.themBubbleText }]}>{item.content}</Text>;
    };

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
                item.media_type === 'image' && styles.bubbleImageContainer,
                { backgroundColor: isMe ? th.myBubbleColor : th.themBubbleColor }
              ]}
            >
              {parentMsg && (
                <View style={[styles.bubbleReplyInner, { backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)' }]}>
                  <Text style={[styles.bubbleReplyName, { color: isMe ? th.myBubbleText : th.themBubbleText }]}>{parentMsg.sender_id === session?.user?.id ? 'You' : partnerName}</Text>
                  <Text style={[styles.bubbleReplyText, { color: isMe ? th.myBubbleText : th.themBubbleText }]} numberOfLines={1}>{parentMsg.content}</Text>
                </View>
              )}
              {renderMediaContent()}
            </TouchableOpacity>
          </View>
        </View>
      </Swipeable>
    );
  };

  const pinnedMessage = messages.find(m => m.is_pinned);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={[styles.root, { paddingBottom: insets.bottom }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <LinearGradient colors={th.bgColors} style={StyleSheet.absoluteFill} />
        
        <ImageBackground 
          source={chatPattern} 
          style={StyleSheet.absoluteFill}
          imageStyle={{ opacity: 0.04, tintColor: th.textColor }}
          resizeMode="repeat"
        />

      {/* ── Ref 4 Ultra-Clean Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: th.headerBgColor }]}>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={th.textColor} />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <TouchableOpacity style={[styles.headerAvatarContainer, { borderColor: th.myBubbleColor, backgroundColor: '#EEE' }]}>
            {partnerProfile?.avatar_url ? (
              <Image source={{ uri: partnerProfile.avatar_url }} style={styles.headerAvatar} />
            ) : (
              <View style={[styles.headerAvatar, { backgroundColor: th.myBubbleColor }]}>
                <Text style={styles.headerAvatarText}>{partnerInitial}</Text>
              </View>
            )}
            <View style={[styles.onlineIndicator, isPartnerOnline && styles.onlineIndicatorActive]} />
          </TouchableOpacity>
          
          <View>
            <Text style={[styles.headerTitle, { color: th.textColor }]}>Looming Bonds</Text>
            <Text style={[styles.headerStatus, { color: th.myBubbleColor }]}>BONDED WITH {partnerName.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
           <TouchableOpacity style={styles.headerActionBtn}>
             <Ionicons name="videocam-outline" size={22} color={th.textColor} />
           </TouchableOpacity>
           <TouchableOpacity style={styles.headerActionBtn} onPress={() => setThemePickerVisible(true)}>
             <Ionicons name="ellipsis-vertical" size={20} color={th.textColor} />
           </TouchableOpacity>
        </View>
      </View>

      {/* Pinned Message */}
      {pinnedMessage && (
        <View style={styles.pinnedBanner}>
          <Ionicons name="pin" size={16} color="#BDBDBD" style={{ marginRight: 12 }} />
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
          contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]} 
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

        {/* ── Ref 4 Ultra-Clean Footer (Solid Background) ── */}
        <View style={[styles.footerContainer, { backgroundColor: th.bgColors[2], paddingBottom: insets.bottom + 8 }]}>
          {replyTarget && !isRecording && !recordingPreviewUri && (
            <View style={[styles.replyBanner, { backgroundColor: '#FFF', borderLeftColor: th.myBubbleColor }]}>
               <View style={styles.replyBannerContent}>
                  <Text style={[styles.replyBannerLabel, { color: th.myBubbleColor }]}>REPLYING TO {replyTarget.sender_id === session?.user?.id ? 'YOU' : partnerName.toUpperCase()}</Text>
                  <Text style={styles.replyBannerSnippet} numberOfLines={1}>{replyTarget.content}</Text>
               </View>
               <TouchableOpacity onPress={() => setReplyTarget(null)} style={styles.replyBannerClose}>
                 <Ionicons name="close" size={20} color="#888" />
               </TouchableOpacity>
            </View>
          )}

          {/* ── Preview Mode ── */}
          {recordingPreviewUri ? (
            <View style={styles.previewPill}>
              <TouchableOpacity style={styles.discardBtn} onPress={handleDiscardPreview}>
                <Ionicons name="trash-outline" size={22} color="#FF3B30" />
              </TouchableOpacity>
              
              <View style={styles.previewCenter}>
                <TouchableOpacity onPress={handlePreviewPlay} style={styles.previewPlayBtn}>
                  <Ionicons name={previewPlaying ? "pause" : "play"} size={24} color={th.myBubbleColor} />
                </TouchableOpacity>
                <Text style={styles.previewText}>Recording Ready</Text>
              </View>

              <TouchableOpacity style={styles.previewSendBtn} onPress={handleSendPreview}>
                <Ionicons name="send" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.pillContainer}>
              {/* 1. Add Button */}
              {!isRecording && (
                <TouchableOpacity style={styles.pillImageBtn} onPress={handlePickImage} activeOpacity={0.7}>
                  <Ionicons name="add" size={24} color={th.textColor} />
                </TouchableOpacity>
              )}

              {/* 2. Text Input / Recording Center */}
              <View style={styles.pillCenter}>
                {isRecording ? (
                  <View style={styles.pillRecordingInfo}>
                     <View style={styles.recordDot} />
                     <Text style={[styles.recordTime, { color: th.textColor }]}>{Math.floor(recordDuration / 60)}:{String(recordDuration % 60).padStart(2, '0')}</Text>
                     
                     {!isRecordingLocked ? (
                       <Animated.View style={{ transform: [{ translateX: slideX }], marginLeft: 20 }}>
                          <Text style={styles.slideCancelText}>‹ SLIDE TO CANCEL</Text>
                       </Animated.View>
                     ) : (
                       <Text style={[styles.slideCancelText, { marginLeft: 20, color: '#FF3B30' }]}>RECORDING LOCKED</Text>
                     )}
                  </View>
                ) : (
                  <TextInput
                    style={[styles.input, { color: th.textColor }]}
                    value={inputText}
                    placeholder="Share a thought..."
                    placeholderTextColor="#999"
                    multiline
                    onChangeText={setInputText}
                  />
                )}
              </View>

              {/* 3. Actions (Mic/Send/Emoji) */}
              <View style={styles.pillActions}>
                {isRecordingLocked ? (
                   <TouchableOpacity style={styles.pillStopBtn} onPress={() => stopRecording(false, true)}>
                      <Ionicons name="stop" size={20} color="#FF3B30" />
                   </TouchableOpacity>
                ) : (
                  <>
                    {!inputText.trim() && !isRecording && (
                      <TouchableOpacity style={styles.pillSmallBtn}>
                        <Feather name="smile" size={20} color="#666" />
                      </TouchableOpacity>
                    )}

                    {inputText.trim() ? (
                      <TouchableOpacity style={styles.pillSendBtn} onPress={() => handleSend()}>
                         <Ionicons name="arrow-forward" size={22} color="#FFF" />
                      </TouchableOpacity>
                    ) : (
                      <View style={{ alignItems: 'center' }}>
                         {/* Lock Icon Animation */}
                         {isRecording && (
                           <Animated.View style={{ position: 'absolute', top: -60, opacity: Animated.divide(Animated.multiply(slideY, -1), 80) }}>
                              <Ionicons name="lock-closed" size={24} color={th.myBubbleColor} />
                           </Animated.View>
                         )}

                         <PanGestureHandler
                          onGestureEvent={(e) => {
                            const x = e.nativeEvent.translationX;
                            const y = e.nativeEvent.translationY;
                            if (x < 0) slideX.setValue(x);
                            if (y < 0) slideY.setValue(y);
                            
                            // Check Lock
                            if (y < -80 && !isRecordingLocked) {
                              setIsRecordingLocked(true);
                              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                              Animated.spring(slideY, { toValue: 0, useNativeDriver: Platform.OS !== 'web' }).start();
                            }
                          }}
                          onHandlerStateChange={(e) => {
                            if (e.nativeEvent.state === 2) {
                              startRecording();
                            } else if (e.nativeEvent.state === 5) {
                              if (isRecordingLocked) return; // Keep recording
                              
                              const shouldCancel = e.nativeEvent.translationX < -100;
                              stopRecording(shouldCancel);
                              Animated.parallel([
                                Animated.spring(slideX, { toValue: 0, useNativeDriver: false }),
                                Animated.spring(slideY, { toValue: 0, useNativeDriver: false }),
                              ]).start();
                            }
                          }}
                        >
                          <Animated.View style={[
                            styles.pillMicBtn, 
                            isRecording && { transform: [{ scale: 1.25 }], backgroundColor: '#9B3D2C' },
                            { transform: [{ translateY: slideY }] }
                          ]}>
                            <Ionicons name="mic-outline" size={24} color={isRecording ? '#FFF' : '#666'} />
                          </Animated.View>
                        </PanGestureHandler>
                      </View>
                    )}
                  </>
                )}
              </View>
            </View>
          )}
        </View>
    </KeyboardAvoidingView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    zIndex: 10,
  },
  backBtn: { marginRight: 8, padding: 4 },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerAvatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    padding: 2,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },
  headerAvatarText: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  headerTitle: { fontSize: 17, fontWeight: '800', marginBottom: 2 },
  headerStatus: { fontSize: 9, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  headerActions: { flexDirection: 'row', gap: 6 },
  headerActionBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.03)', justifyContent: 'center', alignItems: 'center' },
  onlineIndicator: { position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: 5.5, backgroundColor: '#BDBDBD', borderWidth: 2, borderColor: '#FFF' },
  onlineIndicatorActive: { backgroundColor: '#4CAF50' },
  
  listContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120, gap: 10 },
  
  // Footer & Input Pill
  footerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.03)',
  },
  pillContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
  },
  pillImageBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillCenter: {
    flex: 1,
    paddingHorizontal: 8,
  },
  input: {
    fontSize: 16,
    maxHeight: 120,
    paddingVertical: 10,
  },
  pillActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
  },
  pillSmallBtn: {
    padding: 10,
  },
  pillMicBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillSendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF', // Clean blue for send from Ref 4
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  pillRecordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    marginRight: 10,
  },
  recordTime: {
    fontWeight: '700',
    fontSize: 15,
  },
  slideCancelText: {
    color: '#999',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Message Bubbles
  bubbleWrap: { flexDirection: 'row', marginBottom: 16 },
  bubbleMeWrap: { justifyContent: 'flex-end' },
  bubbleThemWrap: { justifyContent: 'flex-start' },
  
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, paddingHorizontal: 4 },
  bubbleMetaMe: { alignSelf: 'flex-end' },
  bubbleName: { fontSize: 10, fontWeight: '800', color: '#888', textTransform: 'uppercase' },
  bubbleTime: { fontSize: 9, color: '#BBB' },

  bubble: {
    maxWidth: '85%',
    padding: 14,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  bubbleMe: {
    backgroundColor: '#9B3D2C',
    borderBottomRightRadius: 4, // Tail effect
  },
  bubbleThem: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4, // Tail effect
  },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  bubbleImageContainer: { padding: 4 },
  bubbleImage: { width: 220, height: 160, borderRadius: 14 },

  // Secondary UI
  replyBanner: { 
    marginBottom: 8, 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderRadius: 16, 
    padding: 12,
    borderLeftWidth: 4,
  },
  replyBannerContent: { flex: 1, paddingLeft: 8 },
  replyBannerLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5, marginBottom: 2 },
  replyBannerSnippet: { fontSize: 13, opacity: 0.6 },
  replyBannerClose: { padding: 4 },

  pinnedBanner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 10, 
    paddingHorizontal: 16, 
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
  },
  pinnedLabel: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', opacity: 0.4 },
  pinnedText: { fontSize: 13, fontWeight: '600', marginLeft: 8 },

  contextBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  contextMenu: { position: 'absolute', width: 200, borderRadius: 20, padding: 6, backgroundColor: '#FFF', shadowColor: '#000', shadowOffset: { height: 8, width: 0 }, shadowOpacity: 0.15, shadowRadius: 16 },
  contextHeader: { fontSize: 10, fontWeight: '800', textAlign: 'center', paddingVertical: 8, opacity: 0.4, textTransform: 'uppercase' },
  contextSnippet: { fontSize: 12, textAlign: 'center', paddingBottom: 10, opacity: 0.6 },
  contextButtonGroup: { borderRadius: 14, overflow: 'hidden' },
  contextButton: { paddingVertical: 12, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.03)' },
  contextButtonText: { fontSize: 15, fontWeight: '600' },

  systemBubbleWrap: { alignItems: 'center', marginVertical: 14 },
  systemBubble: { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.03)' },
  systemBubbleText: { fontSize: 10, fontWeight: '700', opacity: 0.4, textTransform: 'uppercase' },

  milestoneContainer: { alignItems: 'center', marginVertical: 20 },
  milestoneIconBox: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 8, backgroundColor: '#F9F9F9' },
  milestoneTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A1A' },
  milestoneDesc: { fontSize: 12, textAlign: 'center', opacity: 0.6 },

  bubbleReplyInner: { padding: 8, borderRadius: 10, marginBottom: 6, backgroundColor: 'rgba(0,0,0,0.03)' },
  bubbleReplyName: { fontSize: 10, fontWeight: '800', marginBottom: 1 },
  bubbleReplyText: { fontSize: 11, opacity: 0.7 },
  
  audioBubbleContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 180 },
  playBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  audioMeta: { flex: 1, gap: 4 },
  track: { height: 3, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 2 },
  progress: { height: '100%' },
  audioTime: { fontSize: 9, fontWeight: '800' },
  previewPill: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  discardBtn: { padding: 10 },
  previewCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewPlayBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.05)', justifyContent: 'center', alignItems: 'center' },
  previewText: { fontSize: 14, fontWeight: '700', color: '#666' },
  previewSendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center' },
  pillStopBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,59,48,0.1)', justifyContent: 'center', alignItems: 'center' },
});
