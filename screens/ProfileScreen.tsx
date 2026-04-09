import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { useNavigation } from '@react-navigation/native';

export default function ProfileScreen() {
  const { profile, bonds, bondMembers, activeBondId, setProfile, reset } = useStore();
  const bond = bonds.find((b) => b.id === activeBondId);
  const partnerProfile = activeBondId ? bondMembers[activeBondId] : null;
  const nav = useNavigation<any>();
  
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      reset();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const tierLabel = profile?.subscription_tier === 'ritual' ? '✦ Ritual' : 'Free';
  const tierColor = profile?.subscription_tier === 'ritual' ? '#C9705A' : '#8C6246';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient colors={['#FDFAF4', '#F5ECD7']} style={StyleSheet.absoluteFill} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>
              {profile?.display_name?.[0]?.toUpperCase() ?? 'U'}
            </Text>
          </View>
          <Text style={styles.displayName}>{profile?.display_name ?? 'You'}</Text>
          <View style={[styles.tierBadge, { borderColor: tierColor }]}>
            <Text style={[styles.tierText, { color: tierColor }]}>{tierLabel}</Text>
          </View>
        </View>

        {/* Bond info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your Bond</Text>
          <Row label="Bond Code" value={bond?.bond_code ?? '—'} mono />
          <Row label="Status" value={bond?.status === 'active' ? '🟢 Active' : '⏳ Pending'} />
          <Row
            label="Partner"
            value={partnerProfile?.display_name ?? 'Waiting for partner…'}
          />
          <Row
            label="Bonded Since"
            value={
              bond?.created_at
                ? new Date(bond.created_at).toLocaleDateString()
                : '—'
            }
          />
        </View>

        {/* Upgrade card */}
        {profile?.subscription_tier !== 'ritual' && (
          <View style={styles.upgradeCard}>
            <Text style={styles.upgradeTitle}>Unlock Ritual ✦</Text>
            <Text style={styles.upgradeDesc}>
              Priority gift curation, MFA security, and exclusive vibe types.
            </Text>
            <TouchableOpacity style={styles.upgradeButton} onPress={() => nav.navigate('Upgrade')}>
              <Text style={styles.upgradeButtonText}>Explore Ritual Plans</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Sign out */}
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#9B3D2C" />
          ) : (
            <Text style={styles.signOutText}>Sign Out</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={rowStyles.container}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={[rowStyles.value, mono && rowStyles.mono]}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EDD9B8',
  },
  label: { fontSize: 13, color: '#8C6246', fontWeight: '500' },
  value: { fontSize: 14, color: '#3D2B1F', fontWeight: '600' },
  mono: { letterSpacing: 3, fontSize: 16, fontWeight: '800' },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 24, paddingTop: 60, gap: 24, paddingBottom: 48 },
  avatarSection: { alignItems: 'center', gap: 10 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#C9705A',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#9B3D2C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  avatarInitial: { fontSize: 34, fontWeight: '800', color: '#F5ECD7' },
  displayName: { fontSize: 22, fontWeight: '700', color: '#3D2B1F' },
  tierBadge: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  tierText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  card: {
    backgroundColor: '#FDFAF4',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#D9BC8A',
    shadowColor: '#3D2B1F',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
    gap: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#3D2B1F', marginBottom: 6 },
  upgradeCard: {
    backgroundColor: '#3D2B1F',
    borderRadius: 20,
    padding: 24,
    gap: 10,
  },
  upgradeTitle: { fontSize: 18, fontWeight: '800', color: '#F5ECD7' },
  upgradeDesc: { fontSize: 13, color: '#D9BC8A', lineHeight: 20 },
  upgradeButton: {
    backgroundColor: '#C9705A',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  upgradeButtonText: { fontSize: 15, fontWeight: '700', color: '#F5ECD7' },
  signOutButton: {
    backgroundColor: '#FDF0EC',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#C9705A40',
  },
  signOutText: { fontSize: 15, fontWeight: '700', color: '#9B3D2C' },
});
