import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useStore, GroupMember } from '../store/useStore';
import { supabase } from '../lib/supabase';

export default function GroupSettingsScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const { session, activeGroupId, groups, groupMembers, updateGroup, removeGroup, setGroupMembers, setActiveGroupId } = useStore();

  const group = groups.find(g => g.id === activeGroupId);
  const members = groupMembers[activeGroupId || ''] || [];
  const myMember = members.find(m => m.user_id === session?.user?.id);
  const isHost = myMember?.role === 'host';
  const isHostOrMod = isHost || myMember?.role === 'moderator';

  const [name, setName] = useState(group?.name || '');
  const [emoji, setEmoji] = useState(group?.cover_emoji || '👥');
  const [saving, setSaving] = useState(false);

  const handleUpdate = async () => {
    if (!group || !name.trim()) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('groups')
        .update({ name, cover_emoji: emoji })
        .eq('id', group.id)
        .select()
        .single();
      
      if (error) throw error;
      updateGroup(data);
      Alert.alert('Success', 'Group updated.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const promoteMember = async (member: GroupMember) => {
    if (!isHostOrMod || member.user_id === session?.user?.id) return;
    const newRole = member.role === 'member' ? 'moderator' : 'member';
    
    try {
      await supabase
        .from('group_members')
        .update({ role: newRole })
        .eq('id', member.id);
      
      const newMembers = members.map(m => m.id === member.id ? { ...m, role: newRole } : m);
      setGroupMembers(group!.id, newMembers);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const removeMember = async (member: GroupMember) => {
    if (!isHostOrMod) return;
    Alert.alert('Remove Member', `Are you sure you want to remove ${member.profile?.display_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        await supabase.from('group_members').delete().eq('id', member.id);
        const newMembers = members.filter(m => m.id !== member.id);
        setGroupMembers(group!.id, newMembers);
      }}
    ]);
  };

  const leaveGroup = async () => {
    if (isHost) {
      Alert.alert('Cannot Leave', 'Hosts must transfer ownership or delete the group.');
      return;
    }
    Alert.alert('Leave Group', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: async () => {
          await supabase.from('group_members').delete().eq('group_id', group!.id).eq('user_id', session!.user.id);
          removeGroup(group!.id);
          setActiveGroupId(null);
          nav.navigate('Home');
      }}
    ]);
  };

  const deleteGroup = async () => {
    if (!isHost) return;
    Alert.alert('Delete Group', 'This will delete all messages and vibes for everyone. Permanent.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete Everything', style: 'destructive', onPress: async () => {
          await supabase.from('groups').delete().eq('id', group!.id);
          removeGroup(group!.id);
          setActiveGroupId(null);
          nav.navigate('Home');
      }}
    ]);
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#FDFAF4', '#F5ECD7', '#EDD9B8']} style={StyleSheet.absoluteFill} />
      
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: 60 }}>
        <View style={styles.header}>
           <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn}>
              <Ionicons name="close" size={24} color="#3D2B1F" />
           </TouchableOpacity>
           <Text style={styles.headerTitle}>Group Settings</Text>
        </View>

        {isHostOrMod && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Group Identity</Text>
            <View style={styles.card}>
               <TextInput 
                  style={styles.input} 
                  value={name} 
                  onChangeText={setName} 
                  placeholder="Group Name" 
               />
               <TextInput 
                  style={[styles.input, { marginTop: 12, fontSize: 32 }]} 
                  value={emoji} 
                  onChangeText={setEmoji} 
                  placeholder="👥" 
               />
               <TouchableOpacity style={styles.saveBtn} onPress={handleUpdate} disabled={saving}>
                  <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Update Settings'}</Text>
               </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.section}>
           <Text style={styles.sectionLabel}>Members ({members.length})</Text>
           <View style={styles.card}>
              {members.map(m => (
                <View key={m.id} style={styles.memberRow}>
                   <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{m.profile?.display_name || m.profile?.username || 'Member'}</Text>
                      <View style={[styles.roleBadge, { backgroundColor: m.role === 'host' ? '#C9705A' : '#B5947A' }]}>
                         <Text style={styles.roleText}>{m.role.toUpperCase()}</Text>
                      </View>
                   </View>
                   {isHostOrMod && m.user_id !== session?.user?.id && (
                     <View style={styles.actions}>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => promoteMember(m)}>
                           <Ionicons name={m.role === 'moderator' ? 'arrow-down-circle' : 'arrow-up-circle'} size={20} color="#8C6246" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => removeMember(m)}>
                           <Ionicons name="trash-outline" size={20} color="#A0412D" />
                        </TouchableOpacity>
                     </View>
                   )}
                </View>
              ))}
           </View>
        </View>

        <View style={styles.section}>
           <TouchableOpacity style={styles.leaveBtn} onPress={leaveGroup}>
              <Text style={styles.leaveBtnText}>Leave Group</Text>
           </TouchableOpacity>
           {isHost && (
             <TouchableOpacity style={[styles.leaveBtn, { marginTop: 12, borderColor: '#A0412D' }]} onPress={deleteGroup}>
                <Text style={[styles.leaveBtnText, { color: '#A0412D' }]}>Delete Group Permanently</Text>
             </TouchableOpacity>
           )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginBottom: 24 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.05)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#3D2B1F', marginLeft: 16 },
  
  section: { paddingHorizontal: 24, marginBottom: 32 },
  sectionLabel: { fontSize: 10, fontWeight: '800', color: '#8C6246', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  card: { backgroundColor: '#FDFAF4', borderRadius: 24, padding: 20, borderWidth: 1.5, borderColor: '#D9BC8A' },
  
  input: { fontSize: 16, backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 16, padding: 16, color: '#3D2B1F', fontWeight: '600' },
  saveBtn: { marginTop: 16, backgroundColor: '#3D2B1F', borderRadius: 18, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },

  memberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  memberInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberName: { fontSize: 15, fontWeight: '700', color: '#3D2B1F' },
  roleBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  roleText: { color: '#FFF', fontSize: 8, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.03)', justifyContent: 'center', alignItems: 'center' },

  leaveBtn: { borderRadius: 18, borderWidth: 1.5, borderColor: '#B5947A', paddingVertical: 16, alignItems: 'center' },
  leaveBtnText: { fontSize: 14, fontWeight: '800', color: '#B5947A' },
});
