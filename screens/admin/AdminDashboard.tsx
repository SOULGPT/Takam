import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    users: 0,
    bonds: 0,
    vibes: 0,
    gifts: 0,
  });
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    const [uRes, bRes, vRes, gRes] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('bonds').select('*', { count: 'exact', head: true }),
      supabase.from('vibes').select('*', { count: 'exact', head: true }),
      supabase.from('gift_orders').select('*', { count: 'exact', head: true }),
    ]);

    setStats({
      users: uRes.count ?? 0,
      bonds: bRes.count ?? 0,
      vibes: vRes.count ?? 0,
      gifts: gRes.count ?? 0,
    });
  };

  const fetchAnalytics = async () => {
    const { data } = await supabase
      .from('analytics_events')
      .select('*, profiles!user_id(display_name)')
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) {
      setEvents(data);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchAnalytics();
    setLoading(false);

    // Master Real-time Subscription for Dashboard
    const channel = supabase.channel('admin_master')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, fetchStats)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bonds' }, fetchStats)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vibes' }, fetchStats)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gift_orders' }, fetchStats)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'analytics_events' }, fetchAnalytics)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#C9705A" /></View>;
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>Takam Team Overview</Text>
      
      <View style={styles.grid}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>All Users</Text>
          <Text style={styles.cardStat}>{stats.users}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Active Bonds</Text>
          <Text style={styles.cardStat}>{stats.bonds}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Vibes Fired</Text>
          <Text style={styles.cardStat}>{stats.vibes}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Gifts Needed</Text>
          <Text style={[styles.cardStat, { color: '#E3B341' }]}>{stats.gifts}</Text>
        </View>
      </View>

      <Text style={styles.subtitle}>🟢 Live Analytics Stream</Text>
      
      <View style={styles.feedContainer}>
        {events.length === 0 ? (
          <Text style={styles.emptyText}>Standing by for incoming events...</Text>
        ) : (
          events.map(ev => (
            <View key={ev.id} style={styles.feedItem}>
              <Text style={styles.feedEventTitle}>{ev.event_name.toUpperCase()}</Text>
              <Text style={styles.feedEventTime}>{new Date(ev.created_at).toLocaleTimeString()}</Text>
              <Text style={styles.feedEventUser}>By: {ev.profiles?.display_name || 'Anonymous'}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D1117', padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0D1117' },
  title: { fontSize: 28, fontWeight: '800', color: '#FDFAF4', marginBottom: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  card: {
    backgroundColor: '#161B22',
    padding: 20,
    borderRadius: 16,
    width: '47%',
    borderWidth: 1,
    borderColor: '#30363D',
  },
  cardLabel: { fontSize: 13, color: '#8B949E', fontWeight: '600', marginBottom: 8 },
  cardStat: { fontSize: 32, fontWeight: '800', color: '#58A6FF' },
  subtitle: { fontSize: 20, fontWeight: '700', color: '#FDFAF4', marginTop: 40, marginBottom: 16 },
  
  feedContainer: { gap: 12 },
  emptyText: { color: '#8B949E', fontStyle: 'italic' },
  feedItem: {
    backgroundColor: '#161B22',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#C9705A',
  },
  feedEventTitle: { fontSize: 14, fontWeight: '800', color: '#F5ECD7', letterSpacing: 1 },
  feedEventTime: { fontSize: 11, color: '#8B949E', position: 'absolute', right: 16, top: 16 },
  feedEventUser: { fontSize: 13, color: '#58A6FF', marginTop: 6, fontWeight: '500' }
});
