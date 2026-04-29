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
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { shadow } from '../lib/theme/shadows';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';

const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Angola', 'Argentina', 'Australia', 'Austria',
  'Bangladesh', 'Belgium', 'Bolivia', 'Brazil', 'Cameroon', 'Canada', 'Chile', 'China',
  'Colombia', 'Congo', "Côte d'Ivoire", 'Cuba', 'Czech Republic', 'Denmark', 'Ecuador',
  'Egypt', 'Ethiopia', 'Finland', 'France', 'Germany', 'Ghana', 'Greece', 'Guatemala',
  'Haiti', 'Hungary', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy',
  'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'South Korea', 'Kuwait',
  'Lebanon', 'Libya', 'Malaysia', 'Mali', 'Mexico', 'Morocco', 'Mozambique', 'Myanmar',
  'Netherlands', 'New Zealand', 'Niger', 'Nigeria', 'Norway', 'Pakistan', 'Panama',
  'Peru', 'Philippines', 'Poland', 'Portugal', 'Romania', 'Russia', 'Rwanda',
  'Saudi Arabia', 'Senegal', 'Serbia', 'Sierra Leone', 'South Africa', 'Spain',
  'Sri Lanka', 'Sudan', 'Sweden', 'Switzerland', 'Syria', 'Tanzania', 'Thailand',
  'Tunisia', 'Turkey', 'Uganda', 'Ukraine', 'United Kingdom', 'United States',
  'Uruguay', 'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe', 'Other',
];

type Sex = 'male' | 'female' | 'prefer_not_to_say';
type Step = 'identity' | 'about' | 'location' | 'terms';

const STEPS: Step[] = ['identity', 'about', 'location', 'terms'];

function StepDots({ current }: { current: Step }) {
  const idx = STEPS.indexOf(current);
  return (
    <View style={styles.dotsRow}>
      {STEPS.map((s, i) => (
        <View
          key={s}
          style={[styles.dot, i === idx && styles.dotActive, i < idx && styles.dotDone]}
        />
      ))}
    </View>
  );
}

export default function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const { session, setProfile } = useStore();
  const [step, setStep] = useState<Step>('identity');
  const [loading, setLoading] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [country, setCountry] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const slideAnim = useRef(new Animated.Value(0)).current;

  const animateNext = (nextStep: Step) => {
    Animated.timing(slideAnim, { toValue: -20, duration: 150, useNativeDriver: true }).start(() => {
      setStep(nextStep);
      slideAnim.setValue(20);
      Animated.timing(slideAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    });
  };

  const handleFinish = async () => {
    if (!termsAccepted) {
      Alert.alert('Required', 'Please accept the Terms & Privacy Policy.');
      return;
    }
    if (!session?.user) return;

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
      if (data) setProfile(data);
      onComplete();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <LinearGradient colors={['#FDFAF4', '#F5ECD7']} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="always">
        <View style={styles.header}>
          <Text style={styles.brand}>TAKAM</Text>
          <StepDots current={step} />
        </View>

        <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>
          {step === 'identity' && (
            <View style={styles.stepContainer}>
              <Text style={styles.title}>What's your name?</Text>
              <TextInput 
                style={styles.input} 
                value={displayName} 
                onChangeText={setDisplayName} 
                placeholder="Display Name" 
              />
            </View>
          )}
          {step === 'terms' && (
            <View style={styles.stepContainer}>
              <Text style={styles.title}>Legal</Text>
              <TouchableOpacity onPress={() => setTermsAccepted(!termsAccepted)} style={styles.checkRow}>
                 <View style={[styles.checkbox, termsAccepted && styles.checkboxActive]} />
                 <Text>I agree to the Terms & Privacy Policy</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>

        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.btn} 
            onPress={step === 'terms' ? handleFinish : () => animateNext('terms')}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>{step === 'terms' ? 'Complete' : 'Continue'}</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 30, paddingTop: 60 },
  header: { alignItems: 'center', marginBottom: 40 },
  brand: { fontSize: 20, fontWeight: '900', color: '#3D2B1F', letterSpacing: 4 },
  dotsRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D9BC8A' },
  dotActive: { backgroundColor: '#C9705A', width: 20 },
  dotDone: { backgroundColor: '#B5947A' },
  stepContainer: { gap: 20 },
  title: { fontSize: 28, fontWeight: '800', color: '#3D2B1F' },
  input: { backgroundColor: '#FFF', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#D9BC8A' },
  footer: { marginTop: 40 },
  btn: { backgroundColor: '#C9705A', padding: 18, borderRadius: 16, alignItems: 'center' },
  btnText: { color: '#FFF', fontWeight: '800' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#C9705A' },
  checkboxActive: { backgroundColor: '#C9705A' },
});
