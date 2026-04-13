import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCallStore } from '../../store/useCallStore';

/**
 * Web-safe fallback for IncomingCallOverlay.
 * Native version is in IncomingCallOverlay.native.tsx
 */
export const IncomingCallOverlay = () => {
  const { status, caller, resetCall } = useCallStore();

  if (status !== 'ringing') return null;

  return (
    <Modal transparent animationType="fade">
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.callingText}>The Sanctuary Awaits</Text>
          <Text style={styles.profileName}>{caller?.display_name || 'Your Partner'}</Text>
          <Text style={styles.webNotice}>(Available on Mobile Hardware)</Text>
          
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btn, styles.decline]} onPress={resetCall}>
               <Ionicons name="close" size={28} color="#F5ECD7" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2D1F1A', justifyContent: 'center', alignItems: 'center' },
  content: { alignItems: 'center', gap: 20 },
  callingText: { fontSize: 14, color: '#B5947A', fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase' },
  profileName: { fontSize: 32, color: '#F5ECD7', fontWeight: '800', fontFamily: 'CormorantGaramond_700Bold' },
  webNotice: { color: '#8A705E', fontSize: 14, fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: 40, marginTop: 40 },
  btn: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center' },
  decline: { backgroundColor: '#A0412D' },
});
