import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function AdminSupport() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    setLoading(true);
    const { data } = await supabase.from('support_tickets').select('*, profiles!user_id(display_name, email)').order('created_at', { ascending: false });
    if (data) setTickets(data);
    setLoading(false);
  };

  const markResolved = async (id: string) => {
    await supabase.from('support_tickets').update({ status: 'resolved' }).eq('id', id);
    fetchTickets();
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={[styles.card, item.status === 'resolved' && styles.cardResolved]}>
      <View style={styles.cardHeader}>
        <Text style={styles.subject}>{item.subject}</Text>
        <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
      </View>
      <Text style={styles.user}>From: {item.profiles?.display_name} ({item.profiles?.email})</Text>
      
      <View style={styles.msgBox}>
        <Text style={styles.msg}>{item.message}</Text>
      </View>

      {item.status === 'open' && (
        <TouchableOpacity style={styles.resolveBtn} onPress={() => markResolved(item.id)}>
          <Text style={styles.resolveText}>Mark Resolved</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Support Inbox</Text>
      {loading ? (
        <ActivityIndicator color="#C9705A" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D1117', padding: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#FDFAF4', marginBottom: 16 },
  card: {
    backgroundColor: '#161B22',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#30363D',
    marginBottom: 16,
  },
  cardResolved: { opacity: 0.6 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  subject: { fontSize: 16, fontWeight: '700', color: '#FDFAF4', flex: 1 },
  date: { fontSize: 11, color: '#8B949E' },
  user: { fontSize: 12, color: '#58A6FF', marginBottom: 12, fontWeight: '500' },
  msgBox: { backgroundColor: '#0D1117', padding: 12, borderRadius: 8 },
  msg: { color: '#C9D1D9', fontSize: 14, lineHeight: 20 },
  resolveBtn: { marginTop: 12, backgroundColor: '#238636', padding: 10, borderRadius: 8, alignItems: 'center' },
  resolveText: { color: '#FFF', fontWeight: '700', fontSize: 13 }
});
