import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { useNavigation } from '@react-navigation/native';
import { trackEvent } from '../lib/analytics';

export default function UpgradeScreen() {
  const { profile, bonds, activeBondId, bondMembers, setProfile } = useStore();
  const nav = useNavigation<any>();
  
  const [loading, setLoading] = useState(false);
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [plan, setPlan] = useState<'individual' | 'joint'>('joint');

  const partnerProfile = activeBondId ? bondMembers[activeBondId] : null;

  const handlePurchase = async () => {
    if (!profile) return;
    setLoading(true);

    try {
      const isJoint = plan === 'joint';

      // Duration simulation logic
      const daysToAdd = cycle === 'yearly' ? 365 : 30;
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + daysToAdd);
      const isoDate = expirationDate.toISOString();

      // Upgrade Self
      await supabase
        .from('profiles')
        .update({ subscription_tier: 'ritual', is_premium: true, premium_expires_at: isoDate })
        .eq('id', profile.id);
      
      // Upgrade Partner
      if (isJoint && partnerProfile) {
        await supabase
          .from('profiles')
          .update({ subscription_tier: 'ritual', is_premium: true, premium_expires_at: isoDate })
          .eq('id', partnerProfile.id);
      }
      
      setProfile({ ...profile, subscription_tier: 'ritual', is_premium: true, premium_expires_at: isoDate });
      
      await trackEvent(`premium_purchase_${cycle}`, { plan });

      Alert.alert(
        'Transaction Successful! ✦', 
        isJoint && partnerProfile 
          ? `You and ${partnerProfile.display_name} are now Ritual Members until ${expirationDate.toLocaleDateString()}!` 
          : `Your premium features are unlocked until ${expirationDate.toLocaleDateString()}!`,
        [ { text: 'Awesome', onPress: () => nav.goBack() } ]
      );

    } catch (e: any) {
      Alert.alert('Payment Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const getPrice = (p: 'individual' | 'joint') => {
    if (cycle === 'monthly') {
      return p === 'individual' ? '$9.99/mo' : '$15.99/mo';
    } else {
      return p === 'individual' ? '$99.99/yr' : '$159.99/yr';
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1513" />
      <LinearGradient colors={['#1A1513', '#3D2B1F', '#5C3D2E']} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => nav.goBack()}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Ritual ✦</Text>
        <Text style={styles.subtitle}>Unlock priority mysteries and infinite vibes.</Text>
      </View>

      <View style={styles.content}>
        {/* Cycle Toggle */}
        <View style={styles.toggleRow}>
          <TouchableOpacity 
            style={[styles.toggleBtn, cycle === 'monthly' && styles.toggleActive]}
            onPress={() => setCycle('monthly')}
          >
            <Text style={[styles.toggleText, cycle === 'monthly' && styles.toggleTextActive]}>Monthly</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toggleBtn, cycle === 'yearly' && styles.toggleActive]}
            onPress={() => setCycle('yearly')}
          >
            <Text style={[styles.toggleText, cycle === 'yearly' && styles.toggleTextActive]}>Yearly (Save 15%)</Text>
          </TouchableOpacity>
        </View>

        {/* Plan Selection */}
        <View style={styles.planSection}>
          <TouchableOpacity 
            style={[styles.planCard, plan === 'individual' && styles.planCardActive]}
            onPress={() => setPlan('individual')}
          >
            <View>
              <Text style={styles.planName}>Just Me</Text>
              <Text style={styles.planDesc}>Upgrade my personal account.</Text>
            </View>
            <Text style={styles.planPrice}>{getPrice('individual')}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.planCard, plan === 'joint' && styles.planCardActive, !partnerProfile && styles.planCardDisabled]}
            onPress={() => setPlan('joint')}
            disabled={!partnerProfile}
          >
            <View>
              <Text style={styles.planName}>Couples Pack</Text>
              <Text style={styles.planDesc}>Upgrade myself + {partnerProfile?.display_name || 'Partner'}.</Text>
            </View>
            <Text style={styles.planPrice}>{getPrice('joint')}</Text>
          </TouchableOpacity>
        </View>

        {/* Features list */}
        <View style={styles.featureBox}>
           <Text style={styles.feat}>✓ Complete mystery curation</Text>
           <Text style={styles.feat}>✓ Infinite immersive vibes</Text>
           <Text style={styles.feat}>✓ Priority shipping algorithms</Text>
           <Text style={styles.feat}>✓ Highest security isolation</Text>
        </View>
      </View>

      {/* Footer Checkout */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.checkoutBtn} onPress={handlePurchase} disabled={loading}>
          {loading ? <ActivityIndicator color="#F5ECD7" /> : <Text style={styles.checkoutText}>Purchase {plan === 'joint' ? 'Couples Pack' : 'Individual'} • {getPrice(plan)}</Text>}
        </TouchableOpacity>
        <Text style={styles.guaranteeLabel}>Auto-renews until downgraded. Cancel anytime.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#3D2B1F' },
  header: { paddingTop: 60, paddingHorizontal: 24, alignItems: 'center', marginBottom: 30 },
  closeBtn: { position: 'absolute', top: 60, left: 24, padding: 8, zIndex: 10 },
  closeText: { fontSize: 24, color: '#F5ECD7', fontWeight: '800' },
  title: { fontSize: 32, fontWeight: '800', color: '#F5ECD7', letterSpacing: 1 },
  subtitle: { fontSize: 14, color: '#D9BC8A', textAlign: 'center', marginTop: 12, opacity: 0.9 },
  
  content: { flex: 1, paddingHorizontal: 24 },
  toggleRow: { flexDirection: 'row', backgroundColor: '#21150F', borderRadius: 12, padding: 4, marginBottom: 30 },
  toggleBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  toggleActive: { backgroundColor: '#C9705A' },
  toggleText: { fontSize: 14, fontWeight: '700', color: '#D9BC8A' },
  toggleTextActive: { color: '#FDFAF4' },
  
  planSection: { gap: 16 },
  planCard: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    backgroundColor: '#302116', padding: 20, borderRadius: 16,
    borderWidth: 2, borderColor: '#4A3322'
  },
  planCardActive: { borderColor: '#E4A083', backgroundColor: '#452D1E' },
  planCardDisabled: { opacity: 0.5 },
  planName: { fontSize: 16, fontWeight: '800', color: '#FDFAF4', marginBottom: 4 },
  planDesc: { fontSize: 12, color: '#D9BC8A' },
  planPrice: { fontSize: 18, fontWeight: '800', color: '#F5ECD7' },

  featureBox: { marginTop: 40, gap: 12, paddingHorizontal: 10 },
  feat: { fontSize: 15, color: '#D9BC8A', fontWeight: '600' },

  footer: { paddingHorizontal: 24, paddingBottom: 40, paddingTop: 20 },
  checkoutBtn: { backgroundColor: '#C9705A', borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  checkoutText: { fontSize: 16, fontWeight: '800', color: '#F5ECD7', letterSpacing: 0.5 },
  guaranteeLabel: { textAlign: 'center', fontSize: 11, color: '#8C6246', marginTop: 16, fontWeight: '600' }
});
