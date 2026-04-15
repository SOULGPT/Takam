import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
  Platform,
  TextInput,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { DissolveModal } from '../components/DissolveModal';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useStore, Bond, BOND_META, BondType, Group } from '../store/useStore';
import { shadow } from '../lib/theme/shadows';

// ── All 10 relationship types ─────────────────────────────────────────────────
const ALL_BOND_TYPES: BondType[] = [
  'partner','spouse','bestfriend','friend','sibling',
  'parent','child','family','colleague','other',
];

function generateBondCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function BondCard({
  bond,
  myId,
  onSetActive,
  onRemove,
  isActive,
  onAccept,
  onReject,
}: {
  bond: Bond;
  myId: string;
  onSetActive: () => void;
  onRemove: () => void;
  isActive: boolean;
  onAccept?: () => void;
  onReject?: () => void;
}) {
  const { bondMembers } = useStore();
  const partner = bondMembers[bond.id];
  const meta = BOND_META[bond.bond_type] ?? BOND_META.other;
  const partnerName = partner?.display_name ?? partner?.username ?? '—';
  const isPending = bond.status === 'pending';
  const isRequested = bond.status === 'requested';
  const isCreator = bond.user_a === myId;
  const isActionable = isRequested || isPending;

  const renderRightActions = () => {
    return (
      <TouchableOpacity 
        style={styles.deleteAction} 
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onRemove();
        }}
      >
        <Ionicons name="trash-outline" size={24} color="#FFF" />
      </TouchableOpacity>
    );
  };

  const copyCode = () => {
    if (Platform.OS === 'web') {
      navigator.clipboard?.writeText(bond.bond_code)
        .then(() => Alert.alert('Copied!', 'Bond code copied.'))
        .catch(() => Alert.alert('Your code', bond.bond_code));
    } else {
      Alert.alert('Bond Code', bond.bond_code);
    }
  };

  let titleText = partnerName;
  if (isPending) {
    titleText = isCreator ? 'Waiting for someone to join…' : 'Connecting…';
  } else if (isRequested) {
    titleText = isCreator ? `${partnerName} wants to connect!` : 'Waiting for their approval…';
  }

  return (
    <Swipeable renderRightActions={renderRightActions}>
      <TouchableOpacity
        style={[styles.bondCard, isActive && styles.bondCardActive]}
        onPress={isActionable ? undefined : onSetActive}
        activeOpacity={isActionable ? 1 : 0.85}
      >
        {isActive && <View style={[styles.activeStripe, { backgroundColor: meta.color }]} />}

        <View style={styles.cardRow}>
          <View style={[styles.avatar, { backgroundColor: meta.color }]}>
            <Text style={styles.avatarText}>
              {isPending ? '?' : initials(partnerName || '?')}
            </Text>
          </View>

          <View style={styles.cardInfo}>
            <View style={styles.cardNameRow}>
              <Text style={styles.cardName} numberOfLines={1}>
                {titleText}
              </Text>
              {isActive && !isActionable && (
                <View style={[styles.activeBadge, { backgroundColor: meta.color + '22', borderColor: meta.color }]}>
                  <Text style={[styles.activeBadgeText, { color: meta.color }]}>Active</Text>
                </View>
              )}
            </View>

            <View style={styles.typeBadgeRow}>
              <Text style={styles.typeEmoji}>{meta.emoji}</Text>
              <Text style={styles.typeLabel}>{meta.label}</Text>
              {isPending && (
                <View style={styles.pendingPill}>
                  <Text style={styles.pendingPillText}>Pending</Text>
                </View>
              )}
            </View>

            {isPending && isCreator && (
              <TouchableOpacity style={styles.codeRow} onPress={copyCode} activeOpacity={0.75}>
                <Text style={styles.codeText}>{bond.bond_code}</Text>
                <Text style={styles.copyLabel}>📋 Copy</Text>
              </TouchableOpacity>
            )}

            {isRequested && isCreator && onAccept && onReject && (
              <View style={styles.actionButtonsRow}>
                <TouchableOpacity style={styles.btnAccept} onPress={onAccept}>
                  <Text style={styles.btnAcceptText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnReject} onPress={onReject}>
                  <Text style={styles.btnRejectText}>Reject</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.menuBtn}
            onPress={() => {
              const options: any[] = [];
              if (!isActionable) {
                options.push({ text: '✦ Set as Active', onPress: onSetActive });
              }
              options.push({
                text: 'Remove Connection',
                style: 'destructive',
                onPress: onRemove,
              });
              options.push({
                text: 'Block User',
                style: 'destructive',
                onPress: () => {
                   Alert.alert('Block User', `This will block ${partnerName} and dissolve the bond.`);
                   onRemove();
                },
              });
              options.push({ text: 'Cancel', style: 'cancel' });
              
              Alert.alert(
                isActionable ? 'Pending Bond' : partnerName,
                isActionable ? 'What would you like to do?' : `Manage your ${meta.label} bond`,
                options,
              );
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.menuDots}>•••</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyEmoji}>💞</Text>
      <Text style={styles.emptyTitle}>No connections yet</Text>
      <Text style={styles.emptySub}>
        Add a partner, friend, sibling, or anyone special{'\n'}and start sharing vibes with them.
      </Text>
      <TouchableOpacity style={styles.emptyBtn} onPress={onAdd} activeOpacity={0.85}>
        <LinearGradient
          colors={['#D97B60', '#C9705A', '#A8503E']}
          style={styles.emptyBtnGrad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Text style={styles.emptyBtnText}>Add Your First Connection</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

function TypePicker({
  selected,
  onSelect,
}: {
  selected: BondType;
  onSelect: (t: BondType) => void;
}) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
      <View style={styles.typeGrid}>
        {ALL_BOND_TYPES.map((t) => {
          const m = BOND_META[t];
          const active = selected === t;
          return (
            <TouchableOpacity
              key={t}
              style={[
                styles.typeChip,
                active && { borderColor: m.color, backgroundColor: m.color + '18' },
              ]}
              onPress={() => onSelect(t)}
              activeOpacity={0.8}
            >
              <Text style={styles.typeChipEmoji}>{m.emoji}</Text>
              <Text style={[styles.typeChipLabel, active && { color: m.color, fontWeight: '700' }]}>
                {m.label}
              </Text>
              {active && <View style={[styles.typeChipDot, { backgroundColor: m.color }]} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

type Mode = 'list' | 'typeSelect' | 'create' | 'join' | 'waiting' | 'createGroup' | 'joinGroup';

export default function ConnectionsScreen() {
  const nav = useNavigation<any>();
  const {
    session,
    bonds,
    bondMembers,
    activeBondId,
    setActiveBondId,
    addBond,
    updateBond,
    removeBond,
    addGroup,
  } = useStore();

  const [mode, setMode] = useState<Mode>('list');
  const [selectedType, setSelectedType] = useState<BondType>('partner');
  const [joinCode, setJoinCode] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupEmoji, setGroupEmoji] = useState('👥');
  const [pendingBond, setPendingBond] = useState<Bond | null>(null);
  const [pendingGroup, setPendingGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(false);

  const [pendingDissolveBond, setPendingDissolveBond] = useState<Bond | null>(null);

  const handleCreate = async () => {
    if (!session?.user) return;
    setLoading(true);
    try {
      const bondCode = generateBondCode();
      const { data, error } = await supabase
        .from('bonds')
        .insert({
          user_a: session.user.id,
          bond_code: bondCode,
          bond_type: selectedType,
          status: 'pending',
        })
        .select()
        .maybeSingle();
      if (error) throw error;
      if (data) {
        addBond(data as Bond);
        setPendingBond(data as Bond);
        setMode('waiting');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!session?.user || joinCode.length !== 6) return;
    setLoading(true);
    try {
      const { data: found, error: findErr } = await supabase
        .from('bonds')
        .select()
        .eq('bond_code', joinCode.toUpperCase())
        .eq('status', 'pending')
        .maybeSingle();

      if (findErr) throw new Error(findErr.message);
      if (!found) throw new Error('Bond code not found or already used.');
      if (found.user_a === session.user.id) throw new Error("That's your own code!");

      const { data: updated, error: joinErr } = await supabase
        .from('bonds')
        .update({ user_b: session.user.id, status: 'requested' })
        .eq('id', found.id)
        .select()
        .maybeSingle();

      if (joinErr) throw new Error(joinErr.message);
      if (!updated) throw new Error('Could not join bond. Please try again.');

      addBond(updated as Bond);
      const { data: partnerProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', found.user_a)
        .single();
      if (partnerProfile) {
        useStore.getState().setBondMember(updated.id, partnerProfile);
      }

      setJoinCode('');
      setMode('list');
      Alert.alert('Request Sent! ⏳', `We notified them to approve your ${BOND_META[updated.bond_type as BondType]?.label} bond request.`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!session?.user || !groupName.trim()) return;
    setLoading(true);
    try {
      // 1. Helper to generate code locally (Mirroring DB fallback)
      const code = generateBondCode();
      
      // 2. Create the Group
      const { data: group, error: gErr } = await supabase
        .from('groups')
        .insert({
          name: groupName,
          created_by: session.user.id,
          group_code: code,
          cover_emoji: groupEmoji,
        })
        .select()
        .single();
      
      if (gErr) throw gErr;

      // 3. Add current user as Host
      await supabase.from('group_members').insert({
        group_id: group.id,
        user_id: session.user.id,
        role: 'host',
      });

      addGroup(group as Group);
      setPendingGroup(group as Group);
      setMode('waiting');
    } catch (e: any) {
      Alert.alert('Group Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGroup = async () => {
    if (!session?.user || joinCode.length !== 6) return;
    setLoading(true);
    try {
      // 1. Find group by code
      const { data: group, error: fErr } = await supabase
        .from('groups')
        .select()
        .eq('group_code', joinCode.toUpperCase())
        .maybeSingle();
      
      if (fErr) throw fErr;
      if (!group) throw new Error('Invalid group code. Please check and try again.');

      // 2. Join as member
      const { error: jErr } = await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          user_id: session.user.id,
          role: 'member',
        });
      
      if (jErr) throw new Error('You are already a member or could not join.');

      addGroup(group as Group);
      setJoinCode('');
      setMode('list');
      Alert.alert('Welcome! 🏘️', `You've joined the group: ${group.name}`);
    } catch (e: any) {
      Alert.alert('Join Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (bond: Bond) => {
    try {
      const { data, error } = await supabase
        .from('bonds')
        .update({ status: 'active' })
        .eq('id', bond.id)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (data) {
        updateBond(data as Bond);
        if (!activeBondId) setActiveBondId(data.id);
        Alert.alert('Accepted! 💞', 'The bond is now active.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleReject = async (bond: Bond) => {
    try {
      const { error } = await supabase.from('bonds').delete().eq('id', bond.id);
      if (error) throw error;
      removeBond(bond.id);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleRemove = (bond: Bond) => {
    setPendingDissolveBond(bond);
  };

  const confirmDissolve = async () => {
    if (!pendingDissolveBond) return;
    try {
      await supabase.from('bonds').delete().eq('id', pendingDissolveBond.id);
      removeBond(pendingDissolveBond.id);
      setPendingDissolveBond(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleSetActive = (bondId: string) => {
    setActiveBondId(bondId);
    nav.navigate?.('Home');
  };

  const copyCode = (code: string) => {
    if (Platform.OS === 'web') {
      navigator.clipboard?.writeText(code)
        .then(() => Alert.alert('Copied!', 'Bond code copied.'))
        .catch(() => Alert.alert('Your Code', code));
    } else {
      Alert.alert('Bond Code', code);
    }
  };

  const myId = session?.user?.id ?? '';
  const activeBonds = bonds.filter((b) => b.status === 'active');
  const pendingBonds = bonds.filter((b) => b.status === 'pending');

  if (mode === 'list') {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="dark-content" />
        <LinearGradient
          colors={['#FDFAF4', '#F5ECD7', '#EDD9B8']}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.blobDeco, styles.blobTR]} />

        <View style={styles.header}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Connections</Text>
            {bonds.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{bonds.length}</Text>
              </View>
            )}
          </View>
          <Text style={styles.headerSub}>
            {bonds.length === 0
              ? 'Add people you care about'
              : `${activeBonds.length} active · ${pendingBonds.length} pending`}
          </Text>
        </View>

        {bonds.length === 0 ? (
          <EmptyState onAdd={() => setMode('typeSelect')} />
        ) : (
          <FlatList
            data={bonds}
            keyExtractor={(b) => b.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <BondCard
                bond={item}
                myId={myId}
                isActive={item.id === activeBondId}
                onSetActive={() => handleSetActive(item.id)}
                onRemove={() => handleRemove(item)}
                onAccept={() => handleAccept(item)}
                onReject={() => handleReject(item)}
              />
            )}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          />
        )}

        {bonds.length > 0 && (
          <TouchableOpacity
            style={styles.fab}
            onPress={() => setMode('typeSelect')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#D97B60', '#C9705A']}
              style={styles.fabGrad}
            >
              <Text style={styles.fabText}>+ Add</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        <DissolveModal
          visible={!!pendingDissolveBond}
          onCancel={() => setPendingDissolveBond(null)}
          onConfirm={confirmDissolve}
          partnerName={
            pendingDissolveBond 
              ? (bondMembers[pendingDissolveBond.id]?.display_name || bondMembers[pendingDissolveBond.id]?.username || 'this user')
              : ''
          }
        />
      </View>
    );
  }

  if (mode === 'typeSelect') {
    const meta = BOND_META[selectedType];
    return (
      <View style={styles.root}>
        <StatusBar barStyle="dark-content" />
        <LinearGradient colors={['#FDFAF4', '#F5ECD7', '#EDD9B8']} style={StyleSheet.absoluteFill} />

        <ScrollView contentContainerStyle={styles.flowContent}>
          <TouchableOpacity onPress={() => setMode('list')} style={styles.backRow}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.flowTitle}>Choose relationship</Text>
          <Text style={styles.flowSub}>How are you connected to this person?</Text>

          <TypePicker selected={selectedType} onSelect={setSelectedType} />

          <View style={styles.actionChoice}>
            <TouchableOpacity
              style={styles.createBtn}
              onPress={() => setMode('create')}
            >
              <LinearGradient
                colors={[meta.color + 'CC', meta.color]}
                style={styles.createBtnGrad}
              >
                <Text style={styles.createBtnText}>{meta.emoji}  Generate Bond Code</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.joinBtn}
              onPress={() => setMode('join')}
            >
              <Text style={styles.joinBtnText}>🔗  I have a code to enter</Text>
            </TouchableOpacity>

            <View style={{ height: 1.5, backgroundColor: '#D9BC8A33', marginVertical: 8 }} />

            <TouchableOpacity
              style={[styles.createBtn, { backgroundColor: '#3D2B1F' }]}
              onPress={() => setMode('createGroup')}
            >
               <View style={[styles.createBtnGrad, { backgroundColor: '#3D2B1F' }]}>
                 <Text style={styles.createBtnText}>👥  Create Group Bond</Text>
               </View>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.joinBtn, { borderColor: '#3D2B1F' }]}
              onPress={() => setMode('joinGroup')}
            >
              <Text style={[styles.joinBtnText, { color: '#3D2B1F' }]}>🏘️  Join/Search Group</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (mode === 'create') {
    const meta = BOND_META[selectedType];
    return (
      <View style={styles.root}>
        <LinearGradient colors={['#FDFAF4', '#F5ECD7', '#EDD9B8']} style={StyleSheet.absoluteFill} />
        <View style={styles.flowContent}>
          <TouchableOpacity onPress={() => setMode('typeSelect')} style={styles.backRow}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.flowTitle}>{meta.emoji}  {meta.label} Bond</Text>
          <Text style={styles.flowSub}>
            Tap below to generate your unique bond code and share it.
          </Text>
          <View style={styles.createCard}>
            <TouchableOpacity
              style={styles.generateBtn}
              onPress={handleCreate}
              disabled={loading}
            >
              <LinearGradient
                colors={['#D97B60', '#C9705A', '#A8503E']}
                style={styles.generateBtnGrad}
              >
                {loading ? (
                  <ActivityIndicator color="#FDFAF4" />
                ) : (
                  <Text style={styles.generateBtnText}>Generate Code ✦</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (mode === 'waiting' && pendingBond) {
    const meta = BOND_META[pendingBond.bond_type] ?? BOND_META.other;
    return (
      <View style={styles.root}>
        <LinearGradient colors={['#FDFAF4', '#F5ECD7', '#EDD9B8']} style={StyleSheet.absoluteFill} />
        <View style={styles.flowContent}>
          <Text style={styles.flowTitle}>Share Your Code 🔗</Text>
          <Text style={styles.flowSub}>
            Send this to your {meta.label.toLowerCase()} — they enter it to connect with you.
          </Text>

          <View style={styles.waitCard}>
            <Text style={styles.waitType}>{meta.emoji}  {meta.label} Bond</Text>
            <Text style={styles.waitCodeLabel}>YOUR BOND CODE</Text>
            <Text style={styles.waitCode}>{pendingBond.bond_code}</Text>
            <TouchableOpacity
              style={styles.copyBtn}
              onPress={() => copyCode(pendingBond.bond_code)}
            >
              <Text style={styles.copyBtnText}>📋  Copy Code</Text>
            </TouchableOpacity>
            <Text style={styles.waitNote}>⏳ Waiting for them to join…</Text>
          </View>

          <TouchableOpacity onPress={() => { setPendingBond(null); setMode('list'); }}>
            <Text style={[styles.backText, { textAlign: 'center', marginTop: 8 }]}>
              Done — go back to connections
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (mode === 'waiting' && pendingGroup) {
    return (
      <View style={styles.root}>
        <LinearGradient colors={['#FDFAF4', '#F5ECD7', '#EDD9B8']} style={StyleSheet.absoluteFill} />
        <View style={styles.flowContent}>
          <Text style={styles.flowTitle}>Group is Ready! 🏘️</Text>
          <Text style={styles.flowSub}>
            Share this code with your group members. Anyone with this code can join.
          </Text>

          <View style={styles.waitCard}>
            <Text style={styles.waitType}>{pendingGroup.cover_emoji}  {pendingGroup.name}</Text>
            <Text style={styles.waitCodeLabel}>GROUP BOND CODE</Text>
            <Text style={styles.waitCode}>{pendingGroup.group_code}</Text>
            <TouchableOpacity
              style={styles.copyBtn}
              onPress={() => copyCode(pendingGroup.group_code)}
            >
              <Text style={styles.copyBtnText}>📋  Copy Group Code</Text>
            </TouchableOpacity>
            <Text style={styles.waitNote}>People can join instantly using this code.</Text>
          </View>

          <TouchableOpacity onPress={() => { setPendingGroup(null); setMode('list'); }}>
            <Text style={[styles.backText, { textAlign: 'center', marginTop: 8 }]}>
              Done — open connections
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (mode === 'createGroup') {
    return (
      <View style={styles.root}>
        <LinearGradient colors={['#FDFAF4', '#F5ECD7', '#EDD9B8']} style={StyleSheet.absoluteFill} />
        <View style={styles.flowContent}>
          <TouchableOpacity onPress={() => setMode('typeSelect')} style={styles.backRow}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.flowTitle}>Create a Group 🏘️</Text>
          <Text style={styles.flowSub}>Bring everyone together in a shared bond space.</Text>
          
          <View style={styles.joinCard}>
             <TextInput
              style={[styles.codeInput, { fontSize: 24, letterSpacing: 1 }]}
              value={groupName}
              onChangeText={setGroupName}
              placeholder="Group Name"
              placeholderTextColor="#B5947A"
            />
             <TextInput
              style={[styles.codeInput, { marginTop: 12, fontSize: 32 }]}
              value={groupEmoji}
              onChangeText={setGroupEmoji}
              placeholder="👥"
              maxLength={2}
            />
            <TouchableOpacity
              style={[styles.generateBtn, !groupName.trim() && styles.generateBtnDisabled]}
              onPress={handleCreateGroup}
              disabled={loading || !groupName.trim()}
            >
              <LinearGradient
                colors={['#3D2B1F', '#1A1A1A']}
                style={styles.generateBtnGrad}
              >
                {loading ? <ActivityIndicator color="#FDFAF4" /> : <Text style={styles.generateBtnText}>Create Group ✦</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (mode === 'joinGroup') {
    return (
      <View style={styles.root}>
        <LinearGradient colors={['#FDFAF4', '#F5ECD7', '#EDD9B8']} style={StyleSheet.absoluteFill} />
        <View style={styles.flowContent}>
          <TouchableOpacity onPress={() => setMode('typeSelect')} style={styles.backRow}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.flowTitle}>Join a Group 🔗</Text>
          <Text style={styles.flowSub}>Enter the 6-character Group Bond code.</Text>

          <View style={styles.joinCard}>
            <TextInput
              style={styles.codeInput}
              value={joinCode}
              onChangeText={(t) => setJoinCode(t.toUpperCase())}
              maxLength={6}
              autoCapitalize="characters"
              placeholder="GROUP1"
              placeholderTextColor="#B5947A"
            />
            <TouchableOpacity
              style={[styles.generateBtn, joinCode.length !== 6 && styles.generateBtnDisabled]}
              onPress={handleJoinGroup}
              disabled={loading || joinCode.length !== 6}
            >
              <LinearGradient
                colors={joinCode.length === 6 ? ['#3D2B1F', '#1A1A1A'] : ['#D9BC8A', '#C5A870']}
                style={styles.generateBtnGrad}
              >
                {loading ? <ActivityIndicator color="#FDFAF4" /> : <Text style={styles.generateBtnText}>Join Group 🏘️</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#FDFAF4', '#F5ECD7', '#EDD9B8']} style={StyleSheet.absoluteFill} />
      <View style={styles.flowContent}>
        <TouchableOpacity onPress={() => setMode('typeSelect')} style={styles.backRow}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.flowTitle}>Join a Bond 🔗</Text>
        <Text style={styles.flowSub}>Enter the 6-character code you received.</Text>

        <View style={styles.joinCard}>
          <TextInput
            style={styles.codeInput}
            value={joinCode}
            onChangeText={(t) => setJoinCode(t.toUpperCase())}
            maxLength={6}
            autoCapitalize="characters"
            placeholder="ABC123"
            placeholderTextColor="#B5947A"
          />
          <TouchableOpacity
            style={[styles.generateBtn, joinCode.length !== 6 && styles.generateBtnDisabled]}
            onPress={handleJoin}
            disabled={loading || joinCode.length !== 6}
          >
            <LinearGradient
              colors={joinCode.length === 6 ? ['#D97B60', '#C9705A', '#A8503E'] : ['#D9BC8A', '#C5A870']}
              style={styles.generateBtnGrad}
            >
              {loading ? (
                <ActivityIndicator color="#FDFAF4" />
              ) : (
                <Text style={styles.generateBtnText}>Connect ✦</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5ECD7' },
  blobDeco: { position: 'absolute', borderRadius: 999, opacity: 0.1, backgroundColor: '#C9705A' },
  blobTR: { width: 220, height: 220, top: -60, right: -60 },

  header: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 16, gap: 4 },
  headerTextWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 30, fontWeight: '800', color: '#3D2B1F', letterSpacing: 0.3 },
  headerSub: { fontSize: 14, color: '#8C6246' },
  countBadge: { backgroundColor: '#C9705A', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, minWidth: 24, alignItems: 'center' },
  countBadgeText: { fontSize: 13, fontWeight: '800', color: '#FDFAF4' },

  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  bondCard: {
    backgroundColor: '#FDFAF4',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#D9BC8A',
    overflow: 'hidden',
    ...shadow('#3D2B1F', { width: 0, height: 3 }, 0.07, 10, 4),
  },
  deleteAction: {
    backgroundColor: '#C0624A',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
    borderRadius: 20,
    marginLeft: 10,
  },
  bondCardActive: { borderColor: '#C9705A' },
  activeStripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  cardRow: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingLeft: 20, gap: 14 },
  avatar: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  avatarText: { fontSize: 18, fontWeight: '800', color: '#FDFAF4' },
  cardInfo: { flex: 1, gap: 4 },
  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardName: { fontSize: 16, fontWeight: '700', color: '#3D2B1F', flex: 1 },
  activeBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  activeBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  typeBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  typeEmoji: { fontSize: 13 },
  typeLabel: { fontSize: 12, color: '#8C6246', fontWeight: '500' },
  pendingPill: { backgroundColor: '#F0DC8A', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, marginLeft: 4 },
  pendingPillText: { fontSize: 10, fontWeight: '700', color: '#6B5800' },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, backgroundColor: '#F5ECD7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  codeText: { fontSize: 16, fontWeight: '900', color: '#3D2B1F', letterSpacing: 4 },
  copyLabel: { fontSize: 12, color: '#8C6246', fontWeight: '600' },
  menuBtn: { paddingLeft: 6 },
  menuDots: { fontSize: 16, color: '#B5947A', fontWeight: '700', letterSpacing: -1 },
  actionButtonsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btnAccept: { backgroundColor: '#C9705A', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  btnAcceptText: { color: '#FDFAF4', fontSize: 13, fontWeight: '700' },
  btnReject: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#D9BC8A', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  btnRejectText: { color: '#8C6246', fontSize: 13, fontWeight: '700' },

  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, gap: 14, marginTop: -40 },
  emptyEmoji: { fontSize: 64 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: '#3D2B1F', textAlign: 'center' },
  emptySub: { fontSize: 14, color: '#8C6246', textAlign: 'center', lineHeight: 21 },
  emptyBtn: { borderRadius: 18, overflow: 'hidden', marginTop: 8, ...shadow('#9B3D2C', { width: 0, height: 5 }, 0.28, 12, 8) },
  emptyBtnGrad: { paddingVertical: 16, paddingHorizontal: 28, alignItems: 'center' },
  emptyBtnText: { fontSize: 15, fontWeight: '800', color: '#FDFAF4' },

  fab: { position: 'absolute', bottom: 28, right: 20, borderRadius: 28, overflow: 'hidden', ...shadow('#9B3D2C', { width: 0, height: 6 }, 0.3, 12, 10) },
  fabGrad: { paddingVertical: 14, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center' },
  fabText: { fontSize: 16, fontWeight: '800', color: '#FDFAF4', letterSpacing: 0.2 },

  flowContent: { flex: 1, paddingHorizontal: 24, paddingTop: 64, gap: 18 },
  backRow: { marginBottom: 4 },
  backText: { fontSize: 15, color: '#8C6246', fontWeight: '600' },
  flowTitle: { fontSize: 28, fontWeight: '800', color: '#3D2B1F', letterSpacing: 0.2 },
  flowSub: { fontSize: 14, color: '#8C6246', lineHeight: 21, marginBottom: 4 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingVertical: 4 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#FDFAF4', borderRadius: 14, borderWidth: 1.5, borderColor: '#D9BC8A', paddingVertical: 11, paddingHorizontal: 14, width: '47%' },
  typeChipEmoji: { fontSize: 18 },
  typeChipLabel: { fontSize: 13, fontWeight: '500', color: '#5C3D2E', flex: 1 },
  typeChipDot: { width: 8, height: 8, borderRadius: 4 },
  actionChoice: { gap: 12, marginTop: 4 },
  createBtn: { borderRadius: 16, overflow: 'hidden', ...shadow('#9B3D2C', { width: 0, height: 4 }, 0.25, 10, 6) },
  createBtnGrad: { paddingVertical: 17, alignItems: 'center' },
  createBtnText: { fontSize: 16, fontWeight: '800', color: '#FDFAF4', letterSpacing: 0.3 },
  joinBtn: { borderRadius: 16, borderWidth: 1.5, borderColor: '#C9705A', paddingVertical: 17, alignItems: 'center', backgroundColor: 'transparent' },
  joinBtnText: { fontSize: 15, fontWeight: '600', color: '#C9705A' },

  createCard: { backgroundColor: '#FDFAF4', borderRadius: 22, padding: 24, borderWidth: 1.5, borderColor: '#D9BC8A' },
  generateBtn: { backgroundColor: '#C9705A', borderRadius: 14, ...shadow('#9B3D2C', { width: 0, height: 4 }, 0.25, 8, 4) },
  generateBtnDisabled: { ...shadow('#3D2B1F', { width: 0, height: 2 }, 0.08, 4, 1) },
  generateBtnGrad: { paddingVertical: 17, alignItems: 'center' },
  generateBtnText: { fontSize: 16, fontWeight: '800', color: '#FDFAF4', letterSpacing: 0.3 },

  waitCard: { backgroundColor: '#FDFAF4', borderRadius: 24, padding: 24, gap: 18, borderWidth: 1.5, borderColor: '#D9BC8A', ...shadow('#3D2B1F', { width: 0, height: 4 }, 0.08, 12, 6) },
  waitType: { fontSize: 14, fontWeight: '700', color: '#8C6246' },
  waitCodeLabel: { fontSize: 11, color: '#B5947A', letterSpacing: 2, fontWeight: '700' },
  waitCode: { fontSize: 42, fontWeight: '900', color: '#3D2B1F', letterSpacing: 10, textAlign: 'center' },
  copyBtn: { backgroundColor: '#F5ECD7', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, borderWidth: 1.5, borderColor: '#D9BC8A', alignItems: 'center' },
  copyBtnText: { fontSize: 14, fontWeight: '600', color: '#8C6246' },
  waitNote: { fontSize: 13, color: '#B5947A', fontStyle: 'italic', textAlign: 'center' },

  joinCard: { backgroundColor: '#FDFAF4', borderRadius: 24, padding: 24, gap: 18, borderWidth: 1.5, borderColor: '#D9BC8A' },
  codeInput: { backgroundColor: '#F5ECD7', borderRadius: 14, borderWidth: 1.5, borderColor: '#D9BC8A', paddingVertical: 16, paddingHorizontal: 20, fontSize: 28, fontWeight: '800', color: '#3D2B1F', textAlign: 'center', letterSpacing: 8 },
});
