import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  TextInput, 
  KeyboardAvoidingView, 
  Platform,
  Alert
} from 'react-native';
import dayjs from '../../lib/utils/timezone';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../../store/useStore';
import { supabase } from '../../lib/supabase';
import * as Haptics from 'expo-haptics';

interface CreateEventModalProps {
  initialTime?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const CATEGORIES = ['Event', 'Bonding', 'Work', 'Sleep', 'Commute', 'Flight'];

export default function CreateEventModal({ initialTime, onClose, onSuccess }: CreateEventModalProps) {
  const { profile, activeBondId } = useStore();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Event');
  const [startTime, setStartTime] = useState(initialTime ? dayjs(initialTime) : dayjs().startOf('hour'));
  const [endTime, setEndTime] = useState((initialTime ? dayjs(initialTime) : dayjs()).add(1, 'hour').startOf('hour'));
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Title Required', 'Please give your ritual a name.');
      return;
    }
    if (!activeBondId || !profile) return;

    setIsSaving(true);
    try {
      const { error } = await supabase.from('shared_calendar').insert({
        bond_id: activeBondId,
        creator_id: profile.id,
        title: title.trim(),
        category,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString()
      });

      if (error) throw error;

      // New: Insert a transient system message for the partner
      await supabase.from('messages').insert({
        bond_id: activeBondId,
        sender_id: profile.id,
        is_system: true,
        content: `[SYNC-LINK] @${profile.username || 'Partner'} created a new ${category} ritual: "${title.trim()}" ✨`,
        expires_at: endTime.toISOString()
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess();
      onClose();
    } catch (e: any) {
      Alert.alert('Save Error', e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.modalBody}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>New Shared Ritual</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close" size={20} color="#3D2B1F" />
        </TouchableOpacity>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>WHATS THE PLAN?</Text>
          <TextInput
            style={styles.textInput}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Midnight Movie Night"
            placeholderTextColor="rgba(0,0,0,0.2)"
            autoFocus
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>CATEGORY</Text>
          <View style={styles.catGrid}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity 
                key={cat} 
                style={[styles.catBtn, category === cat && styles.catBtnActive]}
                onPress={() => {
                  setCategory(cat);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text style={[styles.catBtnText, category === cat && styles.catBtnTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.timeRow}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>START</Text>
            <View style={styles.timeDisplay}>
              <Text style={styles.timeDisplayText}>{startTime.format('HH:mm')}</Text>
            </View>
          </View>
          <Ionicons name="arrow-forward" size={16} color="#8C6246" style={{ marginTop: 20 }} />
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>END</Text>
            <View style={styles.timeDisplay}>
              <Text style={styles.timeDisplayText}>{endTime.format('HH:mm')}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.saveBtn, isSaving && { opacity: 0.7 }]} 
          onPress={handleSave}
          disabled={isSaving}
        >
          <Text style={styles.saveBtnText}>{isSaving ? 'SYNCING...' : 'LOCK INTO TIMELINE'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalBody: {
    backgroundColor: '#FDFAF4',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    minHeight: 450,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#3D2B1F',
    fontFamily: 'CormorantGaramond_700Bold',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  form: { gap: 20 },
  inputGroup: { gap: 8 },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8C6246',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  textInput: {
    fontSize: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    paddingVertical: 12,
    color: '#3D2B1F',
    fontWeight: '600',
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  catBtnActive: {
    backgroundColor: 'rgba(201, 112, 90, 0.1)',
    borderColor: '#C9705A',
  },
  catBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8C6246',
  },
  catBtnTextActive: {
    color: '#C9705A',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  timeDisplay: {
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 12,
    alignItems: 'center',
  },
  timeDisplayText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#3D2B1F',
    letterSpacing: 1,
  },
  saveBtn: {
    marginTop: 10,
    backgroundColor: '#C9705A',
    paddingVertical: 18,
    borderRadius: 24,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  }
});
