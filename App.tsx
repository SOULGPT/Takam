import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet, AppState, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { supabase } from './lib/supabase';
import * as Linking from 'expo-linking';
import { useStore, Bond, Profile } from './store/useStore';
import LandingScreen from './screens/LandingScreen';
import AuthScreen from './screens/AuthScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import TabNavigator from './navigation/TabNavigator';
import ChatScreen from './screens/ChatScreen';
import { Session } from '@supabase/supabase-js';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AdminNavigator from './navigation/AdminNavigator';
import UpgradeScreen from './screens/UpgradeScreen';
import { signInWithGoogle } from './lib/auth/google';
import { signInWithApple } from './lib/auth/apple';
import { 
  useFonts, 
  CormorantGaramond_400Regular, 
  CormorantGaramond_700Bold 
} from '@expo-google-fonts/cormorant-garamond';
import { 
  Caveat_400Regular, 
  Caveat_700Bold 
} from '@expo-google-fonts/caveat';

const RootStack = createNativeStackNavigator();

// ── Auth-flow state machine ──────────────────────────────────────────────────
// 'reset'      → user clicked forgot-password link in email → AuthScreen reset mode
// 'onboarding' → just signed up, profile incomplete → OnboardingScreen
// null         → authenticated + profile complete → show main TabNavigator
type AuthFlow = 'landing' | 'signup' | 'signin' | 'reset' | 'onboarding' | null;

