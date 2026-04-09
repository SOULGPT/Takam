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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { signInWithGoogle } from '../lib/auth/google';
import { signInWithApple, isAppleSignInAvailable } from '../lib/auth/apple';

const { height } = Dimensions.get('window');

// AuthScreen can be launched in two modes from the Landing screen:
//  — 'signup'  → opens directly on the email sign-up form
//  — 'signin'  → opens directly on the email sign-in form
//  — undefined → shows the main provider-selection screen
export interface AuthScreenProps {
  initialMode?: 'signup' | 'signin';
  onBack?: () => void;
}

type ScreenMode = 'main' | 'email';

export default function AuthScreen({ initialMode, onBack }: AuthScreenProps) {
  const [loading, setLoading] = useState<'google' | 'apple' | 'email' | null>(null);
  const [screenMode, setScreenMode] = useState<ScreenMode>(
    initialMode ? 'email' : 'main',
  );
  const [isSignUp, setIsSignUp] = useState(initialMode === 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // ── Google OAuth ──────────────────────────────────────────────────────────
  const handleGoogle = async () => {
    setLoading('google');
    try {
      await signInWithGoogle();
    } catch (e: any) {
      Alert.alert('Sign-In Failed', e.message ?? 'Try again.');
    } finally {
      setLoading(null);
    }
  };

  // ── Apple OAuth (iOS only) ────────────────────────────────────────────────
  const handleApple = async () => {
    setLoading('apple');
    try {
      await signInWithApple();
    } catch (e: any) {
      if (e.code !== 'ERR_CANCELED') {
        Alert.alert('Sign-In Failed', e.message ?? 'Try again.');
      }
    } finally {
      setLoading(null);
    }
  };

  // ── Email / Password ──────────────────────────────────────────────────────
  const handleEmailAuth = async () => {
    if (!email.trim() || password.length < 6) {
      Alert.alert('Invalid Input', 'Enter a valid email and a password (min 6 chars).');
      return;
    }
    if (isSignUp && password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Your passwords do not match.');
      return;
    }
    setLoading('email');
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        Alert.alert(
          'Check your email ✉️',
          'We sent you a confirmation link. Click it to activate your account, then sign in.',
        );
        setIsSignUp(false);
        setPassword('');
        setConfirmPassword('');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        // Session set automatically — App.tsx will navigate
      }
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Something went wrong.');
    } finally {
      setLoading(null);
    }
  };

  const handleBack = () => {
    if (screenMode === 'email') {
      if (initialMode) {
        // Came from landing — go all the way back
        onBack?.();
      } else {
        setScreenMode('main');
      }
    } else {
      onBack?.();
    }
  };

  // ── Main provider selection screen ────────────────────────────────────────
  if (screenMode === 'main') {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="dark-content" backgroundColor="#F5ECD7" />

        <LinearGradient
          colors={['#FDFAF4', '#F5ECD7', '#EDD9B8']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />

        <View style={[styles.blob, styles.blobTL]} />
        <View style={[styles.blob, styles.blobBR]} />

        <View style={styles.content}>
          {/* Back to landing */}
          {onBack && (
            <TouchableOpacity style={styles.topBack} onPress={onBack} activeOpacity={0.75}>
              <Text style={styles.topBackText}>← Back</Text>
            </TouchableOpacity>
          )}

          {/* Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logoOuter}>
              <LinearGradient
                colors={['#D97B60', '#C9705A', '#A8503E']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={styles.logoInner} />
            </View>
            <Text style={styles.logoText}>TAKAM</Text>
            <Text style={styles.tagline}>Your private universe, for two.</Text>
          </View>

          {/* Buttons */}
          <View style={styles.buttonsSection}>
            <Text style={styles.joinText}>Join the Bond</Text>

            {/* Google */}
            <TouchableOpacity
              style={styles.googleButton}
              onPress={handleGoogle}
              disabled={!!loading}
              activeOpacity={0.85}
            >
              {loading === 'google' ? (
                <ActivityIndicator color="#3D2B1F" />
              ) : (
                <>
                  <Text style={styles.googleIcon}>G</Text>
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Apple — iOS only */}
            {isAppleSignInAvailable && (
              <TouchableOpacity
                style={styles.appleButton}
                onPress={handleApple}
                disabled={!!loading}
                activeOpacity={0.85}
              >
                {loading === 'apple' ? (
                  <ActivityIndicator color="#F5ECD7" />
                ) : (
                  <>
                    <Text style={styles.appleIcon}></Text>
                    <Text style={styles.appleButtonText}>Continue with Apple</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Email */}
            <TouchableOpacity
              style={styles.emailButton}
              onPress={() => setScreenMode('email')}
              disabled={!!loading}
              activeOpacity={0.85}
            >
              <Text style={styles.emailButtonText}>✉️  Continue with Email</Text>
            </TouchableOpacity>

            <Text style={styles.disclaimer}>
              By continuing, you agree to our Terms & Privacy Policy.{'\n'}
              Your bond is private and encrypted.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // ── Email sign-in / sign-up screen ────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={['#FDFAF4', '#F5ECD7', '#EDD9B8']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <ScrollView
        contentContainerStyle={styles.emailContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <TouchableOpacity onPress={handleBack} style={styles.backRow}>
          <Text style={styles.backArrow}>← Back</Text>
        </TouchableOpacity>

        {/* Logo small */}
        <View style={styles.logoSmall}>
          <View style={styles.logoOuterSmall}>
            <LinearGradient
              colors={['#D97B60', '#C9705A']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={styles.logoInnerSmall} />
          </View>
          <Text style={styles.logoTextSmall}>TAKAM</Text>
        </View>

        <Text style={styles.emailTitle}>
          {isSignUp ? 'Create Account' : 'Welcome Back'}
        </Text>
        <Text style={styles.emailSubtitle}>
          {isSignUp
            ? 'Sign up to start your private bond.'
            : 'Sign in to return to your bond.'}
        </Text>

        {/* Email input */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#B5947A"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Password input */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="min. 6 characters"
            placeholderTextColor="#B5947A"
            secureTextEntry
          />
        </View>

        {/* Confirm password — sign-up only */}
        {isSignUp && (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="re-enter password"
              placeholderTextColor="#B5947A"
              secureTextEntry
            />
          </View>
        )}

        {/* Submit */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            loading === 'email' && styles.submitButtonDisabled,
          ]}
          onPress={handleEmailAuth}
          disabled={loading === 'email'}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={
              loading === 'email'
                ? ['#D9BC8A', '#C5A870']
                : ['#D97B60', '#C9705A', '#A8503E']
            }
            style={styles.submitGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {loading === 'email' ? (
              <ActivityIndicator color="#F5ECD7" />
            ) : (
              <Text style={styles.submitButtonText}>
                {isSignUp ? 'Create Account →' : 'Sign In →'}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Toggle mode */}
        <TouchableOpacity
          onPress={() => {
            setIsSignUp((v) => !v);
            setPassword('');
            setConfirmPassword('');
          }}
          style={styles.toggleRow}
        >
          <Text style={styles.toggleText}>
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            <Text style={styles.toggleLink}>
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </Text>
          </Text>
        </TouchableOpacity>

        {/* Other providers link */}
        {!initialMode && (
          <TouchableOpacity
            onPress={() => setScreenMode('main')}
            style={styles.otherProvidersRow}
          >
            <Text style={styles.otherProvidersText}>
              Use Google or Apple instead
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5ECD7' },

  blob: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.15,
    backgroundColor: '#C9705A',
  },
  blobTL: { width: 280, height: 280, top: -80, left: -80 },
  blobBR: {
    width: 220,
    height: 220,
    bottom: -60,
    right: -60,
    backgroundColor: '#B5947A',
  },

  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: height * 0.12,
    paddingBottom: 48,
  },
  topBack: { position: 'absolute', top: 56, left: 28 },
  topBackText: { fontSize: 15, color: '#8C6246', fontWeight: '600' },

  logoContainer: { alignItems: 'center', gap: 12 },
  logoOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#9B3D2C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  logoInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(253,250,244,0.9)',
  },
  logoText: {
    fontSize: 38,
    fontWeight: '800',
    color: '#3D2B1F',
    letterSpacing: 6,
    marginTop: 8,
  },
  tagline: { fontSize: 15, color: '#8C6246', fontStyle: 'italic', letterSpacing: 0.5 },

  buttonsSection: { gap: 14 },
  joinText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#3D2B1F',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#FDFAF4',
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: '#D9BC8A',
    shadowColor: '#3D2B1F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  googleIcon: { fontSize: 20, fontWeight: '700', color: '#C9705A' },
  googleButtonText: { fontSize: 16, fontWeight: '600', color: '#3D2B1F', letterSpacing: 0.2 },

  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#1A0F09',
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: '#1A0F09',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  appleIcon: { fontSize: 20, color: '#F5ECD7' },
  appleButtonText: { fontSize: 16, fontWeight: '600', color: '#F5ECD7', letterSpacing: 0.2 },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 2 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#D9BC8A' },
  dividerText: { fontSize: 13, color: '#B5947A', fontWeight: '500' },

  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: '#C9705A',
  },
  emailButtonText: { fontSize: 16, fontWeight: '600', color: '#C9705A', letterSpacing: 0.2 },

  disclaimer: {
    fontSize: 11,
    color: '#B5947A',
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 6,
  },

  // ── Email screen ──
  emailContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 56,
    paddingBottom: 48,
    gap: 16,
  },
  backRow: { marginBottom: 4 },
  backArrow: { fontSize: 15, color: '#8C6246', fontWeight: '600' },

  logoSmall: { alignItems: 'center', gap: 8, marginBottom: 8 },
  logoOuterSmall: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#9B3D2C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  logoInnerSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(253,250,244,0.9)',
  },
  logoTextSmall: { fontSize: 22, fontWeight: '800', color: '#3D2B1F', letterSpacing: 5 },

  emailTitle: { fontSize: 26, fontWeight: '800', color: '#3D2B1F', letterSpacing: 0.2 },
  emailSubtitle: { fontSize: 14, color: '#8C6246', lineHeight: 20, marginBottom: 4 },

  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#5C3D2E', letterSpacing: 0.3 },
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

  submitButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 4,
    shadowColor: '#9B3D2C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  submitButtonDisabled: { shadowOpacity: 0.1, elevation: 2 },
  submitGrad: { paddingVertical: 17, alignItems: 'center' },
  submitButtonText: { fontSize: 16, fontWeight: '700', color: '#F5ECD7', letterSpacing: 0.4 },

  toggleRow: { alignItems: 'center', marginTop: 4 },
  toggleText: { fontSize: 14, color: '#8C6246' },
  toggleLink: { color: '#C9705A', fontWeight: '700' },

  otherProvidersRow: { alignItems: 'center', marginTop: 2 },
  otherProvidersText: { fontSize: 13, color: '#B5947A', textDecorationLine: 'underline' },
});
