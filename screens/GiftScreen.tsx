import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { useStore, BOND_META } from '../store/useStore';
import { trackEvent } from '../lib/analytics';

type NatureAnswer = {
  social: 'introvert' | 'extrovert' | null;
  sensory: 'sensory' | 'tactile' | null;
};

const GIFT_PRICE = '$49';

export default function GiftScreen() {
  const { session, activeBondId, bonds, bondMembers } = useStore();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [nature, setNature] = useState<NatureAnswer>({ social: null, sensory: null });
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);

  const activeBond = bonds.find((b) => b.id === activeBondId);
  const partner = activeBondId ? bondMembers[activeBondId] : null;

  const canProceedStep1 = nature.social !== null && nature.sensory !== null;
  const canProceedStep2 = address.trim().length > 10;

  const handleSubmit = async () => {
    if (!session?.user || !activeBondId) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('gift_orders').insert({
        bond_id: activeBondId,
        requester_id: session.user.id,
        nature_profile: nature,
        delivery_address: address.trim(),
        status: 'pending_reveal',
      });
      if (error) throw error;

      const { profile } = useStore.getState();
      await supabase.from('messages').insert({
        bond_id: activeBondId,
        sender_id: session.user.id,
        content: `[TAKAM SYSTEM] 🎁 ${profile?.display_name || 'Your partner'} has placed a mystery gift order for you!`,
        is_system: true
      });
      await trackEvent('gift_requested', { package: 'Mystery' });

      setStep(3);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!activeBond || !partner) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <LinearGradient colors={['#FDFAF4', '#F5ECD7']} style={StyleSheet.absoluteFill} />
        <Text style={styles.emptyEmoji}>🎁</Text>
        <Text style={styles.emptyTitle}>Curated Gifts</Text>
        <Text style={styles.emptySub}>Select an active connection in the Home screen to send them a mystery gift.</Text>
      </View>
    );
  }

  const meta = BOND_META[activeBond.bond_type] ?? BOND_META.other;
  const partnerName = partner.display_name ?? partner.username ?? 'your connection';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient colors={['#FDFAF4', '#F5ECD7']} style={StyleSheet.absoluteFill} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Mystery Gift ✦</Text>
          <Text style={styles.subtitle}>
            A curated surprise, hand-picked for {partnerName} {meta.emoji}.
          </Text>
        </View>

        {/* Step indicators */}
        <View style={styles.stepRow}>
          {[1, 2, 3].map((s) => (
            <View key={s} style={[styles.stepDot, step >= s && styles.stepDotActive]}>
              <Text style={[styles.stepNum, step >= s && styles.stepNumActive]}>{s}</Text>
            </View>
          ))}
          <View style={styles.stepLine} />
        </View>

        {/* Step 1 — Nature questionnaire */}
        {step === 1 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Their Nature</Text>
            <Text style={styles.cardSubtitle}>Help us find the perfect gift for {partnerName}.</Text>

            <Text style={styles.qLabel}>They are more…</Text>
            <View style={styles.optionRow}>
              <OptionButton
                label="🌙 Introvert"
                selected={nature.social === 'introvert'}
                onPress={() => setNature((n) => ({ ...n, social: 'introvert' }))}
              />
              <OptionButton
                label="☀️ Extrovert"
                selected={nature.social === 'extrovert'}
                onPress={() => setNature((n) => ({ ...n, social: 'extrovert' }))}
              />
            </View>

            <Text style={styles.qLabel}>They prefer gifts that are…</Text>
            <View style={styles.optionRow}>
              <OptionButton
                label="🌿 Sensory"
                selected={nature.sensory === 'sensory'}
                onPress={() => setNature((n) => ({ ...n, sensory: 'sensory' }))}
              />
              <OptionButton
                label="🤲 Tactile"
                selected={nature.sensory === 'tactile'}
                onPress={() => setNature((n) => ({ ...n, sensory: 'tactile' }))}
              />
            </View>

            <TouchableOpacity
              style={[styles.nextButton, !canProceedStep1 && styles.disabledButton]}
              disabled={!canProceedStep1}
              onPress={() => setStep(2)}
            >
              <Text style={styles.nextButtonText}>Next →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 2 — Address */}
        {step === 2 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Delivery Address</Text>
            <Text style={styles.cardSubtitle}>
              Your gift will be shipped here. {GIFT_PRICE} · Curated by our team.
            </Text>

            <TextInput
              style={styles.addressInput}
              value={address}
              onChangeText={setAddress}
              placeholder={`Enter delivery address for ${partnerName}…`}
              placeholderTextColor="#B5947A"
              multiline
              numberOfLines={3}
            />

            <Text style={styles.privacyNote}>
              🔒 Your address is encrypted and only used for this delivery.
            </Text>

            <TouchableOpacity
              style={[styles.nextButton, !canProceedStep2 && styles.disabledButton]}
              disabled={!canProceedStep2 || loading}
              onPress={handleSubmit}
            >
              {loading ? (
                <ActivityIndicator color="#F5ECD7" />
              ) : (
                <Text style={styles.nextButtonText}>Place Order · {GIFT_PRICE}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStep(1)}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 3 — Confirmation */}
        {step === 3 && (
          <View style={[styles.card, styles.successCard]}>
            <Text style={styles.successEmoji}>🎁</Text>
            <Text style={styles.successTitle}>Gift Queued!</Text>
            <Text style={styles.successDesc}>
              Your mystery gift is in the curator's Pending Reveal queue.{'\n\n'}
              You'll be notified once it's approved and shipped to {partnerName}.
            </Text>
            <TouchableOpacity style={styles.nextButton} onPress={() => setStep(1)}>
              <Text style={styles.nextButtonText}>Send Another</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function OptionButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.optionBtn, selected && styles.optionBtnSelected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.optionBtnText, selected && styles.optionBtnTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5ECD7' },
  scroll: { padding: 24, paddingTop: 60, gap: 24, paddingBottom: 40 },
  header: { gap: 6 },
  title: { fontSize: 28, fontWeight: '800', color: '#3D2B1F' },
  subtitle: { fontSize: 14, color: '#8C6246', lineHeight: 21 },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EDD9B8',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  stepDotActive: { backgroundColor: '#C9705A' },
  stepNum: { fontSize: 13, fontWeight: '700', color: '#8C6246' },
  stepNumActive: { color: '#F5ECD7' },
  stepLine: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    height: 2,
    backgroundColor: '#D9BC8A',
    zIndex: 0,
  },
  card: {
    backgroundColor: '#FDFAF4',
    borderRadius: 24,
    padding: 24,
    gap: 14,
    borderWidth: 1.5,
    borderColor: '#D9BC8A',
    shadowColor: '#3D2B1F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  successCard: { alignItems: 'center', paddingVertical: 36 },
  cardTitle: { fontSize: 20, fontWeight: '700', color: '#3D2B1F' },
  cardSubtitle: { fontSize: 13, color: '#8C6246', lineHeight: 19 },
  qLabel: { fontSize: 14, fontWeight: '600', color: '#5C3D2E', marginTop: 4 },
  optionRow: { flexDirection: 'row', gap: 12 },
  optionBtn: {
    flex: 1,
    backgroundColor: '#F5ECD7',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#D9BC8A',
  },
  optionBtnSelected: { backgroundColor: '#C9705A', borderColor: '#C9705A' },
  optionBtnText: { fontSize: 14, fontWeight: '600', color: '#8C6246' },
  optionBtnTextSelected: { color: '#F5ECD7' },
  addressInput: {
    backgroundColor: '#F5ECD7',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#D9BC8A',
    padding: 16,
    fontSize: 14,
    color: '#3D2B1F',
    lineHeight: 22,
    minHeight: 90,
  },
  privacyNote: { fontSize: 12, color: '#B5947A', lineHeight: 18 },
  nextButton: {
    backgroundColor: '#C9705A',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#9B3D2C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  disabledButton: { backgroundColor: '#D9BC8A' },
  nextButtonText: { fontSize: 15, fontWeight: '700', color: '#F5ECD7' },
  backText: { textAlign: 'center', color: '#8C6246', fontSize: 14, fontWeight: '600' },
  successEmoji: { fontSize: 52 },
  successTitle: { fontSize: 24, fontWeight: '800', color: '#3D2B1F' },
  successDesc: { fontSize: 14, color: '#8C6246', lineHeight: 22, textAlign: 'center' },
  emptyEmoji: { fontSize: 64, marginBottom: 12 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: '#3D2B1F', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#8C6246', textAlign: 'center', marginHorizontal: 40, lineHeight: 20 },
});
