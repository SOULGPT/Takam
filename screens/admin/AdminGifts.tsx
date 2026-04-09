import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function AdminGifts() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    const { data } = await supabase.from('gift_orders').select('*, profiles!requester_id(display_name, email)').order('created_at', { ascending: false });
    if (data) setOrders(data);
    setLoading(false);
  };

  const advanceStatus = async (orderId: string, currentStatus: string) => {
    const nextStatusMap: Record<string, string> = {
      pending_reveal: 'approved',
      approved: 'shipped',
      shipped: 'delivered',
      delivered: 'delivered',
    };
    
    await supabase.from('gift_orders').update({ status: nextStatusMap[currentStatus] || 'approved' }).eq('id', orderId);
    fetchOrders();
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.giftId}>Order #{item.id.slice(0, 8)}</Text>
        <TouchableOpacity style={styles.statusBtn} onPress={() => advanceStatus(item.id, item.status)}>
          <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Requested By: <Text style={styles.value}>{item.profiles?.display_name} ({item.profiles?.email})</Text></Text>
      <Text style={styles.label}>Package: <Text style={styles.value}>{item.package_selected || 'Standard Mystery'}</Text></Text>
      <Text style={styles.label}>Address: <Text style={styles.value}>{item.delivery_address}</Text></Text>
      <Text style={styles.label}>Receiver Number: <Text style={styles.value}>{item.receiver_number || 'None provided'}</Text></Text>
      
      {!!item.sender_note && (
        <View style={styles.noteBox}>
          <Text style={styles.noteLabel}>Sender Note:</Text>
          <Text style={styles.noteValue}>"{item.sender_note}"</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Gift Fulfillment</Text>
      {loading ? (
        <ActivityIndicator color="#C9705A" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={orders}
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
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  giftId: { fontSize: 13, fontWeight: '700', color: '#8B949E' },
  statusBtn: { backgroundColor: '#C9705A', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  statusText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  label: { fontSize: 13, color: '#8B949E', fontWeight: '600', marginBottom: 6 },
  value: { color: '#FDFAF4', fontWeight: '400' },
  noteBox: { marginTop: 12, padding: 12, backgroundColor: '#0D1117', borderRadius: 8 },
  noteLabel: { fontSize: 11, color: '#8B949E', fontWeight: '700', marginBottom: 4 },
  noteValue: { fontSize: 13, fontStyle: 'italic', color: '#C9D1D9' }
});
