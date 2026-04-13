import { Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { supabase } from '../supabase';

// Only configure GoogleSignin on native platforms
if (Platform.OS !== 'web') {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: 'com.googleusercontent.apps.631733089392-uq1nau14bjmftq0d08021r5c4u0d92mq', // <--- REPLACE THIS 
    scopes: ['profile', 'email'],
  });
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
  const userInfo = await GoogleSignin.signIn();
  const idToken = userInfo.data?.idToken;

  if (!idToken) throw new Error('Google Sign-In failed: no ID token.');

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
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
