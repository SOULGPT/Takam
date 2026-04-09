import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  StatusBar,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';

// ── Country list (condensed) ──────────────────────────────────────────────────
const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Angola','Argentina','Australia','Austria',
  'Bangladesh','Belgium','Bolivia','Brazil','Cameroon','Canada','Chile','China',
  'Colombia','Congo',"Côte d'Ivoire",'Cuba','Czech Republic','Denmark','Ecuador',
  'Egypt','Ethiopia','Finland','France','Germany','Ghana','Greece','Guatemala',
  'Haiti','Hungary','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy',
  'Jamaica','Japan','Jordan','Kazakhstan','Kenya','South Korea','Kuwait',
  'Lebanon','Libya','Malaysia','Mali','Mexico','Morocco','Mozambique','Myanmar',
  'Netherlands','New Zealand','Niger','Nigeria','Norway','Pakistan','Panama',
  'Peru','Philippines','Poland','Portugal','Romania','Russia','Rwanda',
  'Saudi Arabia','Senegal','Serbia','Sierra Leone','South Africa','Spain',
  'Sri Lanka','Sudan','Sweden','Switzerland','Syria','Tanzania','Thailand',
  'Tunisia','Turkey','Uganda','Ukraine','United Kingdom','United States',
  'Uruguay','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe','Other',
];

type Sex = 'male' | 'female' | 'prefer_not_to_say';
type Step = 'identity' | 'about' | 'location' | 'terms';

interface StepIndicatorProps {
  current: Step;
}

const STEPS: Step[] = ['identity', 'about', 'location', 'terms'];

function StepDots({ current }: StepIndicatorProps) {
  const idx = STEPS.indexOf(current);
  return (
    <View style={dots.row}>
      {STEPS.map((s, i) => (
        <View
          key={s}
          style={[dots.dot, i === idx && dots.active, i < idx && dots.done]}
        />
      ))}
    </View>
  );
}

