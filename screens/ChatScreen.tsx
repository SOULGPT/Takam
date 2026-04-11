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
import { createAudioPlayer, useAudioRecorder, useAudioRecorderState, RecordingPresets, requestRecordingPermissionsAsync } from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { shadow } from '../lib/theme/shadows';
import { useStore, BOND_META, CHAT_THEMES, ChatThemeOption } from '../store/useStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { playSound } from '../lib/sound';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { playBurst } from '../lib/walkieTalkie';
import chatPattern from '../assets/chat-bg-pattern.png';
import { AVATARS } from '../utils/avatars';

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
  const [player] = useState(() => createAudioPlayer(uri));
  const [pos, setPos] = useState(0);
  const [duration, setDuration] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      if (player) {
         setPos(player.currentTime * 1000);
         setDuration(player.duration * 1000);
         setPlaying(player.playing);
      }
    }, 100);
    return () => {
      clearInterval(interval);
      player.pause();
      player.remove();
    };
  }, [player]);

  const togglePlayback = () => {
    if (player.playing) {
      player.pause();
    } else {
      if (player.currentTime >= player.duration) player.seekTo(0);
      player.play();
    }
  };


  const progress = (pos / duration) * 100;

  return (
    <View style={[styles.audioBubbleContainer, { backgroundColor: '#262729', borderRadius: 12, borderWidth: 1, borderColor: '#3A3B3D' }]}>
      <TouchableOpacity onPress={togglePlayback} style={{ padding: 4 }}>
        <Ionicons name={playing ? 'pause' : 'play'} size={20} color="#D2D3D5" />
      </TouchableOpacity>
      
      <View style={styles.audioMeta}>
        <View style={styles.track}>
          <View style={[styles.progress, { width: `${progress}%`, backgroundColor: '#FFF' }]} />
        </View>
        <Text style={[styles.audioTime, { color: '#E0E0E0' }]}>
          {Math.floor(pos / 1000)}:{(Math.floor(pos / 10) % 100).toString().padStart(2, '0')} / {Math.floor(duration / 1000)}:{(Math.floor(duration / 10) % 100).toString().padStart(2, '0')}
        </Text>
      </View>

      <TouchableOpacity style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#343B4B', justifyContent: 'center', alignItems: 'center' }}>
        <Ionicons name="close" size={16} color="#E0E0E0" />
      </TouchableOpacity>
    </View>
  );
};

