import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Modal,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabase';
import { getDeviceTimezone } from '../lib/utils/timezone';
import { LinearGradient } from 'expo-linear-gradient';
import { shadow } from '../lib/theme/shadows';
import { Ionicons } from '@expo/vector-icons';
import SyncLine from '../components/calendar/SyncLine';
import TimelineRibbon from '../components/calendar/TimelineRibbon';
import EventDrawer from '../components/calendar/EventDrawer';
import { StatusBar } from 'expo-status-bar';
import CreateEventModal from '../components/calendar/CreateEventModal';
import CalendarFAB from '../components/calendar/CalendarFAB';
import * as Haptics from 'expo-haptics';
import { useRef } from 'react';

export default function SyncLinkScreen() {
  const { profile, activeBondId, bondMembers } = useStore();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [creationInitialTime, setCreationInitialTime] = useState<string | undefined>();
  const lastHapticHour = useRef(-1);

  const partnerProfile = activeBondId ? bondMembers[activeBondId] : null;
  const myTz = profile?.timezone || getDeviceTimezone();
  const partnerTz = partnerProfile?.timezone || 'UTC';

  // 1. Auto-save timezone if missing
  useEffect(() => {
    if (profile && !profile.timezone) {
      const detected = getDeviceTimezone();
      supabase.from('profiles').update({ timezone: detected }).eq('id', profile.id)
        .then(() => useStore.getState().setProfile({ ...profile, timezone: detected }));
    }
  }, [profile]);

  // 2. Fetch and Subscribe to Calendar
  useEffect(() => {
    if (!activeBondId) return;

    fetchEvents();

    const channel = supabase.channel(`calendar_sync:${activeBondId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'shared_calendar',
        filter: `bond_id=eq.${activeBondId}` 
      }, () => fetchEvents())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeBondId]);

  const fetchEvents = async () => {
    const { data } = await supabase
      .from('shared_calendar')
      .select('*')
      .eq('bond_id', activeBondId)
      .order('start_time', { ascending: true });
    if (data) setEvents(data);
    setLoading(false);
  };

  const handleScroll = (event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    const hour = Math.floor(y / 80);
    if (hour !== lastHapticHour.current && hour >= 0 && hour < 24) {
      Haptics.selectionAsync();
      lastHapticHour.current = hour;
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#C9705A" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <LinearGradient colors={['#FDFAF4', '#F5ECD7']} style={styles.bg} />

      <View style={styles.header}>
        <Text style={styles.title}>Sync-Link</Text>
        <Text style={styles.subtitle}>Unified Timeline</Text>
      </View>

      <ScrollView 
        style={styles.scroll} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.parchmentContainer}>
          <TimelineRibbon 
            events={events} 
            myTz={myTz} 
            partnerTz={partnerTz} 
            partnerName={partnerProfile?.display_name || 'Partner'}
            onEventPress={(ev: any) => setSelectedEvent(ev)}
            onLongPressSlot={(time) => {
              setCreationInitialTime(time);
              setIsCreating(true);
            }}
          />
          <SyncLine rowHeight={80} />
        </View>
      </ScrollView>

      {/* Floating Add Action Button */}
      <CalendarFAB onAction={(type) => {
        setCreationInitialTime(undefined);
        setIsCreating(true);
      }} />

      {/* Creation Modal */}
      <Modal
        visible={isCreating}
        animationType="slide"
        transparent
        onRequestClose={() => setIsCreating(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.modalOverlay}
        >
          <TouchableOpacity 
            style={{ flex: 1 }} 
            activeOpacity={1} 
            onPress={() => setIsCreating(false)} 
          />
          <CreateEventModal 
            initialTime={creationInitialTime}
            onClose={() => setIsCreating(false)}
            onSuccess={fetchEvents}
          />
        </KeyboardAvoidingView>
      </Modal>

      {/* Event Drawer */}
      <Modal
        visible={!!selectedEvent}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedEvent(null)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setSelectedEvent(null)}
        >
           <View onStartShouldSetResponder={() => true}>
             {selectedEvent && (
                <EventDrawer 
                  event={selectedEvent} 
                  onClose={() => setSelectedEvent(null)} 
                />
             )}
           </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FDF5E6' },
  bg: { ...StyleSheet.absoluteFillObject },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF5E6' },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EDD9B8',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#3D2B1F',
    fontFamily: 'CormorantGaramond_700Bold',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8C6246',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: -4,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  parchmentContainer: {
    backgroundColor: '#FDF5E6',
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 8,
    ...Platform.select({
      ios: {
        ...shadow('#3D2B1F', { width: 0, height: 4 }, 0.1, 12, 4),
      },
      android: {
        elevation: 5,
      },
      web: {
        boxShadow: '0 4px 12px rgba(61, 43, 31, 0.1)',
      },
    }),
    overflow: 'hidden',
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#C9705A',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        ...shadow('#C9705A', { width: 0, height: 8 }, 0.4, 12, 6),
      },
      android: {
        elevation: 10,
      },
      web: {
        boxShadow: '0 8px 12px rgba(201, 112, 90, 0.4)',
      },
    }),
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(61, 43, 31, 0.4)',
  }
});
