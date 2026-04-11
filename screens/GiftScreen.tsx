import React, { useState, useEffect } from 'react';
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
  Dimensions,
  Platform,
} from 'react-native';
import { shadow } from '../lib/theme/shadows';
import Animated, { 
  FadeIn, 
  FadeOut, 
  SlideInRight, 
  SlideOutLeft,
  Layout,
  useSharedValue,
  useAnimatedStyle,
  withSpring
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AddressSearch from '../components/AddressSearch';
import { useFonts, CormorantGaramond_700Bold } from '@expo-google-fonts/cormorant-garamond';

import { supabase } from '../lib/supabase';
import { useStore, BOND_META } from '../store/useStore';
import { trackEvent } from '../lib/analytics';
import GiftProposalCard from '../components/GiftProposalCard';

const { width, height } = Dimensions.get('window');

// Palette
const COLORS = {
  parchment: '#f5f0e8',
  terracotta: '#c47a52',
  sage: '#7a8c7e',
  plum: '#2d1f1a',
};

type RitualStep = 1 | 2 | 3 | 4; // 1: Nature, 2: Context, 3: Logistics, 4: Success

interface GiftRitualState {
  social: 'introvert' | 'extrovert' | null;
  sensory: 'sensory' | 'tactile' | null;
  mood: 'stressed' | 'celebrating' | 'lonely' | 'peaceful' | null;
  occasion: 'just_because' | 'anniversary' | 'birthday' | null;
  note: string;
  budget: 'micro' | 'standard' | 'premium' | null;
  address: string;
}

const BUDGETS = [
  { id: 'micro', label: 'Micro', price: '$9', desc: 'A digital token & physical postcard.' },
  { id: 'standard', label: 'Standard', price: '$49', desc: 'A hand-picked, curated physical gift.' },
  { id: 'premium', label: 'Premium', price: '$149', desc: 'A bespoke luxury experience & gift set.' },
];

export default function GiftScreen() {
  const [fontsLoaded] = useFonts({ CormorantGaramond_700Bold });
  const { session, activeBondId, bonds, bondMembers, profile } = useStore();
  const [step, setStep] = useState<RitualStep>(1);
  const [loading, setLoading] = useState(false);
  
  const [ritual, setRitual] = useState<GiftRitualState>({
    social: null,
    sensory: null,
    mood: null,
    occasion: null,
    note: '',
    budget: null,
    address: '',
  });
  const [activeOrders, setActiveOrders] = useState<any[]>([]);

  useEffect(() => {
    if (session?.user && activeBondId) {
      fetchOrders();
    }
  }, [activeBondId]);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('gift_orders')
      .select('*')
      .eq('bond_id', activeBondId)
      .order('created_at', { ascending: false });
    if (data) setActiveOrders(data);
  };

  const activeBond = bonds.find((b) => b.id === activeBondId);
  const partner = activeBondId ? bondMembers[activeBondId] : null;

  const canProceedStep1 = ritual.social !== null && ritual.sensory !== null;
  const canProceedStep2 = ritual.mood !== null && ritual.occasion !== null && ritual.note.length > 5;
  const canProceedStep3 = ritual.budget !== null && ritual.address.length > 10;

  const handleNext = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setStep((s) => (s + 1) as RitualStep);
  };

  const handleBack = () => {
    Haptics.selectionAsync();
    setStep((s) => (s - 1) as RitualStep);
  };

  const handleSubmit = async () => {
    if (!session?.user || !activeBondId) return;
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Logic: Status based on tier
      // ritual (premium) -> AwaitingApproval
      // free -> Hidden (Admin queue only)
      const isRitualUser = profile?.subscription_tier === 'ritual';
      const initialStatus = isRitualUser ? 'AwaitingApproval' : 'Hidden';

      const { error } = await supabase.from('gift_orders').insert({
        bond_id: activeBondId,
        requester_id: session.user.id,
        nature_profile: { social: ritual.social, sensory: ritual.sensory },
        mood: ritual.mood,
        occasion: ritual.occasion,
        personal_note: ritual.note,
        budget_tier: ritual.budget,
        delivery_address: ritual.address,
        admin_status: 'pending',
        status: 'pending_reveal'
      });

      if (error) throw error;

      await trackEvent('gift_ritual_completed', { tier: ritual.budget });
      setStep(4);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!activeBond || !partner) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <LinearGradient colors={[COLORS.parchment, '#ede8df']} style={StyleSheet.absoluteFill} />
        <Text style={{ fontSize: 40, marginBottom: 12 }}>🖋️</Text>
        <Text style={styles.title}>Ritual Gifting</Text>
        <Text style={styles.subtitle}>Select an active connection in the Home screen to begin the mystery ritual.</Text>
      </View>
    );
  }

  const partnerName = partner.display_name ?? partner.username ?? 'the partner';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient colors={[COLORS.parchment, '#ede8df']} style={StyleSheet.absoluteFill} />

      <ScrollView 
        contentContainerStyle={styles.scroll} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Animated.View layout={Layout.springify()} style={styles.header}>
          <Text style={[styles.ritualTag, fontsLoaded && { fontFamily: 'CormorantGaramond_700Bold' }]}>
            {step === 4 ? 'SUCCESS' : `THE RITUAL ✦ STEP ${step} OF 3`}
          </Text>
          <Text style={styles.title}>{step === 4 ? 'Ritual Complete' : 'Mystery Gift'}</Text>
        </Animated.View>

        {/* Existing Rituals for Premium Members */}
        {profile?.subscription_tier === 'ritual' && activeOrders.length > 0 && step === 1 && (
          <View style={styles.activeOrdersSection}>
            <Text style={styles.qLabel}>Active Curation</Text>
            {activeOrders.slice(0, 1).map(order => (
              <GiftProposalCard key={order.id} order={order} />
            ))}
          </View>
        )}

        {/* Ritual Container */}
        <View style={styles.ritualContainer}>
          
          {/* STEP 1: NATURE */}
          {step === 1 && (
            <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.stepContent}>
              <Text style={styles.qLabel}>How would you describe their nature?</Text>
              
              <View style={styles.btnColumn}>
                 <RitualButton 
                   label="Introvert" 
                   sub="Moonlight, quiet corners, depth."
                   selected={ritual.social === 'introvert'}
                   onPress={() => setRitual(r => ({ ...r, social: 'introvert' }))}
                 />
                 <RitualButton 
                   label="Extrovert" 
                   sub="Sunlight, shared laughter, energy."
                   selected={ritual.social === 'extrovert'}
                   onPress={() => setRitual(r => ({ ...r, social: 'extrovert' }))}
                 />
              </View>

              <Text style={[styles.qLabel, { marginTop: 24 }]}>What textures do they prefer?</Text>
              <View style={styles.btnColumn}>
                 <RitualButton 
                   label="Sensory" 
                   sub="Fine scents, soft light, atmosphere."
                   selected={ritual.sensory === 'sensory'}
                   onPress={() => setRitual(r => ({ ...r, sensory: 'sensory' }))}
                 />
                 <RitualButton 
                   label="Tactile" 
                   sub="Physical objects, weight, touch."
                   selected={ritual.sensory === 'tactile'}
                   onPress={() => setRitual(r => ({ ...r, sensory: 'tactile' }))}
                 />
              </View>

              <NextButton disabled={!canProceedStep1} onPress={handleNext} />
            </Animated.View>
          )}

          {/* STEP 2: CONTEXT & NOTE */}
          {step === 2 && (
            <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.stepContent}>
              <Text style={styles.qLabel}>How is {partnerName} feeling right now?</Text>
              <View style={styles.optionGrid}>
                {['stressed', 'celebrating', 'lonely', 'peaceful'].map((m: any) => (
                  <RitualButton 
                    key={m}
                    label={m.charAt(0).toUpperCase() + m.slice(1)}
                    small
                    selected={ritual.mood === m}
                    onPress={() => setRitual(r => ({ ...r, mood: m }))}
                  />
                ))}
              </View>

              <Text style={[styles.qLabel, { marginTop: 20 }]}>And the occasion?</Text>
              <View style={styles.optionGrid}>
                {['just_because', 'anniversary', 'birthday'].map((o: any) => (
                  <RitualButton 
                    key={o}
                    label={o.replace('_', ' ').toUpperCase()}
                    small
                    selected={ritual.occasion === o}
                    onPress={() => setRitual(r => ({ ...r, occasion: o }))}
                  />
                ))}
              </View>

              {/* TACTILE NOTE CARD */}
              <View style={styles.noteCard}>
                <Text style={[styles.noteLabel, fontsLoaded && { fontFamily: 'CormorantGaramond_700Bold' }]}>
                  A Note for {partnerName}
                </Text>
                <TextInput
                  style={styles.noteInput}
                  multiline
                  placeholder="Your handwritten note begins here…"
                  placeholderTextColor="#b0a796"
                  value={ritual.note}
                  onChangeText={t => setRitual(r => ({ ...r, note: t }))}
                />
                <View style={styles.cardDetail} />
              </View>

              <View style={styles.navRow}>
                <TouchableOpacity onPress={handleBack}><Text style={styles.backLink}>Back</Text></TouchableOpacity>
                <NextButton disabled={!canProceedStep2} onPress={handleNext} />
              </View>
            </Animated.View>
          )}

          {/* STEP 3: REWARDS & LOGISTICS */}
          {step === 3 && (
            <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.stepContent}>
              <Text style={styles.qLabel}>Choose the Ritual Tier</Text>
              <View style={styles.budgetRow}>
                {BUDGETS.map((b: any) => (
                  <TouchableOpacity 
                    key={b.id} 
                    style={[styles.budgetItem, ritual.budget === b.id && styles.budgetActive]}
                    onPress={() => {
                       Haptics.selectionAsync();
                       setRitual(r => ({ ...r, budget: b.id }));
                    }}
                  >
                    <Text style={styles.budgetPrice}>{b.price}</Text>
                    <Text style={styles.budgetLabel}>{b.label}</Text>
                    <Text style={styles.budgetDesc}>{b.desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.qLabel, { marginTop: 24 }]}>Delivery Address</Text>
              <View style={styles.addressWrapper}>
                <AddressSearch 
                  onAddressSelect={(address) => setRitual(r => ({ ...r, address }))}
                />
              </View>

              <View style={styles.navRow}>
                <TouchableOpacity onPress={handleBack}><Text style={styles.backLink}>Back</Text></TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.confirmBtn, !canProceedStep3 && { opacity: 0.5 }]}
                  disabled={!canProceedStep3 || loading}
                  onPress={handleSubmit}
                >
                  {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmBtnText}>Finalize Ritual</Text>}
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

          {/* SUCCESS MESSAGE */}
          {step === 4 && (
            <Animated.View entering={FadeIn} style={styles.success}>
              <Text style={{ fontSize: 60, marginBottom: 20 }}>✨</Text>
              <Text style={[styles.successTitle, fontsLoaded && { fontFamily: 'CormorantGaramond_700Bold' }]}>Ritual Initiated</Text>
              <Text style={styles.successSub}>
                Your curators have received the request. {profile?.subscription_tier === 'ritual' ? 
                'As a Ritual member, you will receive a proposal shortly.' : 
                'A mystery surprise is being prepared for shipping.'}
              </Text>
              <TouchableOpacity style={styles.doneBtn} onPress={() => setStep(1)}>
                <Text style={styles.doneBtnText}>Prepare Another</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function RitualButton({ label, sub, selected, onPress, small = false }: any) {
  return (
    <TouchableOpacity 
      style={[styles.ritualBtn, selected && styles.ritualBtnActive, small && styles.ritualBtnSmall]} 
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
    >
      <Text style={[styles.ritualBtnLabel, selected && styles.ritualBtnLabelActive]}>{label}</Text>
      {!small && <Text style={[styles.ritualBtnSub, selected && styles.ritualBtnSubActive]}>{sub}</Text>}
    </TouchableOpacity>
  );
}

function NextButton({ disabled, onPress }: any) {
  return (
    <TouchableOpacity 
      style={[styles.nextBtn, disabled && styles.nextBtnDisabled]} 
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.nextBtnText}>CONTINUE →</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.parchment },
  scroll: { padding: 24, paddingTop: 60, paddingBottom: 60 },
  header: { marginBottom: 32 },
  ritualTag: { fontSize: 10, letterSpacing: 2, color: COLORS.terracotta, fontWeight: '800', marginBottom: 8 },
  title: { fontSize: 32, fontWeight: '900', color: COLORS.plum },
  subtitle: { fontSize: 14, color: COLORS.sage, marginTop: 10, lineHeight: 22 },
  ritualContainer: { flex: 1 },
  activeOrdersSection: { marginBottom: 32, gap: 12 },
  stepContent: { gap: 16 },
  qLabel: { fontSize: 13, fontWeight: '800', color: COLORS.plum, opacity: 0.6, letterSpacing: 0.5, textTransform: 'uppercase' },
  btnColumn: { gap: 12 },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 30 },
  backLink: { fontSize: 14, fontWeight: '700', color: COLORS.sage, textDecorationLine: 'underline' },
  nextBtn: { backgroundColor: COLORS.plum, paddingVertical: 18, paddingHorizontal: 32, borderRadius: 100 },
  nextBtnDisabled: { opacity: 0.3 },
  nextBtnText: { color: COLORS.parchment, fontSize: 12, fontWeight: '900' },
  
  ritualBtn: { 
    backgroundColor: '#fff', 
    padding: 24, 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: '#e5dec1',
    ...shadow(COLORS.plum, { width: 0, height: 4 }, 0.05, 10, 2),
  },
  ritualBtnSmall: { padding: 16, flex: 0.48 },
  ritualBtnActive: { backgroundColor: COLORS.terracotta, borderColor: COLORS.terracotta },
  ritualBtnLabel: { fontSize: 18, fontWeight: '800', color: COLORS.plum },
  ritualBtnLabelActive: { color: COLORS.parchment },
  ritualBtnSub: { fontSize: 13, color: COLORS.sage, marginTop: 4 },
  ritualBtnSubActive: { color: COLORS.parchment, opacity: 0.8 },
  
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  
  noteCard: {
    backgroundColor: '#FAF9F6',
    borderRadius: 4,
    padding: 24,
    marginTop: 20,
    minHeight: 180,
    ...shadow('#000', { width: 0, height: 0 }, 0.04, 15, 3),
    borderWidth: 0.5,
    borderColor: '#e0d8c3',
  },
  noteLabel: { fontSize: 20, color: COLORS.plum, marginBottom: 12 },
  noteInput: { fontSize: 15, color: COLORS.plum, lineHeight: 24, flex: 1, textAlignVertical: 'top' },
  cardDetail: { position: 'absolute', bottom: 10, right: 10, width: 20, height: 20, borderBottomWidth: 1, borderRightWidth: 1, borderColor: '#e0d8c3' },

  budgetRow: { gap: 12 },
  budgetItem: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#e5dec1',
  },
  budgetActive: { borderColor: COLORS.terracotta, borderWidth: 2.5 },
  budgetPrice: { fontSize: 12, fontWeight: '900', color: COLORS.terracotta, marginBottom: 4 },
  budgetLabel: { fontSize: 20, fontWeight: '800', color: COLORS.plum },
  budgetDesc: { fontSize: 13, color: COLORS.sage, marginTop: 4 },

  addressWrapper: { zIndex: 10, minHeight: 60 },

  confirmBtn: { backgroundColor: COLORS.terracotta, paddingVertical: 18, paddingHorizontal: 40, borderRadius: 100 },
  confirmBtnText: { color: '#FFF', fontWeight: '900', fontSize: 14, letterSpacing: 1 },

  success: { flex: 1, alignItems: 'center', paddingVertical: 100 },
  successTitle: { fontSize: 32, color: COLORS.plum, marginBottom: 16 },
  successSub: { fontSize: 15, color: COLORS.sage, textAlign: 'center', lineHeight: 24, paddingHorizontal: 20 },
  doneBtn: { marginTop: 40, backgroundColor: COLORS.plum, paddingVertical: 16, paddingHorizontal: 32, borderRadius: 100 },
  doneBtnText: { color: '#FFF', fontWeight: '800' }
});
