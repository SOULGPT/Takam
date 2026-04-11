import { useEffect, useState, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import NfcManager, { NfcTech, Ndef, NfcEvents } from 'react-native-nfc-manager';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';

const HANDSHAKE_ROTATION_MS = 60000; // 60 seconds

export function useNfcHandshake() {
  const { profile } = useStore();
  const [isScanning, setIsScanning] = useState(false);
  const [handshakeId, setHandshakeId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 1. Generate and Rotate Handshake ID
  const rotateHandshake = useCallback(async () => {
    if (!profile?.id) return;

    const newId = Math.random().toString(36).substring(2, 10); // 8-char random hash
    const expiresAt = new Date(Date.now() + HANDSHAKE_ROTATION_MS).toISOString();

    try {
      const { error } = await supabase.from('proximity_handshakes').insert({
        user_id: profile.id,
        handshake_id: newId,
        expires_at: expiresAt,
      });

      if (error) {
        console.error('Failed to rotate handshake:', error);
        return;
      }
      setHandshakeId(newId);
    } catch (e) {
      console.error('Handshake rotation error:', e);
    }
  }, [profile?.id]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isScanning) {
      rotateHandshake();
      interval = setInterval(rotateHandshake, HANDSHAKE_ROTATION_MS);
    }
    return () => clearInterval(interval);
  }, [isScanning, rotateHandshake]);

  // 2. Cleanup handshake on unmount or stop
  useEffect(() => {
    return () => {
      if (handshakeId) {
        supabase.from('proximity_handshakes').delete().eq('handshake_id', handshakeId).then();
      }
    };
  }, [handshakeId]);

  // 3. NFC Handshake Logic
  const startHandshake = async () => {
    try {
      const isSupported = await NfcManager.isSupported();
      if (!isSupported) {
        Alert.alert('NFC Not Supported', 'Your device does not support NFC features.');
        return;
      }

      await NfcManager.start();
      setIsScanning(true);
      
      // Start Reading
      NfcManager.setEventListener(NfcEvents.DiscoverTag, async (tag: any) => {
        if (isProcessing) return;
        setIsProcessing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        try {
          // Parse NDEF
          const record = tag.ndefMessage[0];
          if (record) {
            const payload = Ndef.text.decodePayload(record.payload);
            const foundId = payload.split('/').pop(); // Assuming format https://takam.app/bond/[id]
            
            if (foundId) {
              // Call Edge Function
              const { data, error } = await supabase.functions.invoke('create-proximity-bond', {
                body: { handshakeId: foundId }
              });

              if (error) throw error;
              
              if (data.status === 'success') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                // The Modal will be triggered via Postgres Subscription in its own component
              }
            }
          }
        } catch (e: any) {
          console.error('Handshake failed:', e);
          Alert.alert('Connection Failed', e.message || 'The tap was interrupted.');
        } finally {
          setIsProcessing(false);
          await NfcManager.cancelTechnologyRequest();
        }
      });

      await NfcManager.requestTechnology(NfcTech.Ndef);

    } catch (ex) {
      console.warn('NFC Error:', ex);
      NfcManager.cancelTechnologyRequest();
    }
  };

  const stopHandshake = () => {
    NfcManager.cancelTechnologyRequest();
    NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
    setIsScanning(false);
  };

  return {
    isScanning,
    startHandshake,
    stopHandshake,
    handshakeId,
    isProcessing
  };
}