// ── Memoized Chat Bubble ─────────────────────────────────────────────────────
// ── Memoized Chat Bubble ─────────────────────────────────────────────────────
const ChatBubble = React.memo(({
  item,
  isMe,
  parentMsg,
  partnerName,
  partnerAvatarKey,
  theme: th,
  onContextMenu,
  onReply,
  isClusteredTop,
  isClusteredBottom,
}: {
  item: Message,
  isMe: boolean,
  parentMsg: Message | null,
  partnerName: string,
  partnerAvatarKey?: string,
  theme: any,
  onContextMenu: (item: Message, e: any) => void,
  onReply: (item: Message) => void,
  isClusteredTop: boolean,
  isClusteredBottom: boolean,
}) => {
  if (item.is_system) {
    const isMilestone = item.content.toLowerCase().includes('milestone');
    const isSyncLink = item.content.includes('[SYNC-LINK]');
    
    if (isMilestone) {
      return (
        <View style={styles.milestoneContainer}>
          <View style={styles.milestoneIconBox}>
            <Ionicons name="heart" size={32} color={th.myBubbleColor} />
          </View>
          <Text style={[styles.milestoneTitle, { color: th.textColor }]}>New Milestone Unlocked</Text>
          <Text style={styles.milestoneDesc}>{item.content.replace('[TAKAM SYSTEM]', '').trim()}</Text>
        </View>
      );
    }
    
    if (isSyncLink) {
      return (
        <View style={styles.systemBubbleWrap}>
          <View style={[styles.systemBubble, { backgroundColor: '#D9BC8A', flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
            <MaterialCommunityIcons name="link-variant" size={12} color="#3D2B1F" />
            <Text style={[styles.systemBubbleText, { color: '#3D2B1F' }]}>
              {item.content.replace('[SYNC-LINK]', '').trim()}
            </Text>
          </View>
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

  const renderReplySwipe = () => (
    <View style={{ justifyContent: 'center', paddingHorizontal: 16 }}>
      <Ionicons name="arrow-undo" size={24} color="#888" style={{ opacity: 0.6 }} />
    </View>
  );

  const renderMediaContent = () => {
    if (item.media_type === 'image') {
      return (
        <TouchableOpacity onPress={() => {/* Expand View */ }}>
          <Image source={{ uri: item.media_url }} style={styles.bubbleImage} />
        </TouchableOpacity>
      );
    }
    if (item.media_type === 'audio') {
      return <AudioBubble uri={item.media_url!} isMe={isMe} theme={th} />;
    }
    return <Text style={[styles.bubbleText, { color: '#FFFFFF' }]}>{item.content}</Text>;
  };

  const showAvatar = !isMe && !isClusteredBottom;

  const clusterRadii = isMe ? {
    borderTopRightRadius: isClusteredTop ? 4 : 22,
    borderBottomRightRadius: isClusteredBottom ? 4 : 22,
    borderTopLeftRadius: 22,
    borderBottomLeftRadius: 22,
  } : {
    borderTopLeftRadius: isClusteredTop ? 4 : 22,
    borderBottomLeftRadius: isClusteredBottom ? 4 : 22,
    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,
  };

  return (
    <Swipeable
      renderRightActions={isMe ? renderReplySwipe : undefined}
      renderLeftActions={!isMe ? renderReplySwipe : undefined}
      onSwipeableOpen={() => {
        onReply(item);
        Haptics.selectionAsync();
      }}
    >
      <View style={[styles.bubbleWrap, isMe ? styles.bubbleMeWrap : styles.bubbleThemWrap, isClusteredBottom && { marginBottom: 2 }, isClusteredTop && { marginTop: 2 }]}>
        {!isMe && (
          <View style={{ width: 28, marginRight: 8, justifyContent: 'flex-end', paddingBottom: parentMsg ? 4 : 0 }}>
            {showAvatar && (
              partnerAvatarKey && AVATARS[partnerAvatarKey] ? (
                 <Image source={AVATARS[partnerAvatarKey]} style={{ width: 28, height: 28, borderRadius: 14 }} />
              ) : (
                 <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: th.myBubbleColor, justifyContent: 'center', alignItems: 'center' }}>
                   <Text style={{ color: '#FFF', fontSize: 12, fontWeight: 'bold' }}>{partnerName.charAt(0)}</Text>
                 </View>
              )
            )}
          </View>
        )}

        <View style={{ maxWidth: !isMe ? '75%' : '80%' }}>
          {parentMsg && (
            <View style={{ marginBottom: 4, marginLeft: isMe ? 0 : 12, marginRight: isMe ? 12 : 0, borderLeftWidth: !isMe ? 2 : 0, borderRightWidth: isMe ? 2 : 0, borderColor: '#555', paddingLeft: !isMe ? 8 : 0, paddingRight: isMe ? 8 : 0, alignSelf: isMe ? 'flex-end' : 'flex-start' }}>
              <Text style={{ fontSize: 11, color: '#AAA', marginBottom: 2, textAlign: isMe ? 'right' : 'left' }}>
                {parentMsg.sender_id === item.sender_id ? (isMe ? 'You replied to yourself' : `${partnerName} replied to themselves`) : (isMe ? `You replied to ${partnerName}` : `${partnerName} replied to you`)}
              </Text>
              <Text style={{ color: th.textColor, fontSize: 13, opacity: 0.8, textAlign: isMe ? 'right' : 'left' }} numberOfLines={1}>{parentMsg.content}</Text>
            </View>
          )}

          <TouchableOpacity
            activeOpacity={0.85}
            delayLongPress={250}
            onLongPress={(e) => onContextMenu(item, e)}
            style={[
              styles.bubble,
              isMe ? styles.bubbleMe : styles.bubbleThem,
              item.media_type === 'image' && styles.bubbleImageContainer,
              item.media_type !== 'audio' && { backgroundColor: isMe ? th.myBubbleColor : '#262626' },
              item.media_type === 'audio' && { backgroundColor: 'transparent', paddingHorizontal: 0, paddingVertical: 0 },
              clusterRadii
            ]}
          >
            {renderMediaContent()}
          </TouchableOpacity>
          <Text style={[
            styles.bubbleTime,
            { color: '#888', textAlign: isMe ? 'right' : 'left', marginTop: 2, marginRight: isMe ? 4 : 0, marginLeft: !isMe ? 4 : 0 }
          ]}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    </Swipeable>
  );
}, (prev, next) => 
  prev.item.id === next.item.id && 
  prev.item.is_pinned === next.item.is_pinned && 
  prev.theme.name === next.theme.name &&
  prev.isClusteredTop === next.isClusteredTop &&
  prev.isClusteredBottom === next.isClusteredBottom
);

export default function ChatScreen() {
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 500);
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const { session, profile, activeBondId, bonds, bondMembers, updateBond, userBondThemes, setUserBondTheme } = useStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [now, setNow] = useState(new Date());

  // Context Menu State
  const [contextMenuMsg, setContextMenuMsg] = useState<Message | null>(null);
  const [contextPos, setContextPos] = useState({ x: 0, y: 0 });
  const [recordingPreviewUri, setRecordingPreviewUri] = useState<string | null>(null);
  const [isRecordingLocked, setIsRecordingLocked] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewPlayer, setPreviewPlayer] = useState<any>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;

  const slideX = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(0)).current;
  const lockAnim = useRef(new Animated.Value(0)).current;

  // Cleanup preview player
  useEffect(() => {
    return () => { 
      if (previewPlayer) {
        previewPlayer.pause();
        previewPlayer.remove();
      }
    };
  }, [previewPlayer]);

  // Media State
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const recordInterval = useRef<any>(null);

  // Theme State
  const [themePickerVisible, setThemePickerVisible] = useState(false);
  const activeBond = bonds.find((b) => b.id === activeBondId);
  // Priority: User's local theme -> Bond's default theme -> classic
  const activeBondKey = (activeBondId && userBondThemes[activeBondId]) || activeBond?.theme || 'classic';
  const th = CHAT_THEMES[activeBondKey as ChatThemeOption] || CHAT_THEMES.classic;

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleChangeTheme = async (newTheme: ChatThemeOption) => {
    setThemePickerVisible(false);
    if (!activeBondId || !session?.user || !activeBond) return;

    // 1. Update local store (immediate UI update)
    setUserBondTheme(activeBondId, newTheme);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // 2. Persist to Supabase (Private preference)
    await supabase.from('user_chat_preferences').upsert({
      user_id: session.user.id,
      bond_id: activeBondId,
      theme_key: newTheme,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,bond_id' });
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
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 80, useNativeDriver: Platform.OS !== 'web' })
    ]).start();
  };

  const closeContextMenu = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(scaleAnim, { toValue: 0, duration: 150, useNativeDriver: Platform.OS !== 'web' })
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
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('bond_id', activeBondId)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setMessages(data);
      }
      setLoading(false);
    };

    const markAsRead = async () => {
      // Clear all unread messages
      supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('bond_id', activeBondId)
        .is('read_at', null)
        .neq('sender_id', session.user.id)
        .then();

      // Clear all unread vibes
      supabase
        .from('vibes')
        .update({ read_at: new Date().toISOString() })
        .eq('bond_id', activeBondId)
        .is('read_at', null)
        .neq('sender_id', session.user.id)
        .then();
        
      useStore.getState().clearUnread(activeBondId);
    };

    fetchMessages();
    markAsRead();
  }, [activeBondId, session?.user]);

  // 1c. Transient "Poof" Timer
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000); // Check every minute
    return () => clearInterval(timer);
  }, []);

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
              if (newMessage.media_type === 'audio' && newMessage.media_url) {
                // Instantly auto-play voice notes! "The Doorbell"
                playBurst(newMessage.media_url).catch(e => console.error('Auto-play failed:', e));
              } else {
                playSound('receive');
              }
            }

            return [newMessage, ...prev];
          });
        }
      )
      .subscribe();

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
      // Polling fallback removed to massively improve performance and prevent lag
    };
  }, [activeBondId, session?.user, partnerProfile]);

  // ── 3. Media Helpers ────────────────────────────────────────────────────────
  const uploadFile = async (uri: string, type: 'image' | 'audio') => {
    if (!activeBondId || !session?.user) return null;
    try {
      const ext = uri.split('.').pop()?.toLowerCase() || (type === 'image' ? 'jpg' : 'm4a');
      const mimeType = type === 'image' ? 'image/jpeg' : (ext === 'webm' ? 'audio/webm' : 'audio/m4a');
      const path = `${activeBondId}/${Date.now()}.${ext}`;

      let blob: Blob;
      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        blob = await response.blob();
      } else {
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
        const { decode } = await import('../lib/walkieTalkie');
        const buffer = decode(base64);
        blob = new Blob([buffer], { type: mimeType });
      }

      const { data, error } = await supabase.storage
        .from('chat-media')
        .upload(path, blob, { contentType: mimeType });

      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('chat-media').getPublicUrl(data.path);
      return publicUrl;
    } catch (e: any) {
      console.error('Upload Error:', e);
      Alert.alert('Upload Error', `Failed to upload media. ${e.message || ''}`);
      return null;
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.6,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
      Haptics.selectionAsync();
    }
  };

  const handleDiscardImage = () => {
    setSelectedImage(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const startRecording = async () => {
    setIsRecording(true);
    setRecordDuration(0);
    try {
      const { status } = await requestRecordingPermissionsAsync();
      if (status !== 'granted') {
        setIsRecording(false);
        Alert.alert('Microphone Needed', 'Please enable microphone access in your settings to send voice notes.');
        return;
      }

      await recorder.prepareToRecordAsync();
      recorder.record();
      
      recordInterval.current = setInterval(() => {
        setRecordDuration((d: number) => d + 1);
      }, 1000);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {
      console.error('Record start error:', e);
      setIsRecording(false);
      Alert.alert('Recording Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async (shouldCancel: boolean = false, andPreview: boolean = false) => {
    try {
      await recorder.stop();
      const uri = recorder.uri;
      
      setIsRecording(false);
      setIsRecordingLocked(false);
      if (recordInterval.current) clearInterval(recordInterval.current);

      if (shouldCancel) {
        if (uri) await FileSystem.deleteAsync(uri).catch(() => { });
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
      setIsRecording(false);
    }
  };

  const handlePreviewPlay = () => {
    if (!recordingPreviewUri) return;
    
    let activePlayer = previewPlayer;
    if (!activePlayer) {
      activePlayer = createAudioPlayer(recordingPreviewUri);
      
      // Add status listener for cleanup and UI sync
      activePlayer.addListener('playbackStatusUpdate', (status: any) => {
        if (status.didJustFinish) {
          setPreviewPlaying(false);
          activePlayer?.seekTo(0);
        }
      });

      setPreviewPlayer(activePlayer);
    }

    if (activePlayer.playing) {
      activePlayer.pause();
      setPreviewPlaying(false);
    } else {
      if (activePlayer.currentTime >= activePlayer.duration) activePlayer.seekTo(0);
      activePlayer.play();
      setPreviewPlaying(true);
    }
  };


  const handleSendPreview = async () => {
    if (!recordingPreviewUri) return;
    const uri = recordingPreviewUri;
    setRecordingPreviewUri(null);
    if (previewPlayer) {
      previewPlayer.pause();
      previewPlayer.remove();
      setPreviewPlayer(null);
    }
    const url = await uploadFile(uri, 'audio');
    if (url) handleSend(undefined, url, 'audio');
    playSound('voice_sent');
  };

  const handleDiscardPreview = async () => {
    if (!recordingPreviewUri) return;
    const uri = recordingPreviewUri;
    setRecordingPreviewUri(null);
    if (previewPlayer) {
      previewPlayer.pause();
      previewPlayer.remove();
      setPreviewPlayer(null);
    }
    await FileSystem.deleteAsync(uri).catch(() => { });
  };

  // ── 4. Send Message ─────────────────────────────────────────────────────────
  const handleSend = async (overrideText?: string, mediaUrl?: string, mediaType: 'text' | 'image' | 'audio' = 'text') => {
    let finalMediaUrl = mediaUrl;
    let finalMediaType = mediaType;

    // Handle selected image upload if present
    if (selectedImage && !mediaUrl) {
      setIsUploading(true);
      const uploadedUrl = await uploadFile(selectedImage, 'image');
      if (!uploadedUrl) {
        setIsUploading(false);
        Alert.alert('Upload Failed', 'Could not upload your image. Please try again.');
        return;
      }
      finalMediaUrl = uploadedUrl;
      finalMediaType = 'image';
      setSelectedImage(null);
      setIsUploading(false);
    }

    const txt = (overrideText ?? inputText).trim();
    if (!finalMediaUrl && !txt) return;
    if (!session?.user || !activeBondId || sending) return;

    setSending(true);
    if (!finalMediaUrl) setInputText('');
    playSound('send');

    // Optimistic UI
    const optId = `temp-${Date.now()}`;
    const newMsg: Message = {
      id: optId,
      sender_id: session.user.id,
      content: txt || '', // DB now allows NULL, but we keep empty string for UI consistency
      created_at: new Date().toISOString(),
      reply_to_id: replyTarget?.id,
      media_url: finalMediaUrl,
      media_type: finalMediaType,
    };
    setMessages((prev: Message[]) => [newMsg, ...prev]);
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
          media_url: finalMediaUrl,
          media_type: finalMediaType,
        })
        .select()
        .single();

      if (error) {
        console.error('Insert error details:', error);
        throw error;
      }
      if (data) {
        setMessages((prev: Message[]) => prev.map((m: Message) => (m.id === optId ? (data as Message) : m)));
      }
    } catch (e: any) {
      console.error('Full Send Error Details:', e);
      Alert.alert('Send Failed', `Couldn't send your message: ${e.message || 'Unknown error'}`);
      setMessages((prev: Message[]) => prev.filter((m: Message) => m.id !== optId));
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

  const renderBubbleItem = ({ item, index }: { item: any, index: number }) => {
    if (item.type === 'date_divider') {
      return (
        <View style={styles.dateDivider}>
          <View style={styles.dateDividerLine} />
          <Text style={styles.dateDividerText}>{item.label}</Text>
          <View style={styles.dateDividerLine} />
        </View>
      );
    }

    const isMe = item.sender_id === session?.user?.id;
    const parentMsg = item.reply_to_id ? messages.find(m => m.id === item.reply_to_id) : null;
    
    // Clustering detection for bubbles of the same sender
    const isClusteredTop = index < displayItems.length - 1 && displayItems[index+1].sender_id === item.sender_id;
    const isClusteredBottom = index > 0 && displayItems[index-1].sender_id === item.sender_id;

    return (
      <ChatBubble
        item={item}
        isMe={isMe}
        parentMsg={parentMsg || null}
        partnerName={partnerName}
        partnerAvatarKey={partnerProfile.avatar_url || undefined}
        theme={th}
        onContextMenu={openContextMenu}
        onReply={(msg) => setReplyTarget(msg)}
        isClusteredTop={isClusteredTop}
        isClusteredBottom={isClusteredBottom}
      />
    );
  };

  // ── Date Grouping Logic ──
  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    if (isToday) return 'Today';
    if (isYesterday) return 'Yesterday';
    
    // DD/MM/YYYY
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const displayItems: any[] = [];
  messages.forEach((m, i) => {
    // Expiry check
    if (m.expires_at && new Date(m.expires_at) < now) return;
    
    displayItems.push(m);
    const currentDay = new Date(m.created_at).toDateString();
    const prevDay = i < messages.length - 1 ? new Date(messages[i+1].created_at).toDateString() : null;
    
    if (currentDay !== prevDay) {
      displayItems.push({
        id: `date-${m.id}`,
        type: 'date_divider',
        label: formatDateLabel(m.created_at)
      });
    }
  });

  const pinnedMessage = messages.find(m => m.is_pinned);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <LinearGradient colors={th.bgColors} style={StyleSheet.absoluteFill} />
        {activeBondKey === 'classic' && (
          <ImageBackground 
            source={chatPattern} 
            style={StyleSheet.absoluteFill} 
            tintColor="#000"
            imageStyle={{ opacity: 0.03 }} 
          />
        )}

        {/* ── Ref 4 Ultra-Clean Header ── */}
        <View style={[styles.header, { paddingTop: insets.top + 8, paddingBottom: 12, backgroundColor: 'transparent' }]}>
          <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <TouchableOpacity style={styles.headerAvatarContainer}>
              {partnerProfile?.avatar_url && AVATARS[partnerProfile.avatar_url] ? (
                <Image source={AVATARS[partnerProfile.avatar_url]} style={styles.headerAvatar} />
              ) : (
                <View style={[styles.headerAvatar, { backgroundColor: th.myBubbleColor }]}>
                  <Text style={styles.headerAvatarText}>{partnerInitial}</Text>
                </View>
              )}
              <View style={[styles.onlineIndicator, isPartnerOnline && styles.onlineIndicatorActive, { borderColor: th.headerBgColor }]} />
            </TouchableOpacity>

            <View>
              <Text style={[styles.headerTitle, { color: '#FFFFFF' }]}>{partnerName}</Text>
              <Text style={[styles.headerStatus, { color: isPartnerOnline ? '#4CAF50' : '#888' }]}>{isPartnerOnline ? 'Online' : 'Offline'}</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerActionBtn}>
              <Ionicons name="call-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerActionBtn}>
              <Ionicons name="videocam-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerActionBtn} onPress={() => setThemePickerVisible(true)}>
               <Ionicons name="information-circle-outline" size={24} color="#FFFFFF" />
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

        {/* Messages List Optimized for Performance */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#C9705A" />
          </View>
        ) : (
          <FlatList
            data={displayItems}
            keyExtractor={(item) => item.id}
            renderItem={renderBubbleItem}
            inverted={true}
            contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
            showsVerticalScrollIndicator={false}
            initialNumToRender={20}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={Platform.OS === 'android'}
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
        <View style={[styles.footerContainer, { backgroundColor: '#202124', paddingBottom: insets.bottom }]}>
          {replyTarget && !isRecording && !recordingPreviewUri && (
            <View style={[styles.replyBanner, { backgroundColor: '#1A1A1A', borderLeftColor: th.myBubbleColor }]}>
              <View style={styles.replyBannerContent}>
                <Text style={[styles.replyBannerLabel, { color: '#AAA' }]}>REPLYING TO {replyTarget.sender_id === session?.user?.id ? 'YOU' : partnerName.toUpperCase()}</Text>
                <Text style={[styles.replyBannerSnippet, { color: '#FFF' }]} numberOfLines={1}>{replyTarget.content}</Text>
              </View>
              <TouchableOpacity onPress={() => setReplyTarget(null)} style={styles.replyBannerClose}>
                <Ionicons name="close" size={20} color="#888" />
              </TouchableOpacity>
            </View>
          )}

          {/* ── Image Preview Mode ── */}
          {selectedImage && !isRecording && (
            <View style={styles.imagePreviewPill}>
              <Image source={{ uri: selectedImage }} style={styles.imagePreviewThumb} />
              <View style={styles.imagePreviewMeta}>
                <Text style={styles.imagePreviewTitle}>Image Ready</Text>
                <Text style={styles.imagePreviewSub}>Tap arrow to send with your message</Text>
              </View>
              <TouchableOpacity style={styles.discardImageBtn} onPress={handleDiscardImage}>
                <Ionicons name="close-circle" size={24} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          )}

          {/* ── Hovering Recording Popover (Antigravity Style) ── */}
          {(isRecording || recordingPreviewUri) && (
            <Animated.View style={[styles.hoverRecordingPill, { backgroundColor: '#202124', borderColor: '#333' }]}>
              {isRecording ? (
                // Live Recording UI
                <>
                  <View style={styles.hoverMicGroup}>
                    <Ionicons name="mic" size={18} color="#FF5555" />
                    <Text style={[styles.hoverRecText, { color: '#8AB4F8' }]}>Recording...</Text>
                  </View>
                  <View style={styles.hoverActionsGroup}>
                    <Text style={styles.hoverTimeText}>
                      {Math.floor(recordDuration / 60)}:{String(recordDuration % 60).padStart(2, '0')}
                    </Text>
                    {/* Send / Stop Rectangle */}
                    <TouchableOpacity style={[styles.hoverStopBtn, { backgroundColor: '#DB4B4B' }]} onPress={() => stopRecording(false, true)}>
                      <Ionicons name="square" size={12} color="#FFF" />
                    </TouchableOpacity>
                    {/* Cancel X */}
                    <TouchableOpacity style={[styles.hoverCancelBtn, { backgroundColor: '#333' }]} onPress={() => stopRecording(true, false)}>
                      <Ionicons name="close" size={18} color="#D2D3D5" />
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                // Preview UI (Before send)
                <>
                  <View style={styles.hoverMicGroup}>
                    <TouchableOpacity onPress={handlePreviewPlay} style={styles.hoverPlayPreviewBtn}>
                      <Ionicons name={previewPlaying ? "pause" : "play"} size={16} color="#FFF" />
                    </TouchableOpacity>
                    <Text style={styles.hoverRecText}>Review Voice Note</Text>
                  </View>
                  <View style={styles.hoverActionsGroup}>
                    <TouchableOpacity style={styles.hoverSendBtn} onPress={handleSendPreview}>
                      <Ionicons name="arrow-up" size={18} color="#FFF" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.hoverCancelBtn} onPress={handleDiscardPreview}>
                      <Ionicons name="close" size={18} color="#999" />
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </Animated.View>
          )}

          {/* ── Standard Text Input Pill ── */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 4, paddingVertical: 8, backgroundColor: '#202124' }}>
            {/* 1. Add Button */}
            <TouchableOpacity style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }} onPress={handlePickImage} activeOpacity={0.7}>
              <Ionicons name="add" size={26} color="#888" />
            </TouchableOpacity>

            {/* 2. Text Input Center */}
            <View style={{ flex: 1, paddingHorizontal: 4 }}>
              <TextInput
                style={{ fontSize: 16, maxHeight: 120, paddingVertical: 12, color: '#FFF' }}
                value={inputText}
                placeholder="Ask anything, @ to mention, / for workflows"
                placeholderTextColor="#666"
                multiline
                onChangeText={setInputText}
              />
            </View>

            {/* 3. Actions (Mic/Send) */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 8, paddingBottom: 6 }}>
              {!inputText.trim() && !selectedImage && (
                <TouchableOpacity 
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#DB4B4B', justifyContent: 'center', alignItems: 'center' }} 
                  onPress={startRecording}
                >
                  <Ionicons name="mic" size={18} color="#FFF" />
                </TouchableOpacity>
              )}

              {(inputText.trim() || selectedImage) ? (
                <TouchableOpacity
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center' }}
                  onPress={() => handleSend()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Ionicons name="arrow-forward" size={18} color="#FFF" />
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="arrow-forward" size={18} color="#888" />
                </TouchableOpacity>
              )}
            </View>
          </View>
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
    paddingHorizontal: 12,
  },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerAvatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  headerTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  headerStatus: { fontSize: 12, fontWeight: '500' },
  headerActions: { flexDirection: 'row', gap: 6 },
  headerActionBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  onlineIndicator: { position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: 5.5, backgroundColor: '#BDBDBD', borderWidth: 2, borderColor: '#FFF' },
  onlineIndicatorActive: { backgroundColor: '#4CAF50' },

  listContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120, gap: 10 },

  // Footer & Input Pill
  footerContainer: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  pillContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 22,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  pillImageBtn: {
    width: 44,
    height: 44,
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
    marginBottom: 4,
    gap: 12,
  },
  pillSmallBtn: {
  },
  pillMicBtn: {
  },
  pillSendBtn: {
  },
  pillRecordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordDotBlinking: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
    marginRight: 10,
    // Add a simple 'blinking' effect for Antigravity style
    opacity: 0.8,
  },
  recordTime: {
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: -0.5,
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

  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMe: {
  },
  bubbleThem: {
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
  contextMenu: { 
    position: 'absolute', 
    width: 200, 
    borderRadius: 20, 
    padding: 6, 
    backgroundColor: '#FFF', 
    ...Platform.select({
      ...shadow('#000', { height: 8, width: 0 }, 0.15, 16, 6),
      android: { elevation: 10 },
      web: { boxShadow: '0 8px 16px rgba(0,0,0,0.15)' }
    })
  },
  contextHeader: { fontSize: 10, fontWeight: '800', textAlign: 'center', paddingVertical: 8, opacity: 0.4, textTransform: 'uppercase' },
  contextSnippet: { fontSize: 12, textAlign: 'center', paddingBottom: 10, opacity: 0.6 },
  contextButtonGroup: { borderRadius: 14, overflow: 'hidden' },
  contextButton: { paddingVertical: 12, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.03)' },
  contextButtonText: { fontSize: 15, fontWeight: '600' },

  systemBubbleWrap: { alignItems: 'center', marginVertical: 14 },
  systemBubble: { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 10, backgroundColor: '#262626' },
  systemBubbleText: { fontSize: 10, fontWeight: '700', color: '#888', textTransform: 'uppercase' },

  milestoneContainer: { alignItems: 'center', marginVertical: 20 },
  milestoneIconBox: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 8, backgroundColor: '#1A1A1A' },
  milestoneTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  milestoneDesc: { fontSize: 12, textAlign: 'center', color: '#AAA' },

  bubbleReplyInner: { padding: 8, borderRadius: 10, marginBottom: 6, backgroundColor: 'rgba(0,0,0,0.03)' },
  bubbleReplyName: { fontSize: 10, fontWeight: '800', marginBottom: 1 },
  bubbleReplyText: { fontSize: 11, opacity: 0.7 },

  audioBubbleContainer: { flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 260, paddingHorizontal: 16, paddingVertical: 12 },
  playBtn: { justifyContent: 'center', alignItems: 'center' },
  audioMeta: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  track: { flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 1 },
  progress: { height: '100%' },
  audioTime: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  previewPill: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    ...Platform.select({
      ...shadow('#000', { width: 0, height: 4 }, 0.1, 12, 4),
      android: { elevation: 4 },
      web: { boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }
    }),
  },
  discardBtn: { padding: 10 },
  previewCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewPlayBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.05)', justifyContent: 'center', alignItems: 'center' },
  previewText: { fontSize: 14, fontWeight: '700', color: '#666' },
  previewSendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center' },
  pillStopBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,59,48,0.1)', justifyContent: 'center', alignItems: 'center' },

  // Image Preview
  imagePreviewPill: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginBottom: 10,
    ...Platform.select({
      ...shadow('#000', { width: 0, height: 4 }, 0.1, 10, 3),
      android: { elevation: 4 },
      web: { boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }
    }),
  },
  imagePreviewThumb: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#EEE',
  },
  imagePreviewMeta: {
    flex: 1,
    marginLeft: 12,
  },
  imagePreviewTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  imagePreviewSub: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  discardImageBtn: {
    padding: 4,
  },

  // Antigravity Hover Recording Pill
  hoverRecordingPill: {
    position: 'absolute',
    bottom: 70, // Float above the input pill
    left: 16,
    right: 16,
    backgroundColor: '#1E1E1E',
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#333',
    ...Platform.select({
      ...shadow('#000', { width: 0, height: 8 }, 0.3, 16, 10),
      android: { elevation: 8 },
      web: { boxShadow: '0 8px 16px rgba(0,0,0,0.3)' }
    }),
    zIndex: 9999,
  },
  hoverMicGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hoverRecText: {
    color: '#E0E0E0',
    fontSize: 14,
    fontWeight: '600',
  },
  hoverActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  hoverTimeText: {
    color: '#90CAF9', // light blue like standard timers
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  hoverStopBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 85, 85, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hoverStopSquare: {
    width: 12,
    height: 12,
    borderRadius: 3,
    backgroundColor: '#FF5555',
  },
  hoverCancelBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hoverPlayPreviewBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hoverSendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    paddingHorizontal: 20,
  },
  dateDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  dateDividerText: {
    paddingHorizontal: 12,
    fontSize: 11,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bubbleTime: {
    fontSize: 9,
    fontWeight: '600',
    opacity: 0.7,
  },
});