// ── Country picker ────────────────────────────────────────────────────────────
function CountryPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (c: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const filtered = COUNTRIES.filter((c) =>
    c.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <View>
      <TouchableOpacity
        style={cpStyles.trigger}
        onPress={() => setOpen((o) => !o)}
        activeOpacity={0.8}
      >
        <Text style={value ? cpStyles.triggerText : cpStyles.placeholder}>
          {value || 'Select country'}
        </Text>
        <Text style={cpStyles.arrow}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {open && (
        <View style={cpStyles.dropdown}>
          <TextInput
            style={cpStyles.search}
            value={search}
            onChangeText={setSearch}
            placeholder="Search…"
            placeholderTextColor="#B5947A"
            autoFocus
          />
          <ScrollView style={cpStyles.list} nestedScrollEnabled keyboardShouldPersistTaps="always">
            {filtered.map((c) => (
              <TouchableOpacity
                key={c}
                style={[cpStyles.item, value === c && cpStyles.itemSelected]}
                onPress={() => {
                  onChange(c);
                  setOpen(false);
                  setSearch('');
                }}
              >
                <Text style={[cpStyles.itemText, value === c && cpStyles.itemTextSelected]}>
                  {c}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ── Sex selector ─────────────────────────────────────────────────────────────
function SexSelector({ value, onChange }: { value: Sex | null; onChange: (s: Sex) => void }) {
  const options: { key: Sex; label: string }[] = [
    { key: 'male', label: '♂  Male' },
    { key: 'female', label: '♀  Female' },
    { key: 'prefer_not_to_say', label: '— Prefer not to say' },
  ];
  return (
    <View style={sexStyles.row}>
      {options.map((o) => (
        <TouchableOpacity
          key={o.key}
          style={[sexStyles.option, value === o.key && sexStyles.optionActive]}
          onPress={() => onChange(o.key)}
          activeOpacity={0.8}
        >
          <Text style={[sexStyles.optionText, value === o.key && sexStyles.optionTextActive]}>
            {o.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
interface Props {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: Props) {
  const { session, setProfile } = useStore();
  const [step, setStep] = useState<Step>('identity');
  const [loading, setLoading] = useState(false);

  // Fields
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [country, setCountry] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const slideAnim = useRef(new Animated.Value(0)).current;

  const animateNext = (nextStep: Step) => {
    Animated.sequence([
      Animated.timing(slideAnim, {
        toValue: -30,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 0,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setStep(nextStep);
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 70,
        friction: 9,
        useNativeDriver: true,
      }).start();
    });
  };

  const goNext = () => {
    if (step === 'identity') {
      if (!displayName.trim()) {
        Alert.alert('Required', 'Please enter your display name.');
        return;
      }
      animateNext('about');
    } else if (step === 'about') {
      animateNext('location');
    } else if (step === 'location') {
      animateNext('terms');
    }
  };

  const goBack = () => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) animateNext(STEPS[idx - 1]);
  };

  const handleFinish = async () => {
    if (!termsAccepted) {
      Alert.alert('Terms Required', 'Please accept the Terms & Privacy Policy to continue.');
      return;
    }
    if (!session?.user) {
      Alert.alert('Session Expired', 'Your session has expired. Please sign in again.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          id: session.user.id,
          display_name: displayName.trim(),
          username: username.trim() || null,
          bio: bio.trim() || null,
          sex: sex ?? null,
          country: country || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Update store with the saved profile, then immediately navigate.
      // We call onComplete directly — do NOT rely on the reactive useEffect
      // in App.tsx, which can silently miss the state update.
      if (data) setProfile(data);
      onComplete();
    } catch (e: any) {
      Alert.alert('Error saving profile', e.message ?? 'Could not save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step renderers ────────────────────────────────────────────────────────

  const renderIdentity = () => (
    <>
      <Text style={styles.stepTitle}>What should{'\n'}we call you?</Text>
      <Text style={styles.stepSub}>This is how your partner will see you.</Text>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Display Name *</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="e.g. Amara"
          placeholderTextColor="#B5947A"
          autoCapitalize="words"
          autoFocus
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Username (optional)</Text>
        <View style={styles.inputRow}>
          <Text style={styles.inputPrefix}>@</Text>
          <TextInput
            style={[styles.input, styles.inputFlex]}
            value={username}
            onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
            placeholder="yourhandle"
            placeholderTextColor="#B5947A"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <Text style={styles.hint}>Letters, numbers, _ and . only.</Text>
      </View>
    </>
  );

  const renderAbout = () => (
    <>
      <Text style={styles.stepTitle}>Tell us a bit{'\n'}about yourself</Text>
      <Text style={styles.stepSub}>Helps your partner know you better.</Text>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Bio (optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={bio}
          onChangeText={setBio}
          placeholder="Something fun about you…"
          placeholderTextColor="#B5947A"
          multiline
          numberOfLines={3}
          maxLength={150}
        />
        <Text style={styles.charCount}>{bio.length}/150</Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>I identify as</Text>
        <SexSelector value={sex} onChange={setSex} />
      </View>
    </>
  );

  const renderLocation = () => (
    <>
      <Text style={styles.stepTitle}>Where are{'\n'}you based?</Text>
      <Text style={styles.stepSub}>Helps us understand your bond's geography.</Text>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Country (optional)</Text>
        <CountryPicker value={country} onChange={setCountry} />
      </View>
    </>
  );

  const renderTerms = () => (
    <>
      <Text style={styles.stepTitle}>One last{'\n'}thing</Text>
      <Text style={styles.stepSub}>Your bond. Your privacy. Always.</Text>

      <View style={styles.termsCard}>
        <Text style={styles.termsHeading}>📜 Terms & Privacy</Text>
        <ScrollView style={styles.termsScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
          <Text style={styles.termsBody}>
            {`Welcome to TAKAM. By using this service you agree to the following:\n\n`}
            {`1. TAKAM is a private bonding platform. Only users in a confirmed bond may interact with each other.\n\n`}
            {`2. Your data (messages, vibes, gift records) is stored securely on Supabase and is never shared with third parties.\n\n`}
            {`3. You must be 18 or older to use TAKAM.\n\n`}
            {`4. Harassment, abuse, or any harmful behavior is grounds for immediate account termination.\n\n`}
            {`5. Gift transactions are facilitated through third-party providers. TAKAM is not responsible for delivery issues.\n\n`}
            {`6. You may delete your account at any time. Upon deletion, all your data is permanently removed.\n\n`}
            {`7. We use analytics solely to improve the app — never for advertising.\n\n`}
            {`Thank you for choosing TAKAM. Protect your bond. 💞`}
          </Text>
        </ScrollView>
      </View>

      <TouchableOpacity
        style={styles.checkRow}
        onPress={() => setTermsAccepted((v) => !v)}
        activeOpacity={0.8}
      >
        <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
          {termsAccepted && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={styles.checkLabel}>
          I agree to the{' '}
          <Text style={styles.checkLink}>Terms of Service</Text> and{' '}
          <Text style={styles.checkLink}>Privacy Policy</Text>
        </Text>
      </TouchableOpacity>
    </>
  );

  const isLastStep = step === 'terms';

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" />
      <LinearGradient
        colors={['#FDFAF4', '#F5ECD7', '#EDD9B8']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Decorative bg */}
      <View style={[styles.blob, styles.blobTR]} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.miniLogo}>
            <LinearGradient
              colors={['#D97B60', '#C9705A']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={styles.miniLogoInner} />
          </View>
          <Text style={styles.brandSmall}>TAKAM</Text>
          <StepDots current={step} />
        </View>

        {/* Animated step content */}
        <Animated.View style={[styles.stepContent, { transform: [{ translateX: slideAnim }] }]}>
          {step === 'identity' && renderIdentity()}
          {step === 'about' && renderAbout()}
          {step === 'location' && renderLocation()}
          {step === 'terms' && renderTerms()}
        </Animated.View>

        {/* Navigation */}
        <View style={styles.navRow}>
          {STEPS.indexOf(step) > 0 && (
            <TouchableOpacity style={styles.backBtn} onPress={goBack} activeOpacity={0.75}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
          )}

          {!isLastStep ? (
            <TouchableOpacity style={styles.nextBtn} onPress={goNext} activeOpacity={0.87}>
              <LinearGradient
                colors={['#D97B60', '#C9705A', '#A8503E']}
                style={styles.nextGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.nextText}>Continue →</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.nextBtn, !termsAccepted && styles.nextBtnDisabled]}
              onPress={handleFinish}
              disabled={loading || !termsAccepted}
              activeOpacity={0.87}
            >
              <LinearGradient
                colors={
                  termsAccepted
                    ? ['#D97B60', '#C9705A', '#A8503E']
                    : ['#D9BC8A', '#C5A870']
                }
                style={styles.nextGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {loading ? (
                  <ActivityIndicator color="#FDFAF4" />
                ) : (
                  <Text style={styles.nextText}>Enter Your Bond 💞</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        {step === 'identity' && (
          <Text style={styles.skipNote}>
            You can update all fields later in your profile.
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const dots = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, marginTop: 10 },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#D9BC8A',
  },
  active: { backgroundColor: '#C9705A', width: 20 },
  done: { backgroundColor: '#B5947A' },
});

const cpStyles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FDFAF4',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#D9BC8A',
    paddingVertical: 15,
    paddingHorizontal: 18,
  },
  triggerText: { fontSize: 15, color: '#3D2B1F', fontWeight: '500' },
  placeholder: { fontSize: 15, color: '#B5947A' },
  arrow: { fontSize: 11, color: '#8C6246' },
  dropdown: {
    backgroundColor: '#FDFAF4',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#D9BC8A',
    marginTop: 4,
    overflow: 'hidden',
    shadowColor: '#3D2B1F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
  },
  search: {
    borderBottomWidth: 1,
    borderBottomColor: '#EDD9B8',
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#3D2B1F',
  },
  list: { maxHeight: 200 },
  item: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0E4CA',
  },
  itemSelected: { backgroundColor: '#FDF0EC' },
  itemText: { fontSize: 14, color: '#3D2B1F' },
  itemTextSelected: { color: '#C9705A', fontWeight: '700' },
});

const sexStyles = StyleSheet.create({
  row: { gap: 8 },
  option: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D9BC8A',
    paddingVertical: 13,
    paddingHorizontal: 18,
    backgroundColor: '#FDFAF4',
  },
  optionActive: {
    borderColor: '#C9705A',
    backgroundColor: '#FDF0EC',
  },
  optionText: { fontSize: 14, color: '#8C6246', fontWeight: '500' },
  optionTextActive: { color: '#C9705A', fontWeight: '700' },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5ECD7' },
  scroll: { paddingBottom: 48 },

  blob: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.12,
    backgroundColor: '#C9705A',
  },
  blobTR: { width: 240, height: 240, top: -70, right: -70 },

  header: {
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 8,
    gap: 4,
  },
  miniLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#9B3D2C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  miniLogoInner: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(253,250,244,0.9)',
    zIndex: 1,
  },
  brandSmall: {
    fontSize: 18,
    fontWeight: '900',
    color: '#3D2B1F',
    letterSpacing: 5,
  },

  stepContent: {
    paddingHorizontal: 24,
    paddingTop: 28,
    gap: 20,
  },
  stepTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#3D2B1F',
    lineHeight: 40,
    letterSpacing: 0.2,
  },
  stepSub: {
    fontSize: 14,
    color: '#8C6246',
    lineHeight: 20,
    marginBottom: 4,
  },

  fieldGroup: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#5C3D2E', letterSpacing: 0.3 },
  hint: { fontSize: 11, color: '#B5947A' },
  charCount: { fontSize: 11, color: '#B5947A', textAlign: 'right' },

  input: {
    backgroundColor: '#FDFAF4',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#D9BC8A',
    paddingVertical: 15,
    paddingHorizontal: 18,
    fontSize: 15,
    color: '#3D2B1F',
    shadowColor: '#3D2B1F',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  textArea: {
    height: 90,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  inputPrefix: {
    fontSize: 17,
    color: '#B5947A',
    paddingLeft: 18,
    paddingRight: 4,
    backgroundColor: '#FDFAF4',
    borderWidth: 1.5,
    borderRightWidth: 0,
    borderColor: '#D9BC8A',
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
    paddingVertical: 15,
    fontWeight: '600',
  },
  inputFlex: {
    flex: 1,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },

  termsCard: {
    backgroundColor: '#FDFAF4',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#D9BC8A',
    padding: 18,
    gap: 10,
    marginTop: 4,
  },
  termsHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#3D2B1F',
  },
  termsScroll: { maxHeight: 220 },
  termsBody: {
    fontSize: 13,
    color: '#5C3D2E',
    lineHeight: 20,
  },

  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#C9705A',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: '#C9705A' },
  checkmark: { fontSize: 13, color: '#FDFAF4', fontWeight: '900' },
  checkLabel: { flex: 1, fontSize: 13, color: '#8C6246', lineHeight: 20 },
  checkLink: { color: '#C9705A', fontWeight: '700' },

  navRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 12,
    marginTop: 32,
    alignItems: 'center',
  },
  backBtn: { paddingVertical: 16, paddingHorizontal: 4 },
  backText: { fontSize: 15, color: '#8C6246', fontWeight: '600' },
  nextBtn: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#9B3D2C',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 7,
  },
  nextBtnDisabled: {
    shadowOpacity: 0.1,
    elevation: 2,
  },
  nextGrad: {
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FDFAF4',
    letterSpacing: 0.3,
  },

  skipNote: {
    textAlign: 'center',
    fontSize: 12,
    color: '#B5947A',
    marginTop: 14,
    paddingHorizontal: 32,
  },
});
