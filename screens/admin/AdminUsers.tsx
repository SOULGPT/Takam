import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (data) setUsers(data);
    setLoading(false);
  };

  const togglePremium = async (userId: string, currentPremium: boolean) => {
    const isGranting = !currentPremium;
    
    let updates: any = { is_premium: isGranting };
    if (isGranting) {
      const exp = new Date(); exp.setDate(exp.getDate() + 30);
      updates.premium_expires_at = exp.toISOString();
      updates.subscription_tier = 'ritual';
    } else {
      updates.premium_expires_at = null;
      updates.subscription_tier = 'free';
    }

    await supabase.from('profiles').update(updates).eq('id', userId);
    fetchUsers();
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.name}>{item.display_name || item.username || 'Unnamed'}</Text>
        <TouchableOpacity
          style={[styles.badge, item.is_premium ? styles.badgePremium : styles.badgeFree]}
          onPress={() => togglePremium(item.id, item.is_premium)}
        >
          <Text style={styles.badgeText}>{item.is_premium ? 'PREMIUM' : 'FREE'}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.label}>Email:</Text>
        <Text style={styles.value}>{item.email || 'N/A'}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.label}>Phone:</Text>
        <Text style={styles.value}>{item.phone || 'N/A'}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.label}>Address:</Text>
        <Text style={styles.value}>{item.address || 'N/A'}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <Text style={styles.title}>CRM / Users</Text>
      {loading ? (
        <ActivityIndicator color="#C9705A" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={users}
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
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  name: { fontSize: 18, fontWeight: '700', color: '#FDFAF4' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeFree: { backgroundColor: '#30363D' },
  badgePremium: { backgroundColor: '#C9705A' },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#FFF' },
  infoRow: { flexDirection: 'row', marginBottom: 4 },
  label: { width: 60, color: '#8B949E', fontSize: 13, fontWeight: '600' },
  value: { flex: 1, color: '#C9D1D9', fontSize: 13 },
});
