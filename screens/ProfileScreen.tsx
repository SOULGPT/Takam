import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { useNavigation } from '@react-navigation/native';
import { AVATARS, MALE_AVATAR_KEYS, FEMALE_AVATAR_KEYS } from '../utils/avatars';
import { shadow } from '../lib/theme/shadows';

export default function ProfileScreen() {
  const { profile, bonds, bondMembers, activeBondId, setProfile, reset } = useStore();
  const bond = bonds.find((b) => b.id === activeBondId);
  const partnerProfile = activeBondId ? bondMembers[activeBondId] : null;
  const nav = useNavigation<any>();
  
  const [loading, setLoading] = useState(false);
  
  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    username: profile?.username || '',
    bio: profile?.bio || '',
    sex: profile?.sex || '',
    avatar_url: profile?.avatar_url || '',
    country: profile?.country || '',
  });

  const handleSaveProfile = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          username: form.username.trim() || null,
          bio: form.bio.trim() || null,
          sex: form.sex || null,
          avatar_url: form.avatar_url || null,
          country: form.country.trim() || null,
        })
        .eq('id', profile.id)
        .select()
        .single();
        
      if (error) throw error;
      if (data) {
        setProfile(data as any);
        setIsEditing(false);
        Alert.alert('Saved ✦', 'Your profile has been updated.');
      }
    } catch (e: any) {
      if (e.message.includes('unique')) {
        Alert.alert('Error', 'Username is already taken.');
      } else {
        Alert.alert('Error', e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      reset();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Dissolve Bond ✦',
      'This action is irreversible. All messages, gifts, and memories will be permanently dissolved. Are you absolutely certain?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Permanently Dissolve', 
          style: 'destructive',
          onPress: async () => {
             setLoading(true);
             try {
                // Total Wipe Ritual
                const { error: profileError } = await supabase.from('profiles').delete().eq('id', profile?.id);
                if (profileError) throw profileError;
                
                await supabase.auth.signOut();
                reset();
                Alert.alert('Dissolved ✦', 'Your presence has been successfully untethered from TAKAM.');
             } catch (e: any) {
                Alert.alert('Error', e.message);
             } finally {
                setLoading(false);
             }
          }
        }
      ]
    );
  };

  const tierLabel = profile?.subscription_tier === 'ritual' ? '✦ Ritual' : 'Free';
  const tierColor = profile?.subscription_tier === 'ritual' ? '#C9705A' : '#8C6246';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient colors={['#FDFAF4', '#F5ECD7']} style={StyleSheet.absoluteFill} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, profile?.avatar_url && { backgroundColor: 'transparent' }]}>
            {profile?.avatar_url && AVATARS[profile.avatar_url] ? (
              <Image source={AVATARS[profile.avatar_url]} style={{ width: '100%', height: '100%', borderRadius: 999 }} />
            ) : (
              <Text style={styles.avatarInitial}>
                {profile?.display_name?.[0]?.toUpperCase() ?? 'U'}
              </Text>
            )}
          </View>
          <Text style={styles.displayName}>{profile?.display_name ?? 'You'}</Text>
          <View style={[styles.tierBadge, { borderColor: tierColor }]}>
            <Text style={[styles.tierText, { color: tierColor }]}>{tierLabel}</Text>
          </View>
        </View>

        {/* Bond info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your Bond</Text>
          <Row label="Bond Code" value={bond?.bond_code ?? '—'} mono />
          <Row label="Status" value={bond?.status === 'active' ? '🟢 Active' : '⏳ Pending'} />
          <Row
            label="Partner"
            value={partnerProfile?.display_name ?? 'Waiting for partner…'}
          />
          <Row
            label="Bonded Since"
            value={
              bond?.created_at
                ? new Date(bond.created_at).toLocaleDateString()
                : '—'
            }
          />
        </View>

        {/* Profile Info & Editing */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Your Details</Text>
            {isEditing ? (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={() => setIsEditing(false)}>
                  <Text style={{ color: '#8C6246', fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveProfile} disabled={loading}>
                  {loading ? <ActivityIndicator size="small" color="#C9705A"/> : <Text style={{ color: '#C9705A', fontWeight: '700' }}>Save</Text>}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={() => {
                setForm({
                  username: profile?.username || '',
                  bio: profile?.bio || '',
                  sex: profile?.sex || '',
                  avatar_url: profile?.avatar_url || '',
                  country: profile?.country || '',
                });
                setIsEditing(true);
              }}>
                <Text style={{ color: '#C9705A', fontWeight: '600' }}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          {isEditing ? (
            <View style={{ gap: 12, marginTop: 8 }}>
              <View>
                <Text style={styles.inputLabel}>Username</Text>
                <TextInput
                  style={styles.input}
                  value={form.username}
                  onChangeText={(t) => setForm({ ...form, username: t })}
                  placeholder="Username"
                  autoCapitalize="none"
                />
              </View>
              <View>
                <Text style={styles.inputLabel}>Bio</Text>
                <TextInput
                  style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                  value={form.bio}
                  onChangeText={(t) => setForm({ ...form, bio: t })}
                  placeholder="Short bio..."
                  multiline
                />
              </View>
              <View>
                <Text style={styles.inputLabel}>Sex</Text>
                <View style={styles.segmentsRow}>
                  {['male', 'female', 'prefer_not_to_say'].map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.segmentBtn, form.sex === opt && styles.segmentBtnActive]}
                      onPress={() => setForm({ ...form, sex: opt })}
                    >
                      <Text style={[styles.segmentTxt, form.sex === opt && styles.segmentTxtActive]}>
                        {opt === 'prefer_not_to_say' ? 'Other' : opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              {/* Avatar Picker */}
              {form.sex !== '' && (
                <View>
                  <Text style={styles.inputLabel}>Choose Avatar</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 4 }}>
                    {(form.sex === 'male' ? MALE_AVATAR_KEYS : form.sex === 'female' ? FEMALE_AVATAR_KEYS : [...FEMALE_AVATAR_KEYS, ...MALE_AVATAR_KEYS]).map((key) => (
                      <TouchableOpacity 
                        key={key} 
                        activeOpacity={0.8}
                        onPress={() => setForm({ ...form, avatar_url: key })}
                        style={[
                          { padding: 4, borderRadius: 50 }, 
                          form.avatar_url === key && { borderWidth: 2, borderColor: '#C9705A', backgroundColor: 'rgba(201, 112, 90, 0.1)' }
                        ]}
                      >
                        <Image source={AVATARS[key]} style={{ width: 64, height: 64, borderRadius: 32 }} />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <View>
                <Text style={styles.inputLabel}>Country</Text>
                <TextInput
                  style={styles.input}
                  value={form.country}
                  onChangeText={(t) => setForm({ ...form, country: t })}
                  placeholder="Country"
                />
              </View>
            </View>
          ) : (
            <>
              <Row label="Username" value={profile?.username ? `@${profile.username}` : '—'} />
              <Row label="Bio" value={profile?.bio || '—'} />
              <Row label="Sex" value={profile?.sex ? (profile.sex === 'prefer_not_to_say' ? 'Other' : profile.sex.charAt(0).toUpperCase() + profile.sex.slice(1)) : '—'} />
              <Row label="Country" value={profile?.country || '—'} />
            </>
          )}
        </View>

        {/* Upgrade card */}
        {profile?.subscription_tier !== 'ritual' && (
          <View style={styles.upgradeCard}>
            <Text style={styles.upgradeTitle}>Unlock Ritual ✦</Text>
            <Text style={styles.upgradeDesc}>
              Priority gift curation, MFA security, and exclusive vibe types.
            </Text>
            <TouchableOpacity style={styles.upgradeButton} onPress={() => nav.navigate('Upgrade')}>
              <Text style={styles.upgradeButtonText}>Explore Ritual Plans</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Sign out */}
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#9B3D2C" />
          ) : (
            <Text style={styles.signOutText}>Sign Out</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDeleteAccount}
          disabled={loading}
        >
          <Text style={styles.deleteText}>Dissolve Bond (Delete Account)</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={rowStyles.container}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={[rowStyles.value, mono && rowStyles.mono]}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EDD9B8',
  },
  label: { fontSize: 13, color: '#8C6246', fontWeight: '500' },
  value: { fontSize: 14, color: '#3D2B1F', fontWeight: '600' },
  mono: { letterSpacing: 3, fontSize: 16, fontWeight: '800' },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 24, paddingTop: 60, gap: 24, paddingBottom: 48 },
  avatarSection: { alignItems: 'center', gap: 10 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#C9705A',
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow('#9B3D2C', { width: 0, height: 6 }, 0.25, 14, 8),
  },
  avatarInitial: { fontSize: 34, fontWeight: '800', color: '#F5ECD7' },
  displayName: { fontSize: 22, fontWeight: '700', color: '#3D2B1F' },
  tierBadge: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  tierText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  card: {
    backgroundColor: '#FDFAF4',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#D9BC8A',
    ...shadow('#3D2B1F', { width: 0, height: 3 }, 0.07, 10, 4),
    gap: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#3D2B1F', marginBottom: 6 },
  upgradeCard: {
    backgroundColor: '#3D2B1F',
    borderRadius: 20,
    padding: 24,
    gap: 10,
  },
  upgradeTitle: { fontSize: 18, fontWeight: '800', color: '#F5ECD7' },
  upgradeDesc: { fontSize: 13, color: '#D9BC8A', lineHeight: 20 },
  upgradeButton: {
    backgroundColor: '#C9705A',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  upgradeButtonText: { fontSize: 15, fontWeight: '700', color: '#F5ECD7' },
  signOutButton: {
    backgroundColor: '#FDF0EC',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#C9705A40',
  },
  signOutText: { fontSize: 15, fontWeight: '700', color: '#9B3D2C' },
  deleteButton: {
    marginTop: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteText: {
    fontSize: 13,
    color: '#9B3D2C',
    opacity: 0.6,
    textDecorationLine: 'underline',
    fontFamily: 'CormorantGaramond_400Regular_Italic',
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  inputLabel: { fontSize: 12, color: '#8C6246', fontWeight: '600', marginBottom: 4, marginLeft: 2 },
  input: {
    backgroundColor: '#FDFAF4',
    borderWidth: 1,
    borderColor: '#D9BC8A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#3D2B1F',
    fontSize: 14,
  },
  segmentsRow: { flexDirection: 'row', gap: 6 },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D9BC8A',
    alignItems: 'center',
    backgroundColor: '#FDFAF4',
  },
  segmentBtnActive: { borderColor: '#C9705A', backgroundColor: '#C9705A' },
  segmentTxt: { fontSize: 12, color: '#5C3D2E', fontWeight: '600' },
  segmentTxtActive: { color: '#FFF' },
});