function AppCore() {
  const {
    session,
    setSession,
    setBonds,
    setBondMember,
    setActiveBondId,
    setProfile,
    updateBond,
    activeBondId,
    bonds,
  } = useStore();
  const [loading, setLoading] = useState(true);
  const [authFlow, setAuthFlow] = useState<AuthFlow>('landing');

  const [fontsLoaded] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_700Bold,
    Caveat_400Regular,
    Caveat_700Bold,
  });

  // ── Auth-flow state machine hooks must be at top level ──────────────────────
  // (Moving effect declarations above early return)

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      const state = useStore.getState();
      if (!state.session?.user?.id) return;
      if (nextAppState === 'active') {
         await supabase.from('profiles').update({ is_online: true, last_active_at: new Date().toISOString() }).eq('id', state.session.user.id);
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
         await supabase.from('profiles').update({ is_online: false }).eq('id', state.session.user.id);
      }
    });
    return () => subscription.remove();
  }, []);

  // ── Helper: fetch one partner profile and store it ────────────────────────
  const fetchMember = async (bond: Bond, myId: string) => {
    const partnerId = bond.user_a === myId ? bond.user_b : bond.user_a;
    if (!partnerId) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', partnerId)
      .single();
    if (data) setBondMember(bond.id, data as Profile);
  };

  // ── Load profile + ALL bonds on session change ────────────────────────────
  useEffect(() => {
    if (!session?.user) {
      setBonds([]);
      setActiveBondId(null);
      setProfile(null);
      setAuthFlow('landing');
      return;
    }

    (async () => {
      try {
        // 1. Own profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profileData) {
          let prof = profileData as Profile;
          
          // Forcefully broadcast online presence immediately on boot
          if (!prof.is_online) {
             await supabase.from('profiles').update({ is_online: true, last_active_at: new Date().toISOString() }).eq('id', prof.id);
             prof.is_online = true;
          }

          // Automated Downgrade Check
          if (prof.is_premium && prof.premium_expires_at && new Date(prof.premium_expires_at) < new Date()) {
            await supabase.from('profiles').update({ is_premium: false, subscription_tier: 'free', premium_expires_at: null }).eq('id', prof.id);
            prof = { ...prof, is_premium: false, subscription_tier: 'free', premium_expires_at: undefined };
          }

          setProfile(prof);
          if (!prof.display_name) {
            setAuthFlow('onboarding');
          } else {
            // Profile complete, start push token sync
            import('./lib/push').then(({ registerForPushNotificationsAsync }) => {
              registerForPushNotificationsAsync(session.user.id);
            });
          }
        } else {
          setAuthFlow('onboarding');
        }

        // 2. Fetch ALL bonds (pending + active)
        const { data: bondRows } = await supabase
          .from('bonds')
          .select('*')
          .or(`user_a.eq.${session.user.id},user_b.eq.${session.user.id}`)
          .in('status', ['pending', 'active'])
          .order('created_at', { ascending: false });

        const allBonds = (bondRows ?? []) as Bond[];
        setBonds(allBonds);

        // 3. Resolve partner profiles for all active bonds
        await Promise.all(
          allBonds
            .filter((b) => b.status === 'active')
            .map((b) => fetchMember(b, session.user.id)),
        );

        // 4. Fetch initial Unread Counts
        try {
          const { data: unreadData } = await supabase.rpc('get_unread_counts');
          if (unreadData) {
            const countsMap: Record<string, number> = {};
            unreadData.forEach((row: any) => {
              countsMap[row.bond_id] = Number(row.unread_count || 0);
            });
            useStore.getState().setUnreadCounts(countsMap);
          }
        } catch (e) {
          console.warn('Failed to fetch unread counts', e);
        }

        // 5. Default active bond → first active one
        const firstActive = allBonds.find((b) => b.status === 'active');
        if (firstActive) setActiveBondId(firstActive.id);
      } catch (_) {}
    })();
  }, [session?.user?.id]);

  // ── Real-time watcher: bond updates (pending → active) ───────────────────
  // Watches all pending bonds belonging to this user.
  useEffect(() => {
    if (!session?.user?.id) return;

    const pendingIds = bonds
      .filter((b) => b.status === 'pending' && b.user_a === session.user.id)
      .map((b) => b.id);

    if (!pendingIds.length) return;

    // One channel per pending bond (Supabase filter supports single eq per channel)
    const channels = pendingIds.map((bondId) =>
      supabase
        .channel(`bond_watch:${bondId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'bonds',
            filter: `id=eq.${bondId}`,
          },
          async (payload) => {
            const updated = payload.new as Bond;
            updateBond(updated);
            if (updated.status === 'active') {
              await fetchMember(updated, session.user.id);
              // Auto-set as active if user has no active bond yet
              if (!useStore.getState().activeBondId) {
                setActiveBondId(updated.id);
              }
            }
          },
        )
        .subscribe(),
    );

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [bonds.map((b) => b.id).join(','), session?.user?.id]);

  // ── Global Real-time Watcher for Unread Counts ───────────────────────────
  useEffect(() => {
    if (!session?.user?.id) return;

    const globalChannel = supabase
      .channel('global_unread_watcher')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          if (payload.new.sender_id !== session.user.id) {
            // Only increment if we are not currently actively looking at THIS bond's ChatScreen
            // (We'll assume strict clearing happens in ChatScreen onFocus)
            useStore.getState().incrementUnread(payload.new.bond_id, 1);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'vibes' },
        (payload) => {
          if (payload.new.sender_id !== session.user.id) {
            useStore.getState().incrementUnread(payload.new.bond_id, 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(globalChannel);
    };
  }, [session?.user?.id]);

  // ── Auth bootstrap + listener ─────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const handleUrl = (url: string) => {
      const { queryParams } = Linking.parse(url);
      if (queryParams?.access_token) {
        // Supabase catch-all for deep links with tokens
      }
    };

    const linkSub = Linking.addEventListener('url', (event) => {
      handleUrl(event.url);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session: Session | null) => {
      setSession(session);
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setLoading(false);
      }
      if (event === 'PASSWORD_RECOVERY') {
        setAuthFlow('reset');
      }
    });

    return () => {
      linkSub.remove();
      subscription.unsubscribe();
    };
  }, []);

  // ── Loading spinner ───────────────────────────────────────────────────────
  if (!fontsLoaded || loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#C9705A" />
      </View>
    );
  }

  // ── Unauthenticated ───────────────────────────────────────────────────────
  if (!session) {
    if (authFlow === 'signup') {
      return <AuthScreen initialMode="signup" onBack={() => setAuthFlow('landing')} />;
    }
    if (authFlow === 'signin') {
      return <AuthScreen initialMode="signin" onBack={() => setAuthFlow('landing')} />;
    }
    if (authFlow === 'reset') {
      return <AuthScreen initialMode="reset" onBack={() => setAuthFlow('landing')} />;
    }
    return (
      <LandingScreen
        onGetStarted={() => setAuthFlow('signup')}
        onSignIn={() => setAuthFlow('signin')}
        onGoogleSignIn={signInWithGoogle}
        onAppleSignIn={signInWithApple}
      />
    );
  }

  // ── Profile incomplete → onboarding ──────────────────────────────────────
  if (authFlow === 'onboarding') {
    return <OnboardingScreen onComplete={() => setAuthFlow(null)} />;
  }

  const { profile } = useStore.getState();

  // ── Authenticated: Route strictly based on ROLE ──────────────────────────
  if (profile?.role === 'admin') {
    return (
      <NavigationContainer>
        <AdminNavigator />
      </NavigationContainer>
    );
  }

  // ── Consumer App ──
  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="Main" component={TabNavigator} />
        <RootStack.Screen name="Chat" component={ChatScreen} />
        <RootStack.Screen name="Upgrade" component={UpgradeScreen} options={{ presentation: 'modal' }} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <View style={styles.webRoot}>
      <View style={styles.webContainer}>
        <AppCore />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  webRoot: { flex: 1, backgroundColor: '#1A1513' },
  webContainer: { 
    flex: 1, 
    width: '100%', 
    maxWidth: 500, // Universally caps stretching on iPads, Android Tablets, and Web simultaneously
    marginHorizontal: 'auto', 
    backgroundColor: '#F5ECD7', 
    overflow: 'hidden' 
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5ECD7',
  },
});
