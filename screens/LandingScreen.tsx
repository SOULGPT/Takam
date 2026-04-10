import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Animated,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { isAppleSignInAvailable } from '../lib/auth/apple';

const { width, height } = Dimensions.get('window');

export interface LandingScreenProps {
  onGetStarted: () => void;
  onSignIn: () => void;
  onGoogleSignIn: () => Promise<void>;
  onAppleSignIn: () => Promise<void>;
}

// ── Floating heart particle ───────────────────────────────────────────────────
function Heart({ delay, x, size }: { delay: number; x: number; size: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = () => {
      opacity.setValue(0);
      translateY.setValue(0);
      scale.setValue(0.4);
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0.6,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -(height * 0.55),
            duration: 3800,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(opacity, {
              toValue: 0.55,
              duration: 2000,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 1800,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]).start(() => loop());
    };
    loop();
  }, []);

  return (
    <Animated.Text
      style={[
        styles.heartParticle,
        {
          left: x,
          bottom: 60,
          fontSize: size,
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      ♥
    </Animated.Text>
  );
}

// ── Feature card ─────────────────────────────────────────────────────────────
function FeatureCard({
  icon,
  title,
  desc,
  delay,
}: {
  icon: string;
  title: string;
  desc: string;
  delay: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 600,
      delay,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.featureCard,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [24, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDesc}>{desc}</Text>
    </Animated.View>
  );
}

// ── Main landing screen ─────────────────────────────────────────────────────
export default function LandingScreen({ 
  onGetStarted, 
  onSignIn,
  onGoogleSignIn,
  onAppleSignIn
}: LandingScreenProps) {
  const [loading, setLoading] = useState<'google' | 'apple' | null>(null);
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const ctaTranslate = useRef(new Animated.Value(40)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Logo entrance
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();

    // Hero text
    Animated.timing(heroOpacity, {
      toValue: 1,
      duration: 800,
      delay: 400,
      useNativeDriver: true,
    }).start();

    // CTA buttons
    Animated.parallel([
      Animated.spring(ctaTranslate, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(ctaOpacity, {
        toValue: 1,
        duration: 600,
        delay: 700,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse logo ring
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.18,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const hearts = [
    { delay: 0, x: width * 0.1, size: 18 },
    { delay: 600, x: width * 0.28, size: 14 },
    { delay: 1200, x: width * 0.52, size: 22 },
    { delay: 400, x: width * 0.72, size: 16 },
    { delay: 900, x: width * 0.88, size: 12 },
  ];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5ECD7" />

      <LinearGradient
        colors={['#FDFAF4', '#F5ECD7', '#EDD9B8', '#E2C89A']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
      />

      {/* Decorative blobs */}
      <View style={[styles.blob, styles.blobTL]} />
      <View style={[styles.blob, styles.blobBR]} />
      <View style={[styles.blob, styles.blobMid]} />

      {/* Floating hearts */}
      {hearts.map((h, i) => (
        <Heart key={i} delay={h.delay} x={h.x} size={h.size} />
      ))}

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces
      >
        {/* ── Hero Section ───────────────────────────────────────────── */}
        <View style={styles.heroSection}>
          {/* Logo */}
          <Animated.View
            style={[
              styles.logoWrap,
              { opacity: logoOpacity, transform: [{ scale: logoScale }] },
            ]}
          >
            {/* Pulse ring */}
            <Animated.View
              style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]}
            />
            <View style={styles.logoOuter}>
              <LinearGradient
                colors={['#D97B60', '#C9705A', '#A8503E']}
                style={styles.logoGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.logoInner} />
              </LinearGradient>
            </View>
          </Animated.View>

          <Animated.View style={{ opacity: heroOpacity }}>
            <Text style={styles.brandName}>TAKAM</Text>
            <Text style={styles.tagline}>Your private universe,{'\n'}built for two.</Text>
            <Text style={styles.taglineSub}>
              Send vibes. Discover gifts. Stay close — no matter the distance.
            </Text>
          </Animated.View>
        </View>

        {/* ── Feature cards ──────────────────────────────────────────── */}
        <View style={styles.featuresRow}>
          <FeatureCard
            icon="💞"
            title="Real-time Vibes"
            desc="Send a heartbeat that your partner feels instantly."
            delay={600}
          />
          <FeatureCard
            icon="🎁"
            title="Mystery Gifts"
            desc="Curated surprises chosen by your partner, just for you."
            delay={750}
          />
          <FeatureCard
            icon="🔒"
            title="Fully Private"
            desc="Your bond is end-to-end encrypted. Just the two of you."
            delay={900}
          />
        </View>

        {/* ── Testimonial ────────────────────────────────────────────── */}
        <View style={styles.quoteCard}>
          <Text style={styles.quoteText}>
            "It makes long distance feel like we're in the same room."
          </Text>
          <Text style={styles.quoteAuthor}>— Early user, Nairobi & Paris</Text>
        </View>

        {/* ── CTA ────────────────────────────────────────────────────── */}
        <Animated.View
          style={[
            styles.ctaSection,
            { opacity: ctaOpacity, transform: [{ translateY: ctaTranslate }] },
          ]}
        >
          <TouchableOpacity
            style={styles.primaryCta}
            onPress={onGetStarted}
            activeOpacity={0.87}
          >
            <LinearGradient
              colors={['#D97B60', '#C9705A', '#A8503E']}
              style={styles.primaryCtaGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.primaryCtaText}>Start Your Bond →</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryCta}
            onPress={onSignIn}
            activeOpacity={0.87}
          >
            <Text style={styles.secondaryCtaText}>
              Already bonded?{' '}
              <Text style={styles.secondaryCtaLink}>Sign In</Text>
            </Text>
          </TouchableOpacity>

          <View style={styles.socialDivider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR JOIN WITH</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.socialRow}>
            <TouchableOpacity 
              style={styles.socialBtn} 
              onPress={async () => {
                setLoading('google');
                try { await onGoogleSignIn(); } catch(e: any) { Alert.alert('Error', e.message); }
                finally { setLoading(null); }
              }}
              disabled={!!loading}
            >
              <View style={styles.socialIconBox}>
                {loading === 'google' ? <ActivityIndicator size="small" color="#3D2B1F" /> : <Text style={styles.socialIconText}>G</Text>}
              </View>
              <Text style={styles.socialBtnText}>Google</Text>
            </TouchableOpacity>

            {isAppleSignInAvailable && (
              <TouchableOpacity 
                style={styles.socialBtn} 
                onPress={async () => {
                  setLoading('apple');
                  try { await onAppleSignIn(); } catch(e: any) { if (e.code !== 'ERR_CANCELED') Alert.alert('Error', e.message); }
                  finally { setLoading(null); }
                }}
                disabled={!!loading}
              >
                <View style={[styles.socialIconBox, { backgroundColor: '#1A0F09' }]}>
                   {loading === 'apple' ? <ActivityIndicator size="small" color="#F5ECD7" /> : <Text style={[styles.socialIconText, { color: '#F5ECD7' }]}></Text>}
                </View>
                <Text style={styles.socialBtnText}>Apple</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.termsNote}>
            Free to start · Safe and Encrypted
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5ECD7' },
  scroll: {
    paddingBottom: 56,
    paddingTop: 20,
  },

  // ── Decorative ──
  blob: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.13,
  },
  blobTL: {
    width: 320,
    height: 320,
    top: -100,
    left: -100,
    backgroundColor: '#C9705A',
  },
  blobBR: {
    width: 260,
    height: 260,
    bottom: -80,
    right: -80,
    backgroundColor: '#B5947A',
  },
  blobMid: {
    width: 180,
    height: 180,
    top: height * 0.38,
    left: -60,
    backgroundColor: '#D9BC8A',
    opacity: 0.1,
  },
  heartParticle: {
    position: 'absolute',
    color: '#C9705A',
  },

  // ── Hero ──
  heroSection: {
    alignItems: 'center',
    paddingTop: height * 0.09,
    paddingHorizontal: 32,
    gap: 20,
    marginBottom: 8,
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  pulseRing: {
    position: 'absolute',
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 2,
    borderColor: '#C9705A',
    opacity: 0.25,
  },
  logoOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: 'hidden',
    shadowColor: '#9B3D2C',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 14,
  },
  logoGrad: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoInner: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(253,250,244,0.88)',
  },
  brandName: {
    fontSize: 46,
    fontWeight: '900',
    color: '#3D2B1F',
    letterSpacing: 8,
    textAlign: 'center',
    marginTop: 4,
  },
  tagline: {
    fontSize: 24,
    fontWeight: '700',
    color: '#3D2B1F',
    textAlign: 'center',
    lineHeight: 34,
    letterSpacing: 0.2,
  },
  taglineSub: {
    fontSize: 15,
    color: '#8C6246',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 4,
    paddingHorizontal: 8,
  },

  // ── Features ──
  featuresRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginTop: 28,
    marginBottom: 22,
  },
  featureCard: {
    flex: 1,
    backgroundColor: 'rgba(253,250,244,0.85)',
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#D9BC8A',
    shadowColor: '#3D2B1F',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  featureIcon: { fontSize: 26, marginBottom: 2 },
  featureTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3D2B1F',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  featureDesc: {
    fontSize: 11,
    color: '#8C6246',
    textAlign: 'center',
    lineHeight: 16,
  },

  // ── Quote ──
  quoteCard: {
    marginHorizontal: 24,
    backgroundColor: '#3D2B1F',
    borderRadius: 20,
    padding: 24,
    gap: 10,
    marginBottom: 32,
    shadowColor: '#1A0F09',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },
  quoteText: {
    fontSize: 16,
    color: '#F5ECD7',
    fontStyle: 'italic',
    lineHeight: 24,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  quoteAuthor: {
    fontSize: 12,
    color: '#B5947A',
    textAlign: 'center',
    fontWeight: '600',
  },

  // ── CTA ──
  ctaSection: {
    paddingHorizontal: 24,
    gap: 14,
    alignItems: 'center',
  },
  primaryCta: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#9B3D2C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
  },
  primaryCtaGrad: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCtaText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FDFAF4',
    letterSpacing: 0.5,
  },
  secondaryCta: { paddingVertical: 4 },
  secondaryCtaText: {
    fontSize: 15,
    color: '#8C6246',
  },
  secondaryCtaLink: {
    color: '#C9705A',
    fontWeight: '700',
  },
  termsNote: {
    fontSize: 12,
    color: '#B5947A',
    textAlign: 'center',
    marginTop: 2,
  },
  // Social Sections
  socialDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 12,
    width: '100%',
    paddingHorizontal: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#EDD9B8',
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B5947A',
    letterSpacing: 1.5,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDFAF4',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#D9BC8A',
    gap: 10,
    shadowColor: '#3D2B1F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  socialIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F5ECD7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialIconText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#3D2B1F',
  },
  socialBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3D2B1F',
  },
});
