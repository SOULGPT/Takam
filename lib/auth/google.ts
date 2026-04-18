import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { supabase } from '../supabase';

// Only configure GoogleSignin on native platforms
if (Platform.OS !== 'web') {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    // REPLACE WITH: [Your-ID].apps.googleusercontent.com from GoogleService-Info.plist
    iosClientId: '631733089392-uq1nau14bjmftq0d08021r5c4u0d92mq.apps.googleusercontent.com', 
    scopes: ['profile', 'email'],
  });
}

// Helper: Generate a random string
function generateNonce(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Helper: Simple SHA-256 for nonce hashing
async function sha256(message: string) {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    message
  );
}

export async function signInWithGoogle(): Promise<void> {
  if (Platform.OS === 'web') {
    // Web: use Supabase's built-in OAuth redirect flow
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) throw error;
    // No further action needed — browser will redirect to Google then back
    return;
  }

  // Native (Android / iOS): use native Google Sign-In SDK
  await GoogleSignin.hasPlayServices();
  
  const rawNonce = generateNonce();
  const hashedNonce = await sha256(rawNonce);

  const userInfo = await GoogleSignin.signIn({
    // @ts-ignore
    nonce: hashedNonce,
  });
  
  const idToken = userInfo.data?.idToken;

  if (!idToken) throw new Error('Google Sign-In failed: no ID token.');

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
    nonce: rawNonce,
  });

  if (error) throw error;
}

export async function signOut(): Promise<void> {
  // Always sign out of Supabase first
  await supabase.auth.signOut();

  // Also clear the native Google session (if on native)
  if (Platform.OS !== 'web') {
    try {
      await GoogleSignin.signOut();
    } catch (_) {
      // Silently ignore if user didn't sign in via Google
    }
  }
}
