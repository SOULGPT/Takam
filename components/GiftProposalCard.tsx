import React from 'react';
import { View, Text, StyleSheet, Image, Dimensions, Platform } from 'react-native';
import { shadow } from '../lib/theme/shadows';
import { BlurView } from 'expo-blur';
import { CormorantGaramond_700Bold, useFonts } from '@expo-google-fonts/cormorant-garamond';

const { width } = Dimensions.get('window');

interface GiftProposalCardProps {
  order: {
    id: string;
    budget_tier: string;
    admin_status: string;
    proposal_photo_url?: string;
    curator_message?: string;
  };
}

export default function GiftProposalCard({ order }: GiftProposalCardProps) {
  const [fontsLoaded] = useFonts({ CormorantGaramond_700Bold });

  const isProposing = order.admin_status === 'proposing';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.badge}>{order.budget_tier.toUpperCase()}</Text>
        <Text style={styles.status}>
          {order.admin_status === 'pending' ? 'Curating…' : 'Review Proposal'}
        </Text>
      </View>

      <View style={styles.imageContainer}>
        {order.proposal_photo_url ? (
          <Image source={{ uri: order.proposal_photo_url }} style={styles.image} />
        ) : (
          <View style={styles.placeholder}>
            <BlurView intensity={10} style={StyleSheet.absoluteFill} />
            <Text style={styles.placeholderText}>Curation in progress…</Text>
            <Text style={styles.placeholderSub}>Our team is hand-selecting your gift.</Text>
          </View>
        )}
      </View>

      {order.curator_message && (
        <View style={styles.messageBox}>
          <Text style={[styles.serif, fontsLoaded && { fontFamily: 'CormorantGaramond_700Bold' }]}>
            “{order.curator_message}”
          </Text>
          <Text style={styles.curatorName}>— The TAKAM Curators</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5dec1',
    ...shadow('#000', { width: 0, height: 0 }, 0.05, 15, 4),
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  badge: { fontSize: 10, fontWeight: '900', color: '#c47a52', letterSpacing: 1 },
  status: { fontSize: 12, fontWeight: '700', color: '#7a8c7e' },
  imageContainer: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    backgroundColor: '#f5f0e8',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  placeholderText: { fontSize: 18, fontWeight: '700', color: '#2d1f1a', marginBottom: 4 },
  placeholderSub: { fontSize: 12, color: '#7a8c7e', textAlign: 'center' },
  messageBox: { marginTop: 16, padding: 16, backgroundColor: '#fdfbf7', borderRadius: 12 },
  serif: { fontSize: 20, color: '#2d1f1a', fontStyle: 'italic' },
  curatorName: { fontSize: 10, color: '#b0a796', marginTop: 8, textTransform: 'uppercase', letterSpacing: 1 },
});
