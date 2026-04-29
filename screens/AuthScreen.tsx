import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { shadow } from '../lib/theme/shadows';
import { signInWithGoogle } from '../lib/auth/google';
import { signInWithApple, isAppleSignInAvailable } from '../lib/auth/apple';

const { height } = Dimensions.get('window');

export interface AuthScreenProps {
  initialMode?: 'signup' | 'signin' | 'reset';
  onBack?: () => void;
}

type ScreenMode = 'main' | 'email' | 'forgot' | 'reset';

export default function AuthScreen({ initialMode, onBack }: AuthScreenProps) {
  const [loading, setLoading] = useState<'google' | 'apple' | 'email' | null>(null);
  const [screenMode, setScreenMode] = useState<ScreenMode>(() => {
    if (initialMode === 'reset') return 'reset';
    return initialMode ? 'email' : 'main';
  });
  const [isSignUp, setIsSignUp] = useState(initialMode === 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleEmailAuth = async () => {
    if (!email.trim() || password.length < 6) {
      Alert.alert('Invalid Input', 'Enter a valid email and a password (min 6 chars).');
      return;
    }
    setLoading('email');
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        Alert.alert('Check your email ✉️', 'We sent you a confirmation link.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(null);
    }
  };

  const handleBack = () => {
    if (screenMode !== 'main') setScreenMode('main');
    else onBack?.();
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <LinearGradient colors={['#FDFAF4', '#F5ECD7', '#EDD9B8']} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
           <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
           <Text style={styles.logo}>TAKAM</Text>
           <Text style={styles.title}>{isSignUp ? 'Join the Bond' : 'Welcome Back'}</Text>
        </View>

        <View style={styles.form}>
           <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email" keyboardType="email-address" autoCapitalize="none" />
           <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry />
           
           <TouchableOpacity style={styles.submitBtn} onPress={handleEmailAuth} disabled={!!loading}>
             {loading === 'email' ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitText}>{isSignUp ? 'Sign Up' : 'Sign In'}</Text>}
           </TouchableOpacity>
        </View>

        <Text style={styles.disclaimer}>
          By continuing, you agree to our <Text style={styles.link} onPress={() => Linking.openURL('https://takam.app/terms')}>Terms</Text> & <Text style={styles.link} onPress={() => Linking.openURL('https://takam.app/privacy')}>Privacy Policy</Text>.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, padding: 30, justifyContent: 'center' },
  backBtn: { position: 'absolute', top: 60, left: 30 },
  backText: { color: '#8C6246', fontWeight: '700' },
  header: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 32, fontWeight: '900', color: '#3D2B1F', letterSpacing: 8, marginBottom: 10 },
  title: { fontSize: 20, fontWeight: '700', color: '#8C6246' },
  form: { gap: 15 },
  input: { backgroundColor: '#FFF', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#D9BC8A' },
  submitBtn: { backgroundColor: '#C9705A', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 10 },
  submitText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  disclaimer: { fontSize: 12, color: '#B5947A', textAlign: 'center', marginTop: 40, lineHeight: 18 },
  link: { textDecorationLine: 'underline', fontWeight: '700' }
});
