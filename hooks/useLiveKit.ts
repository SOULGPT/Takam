import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { useCallStore } from '../store/useCallStore';

export function useLiveKit() {
  const { profile } = useStore();
  const { 
    status, 
    activeBondId, 
    setCallStatus,
    resetCall
  } = useCallStore();

  const [token, setToken] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  const fetchToken = useCallback(async () => {
    if (!activeBondId || !profile?.display_name) return;

    try {
      const { data, error } = await supabase.functions.invoke('livekit-token', {
        body: {
          room_name: activeBondId,
          participant_name: profile.display_name,
        },
      });

      if (error) throw error;
      
      setToken(data.token);
      
      // Use EXPO_PUBLIC_LIVEKIT_URL from environment variables
      setUrl(process.env.EXPO_PUBLIC_LIVEKIT_URL || 'wss://placeholder-project.livekit.cloud');
      
      setCallStatus('connected');
    } catch (err) {
      console.error('Failed to fetch LiveKit token:', err);
      resetCall();
    }
  }, [activeBondId, profile?.display_name, setCallStatus, resetCall]);

  useEffect(() => {
    if ((status === 'calling' || status === 'ringing') && !token) {
      fetchToken();
    }
  }, [status, fetchToken, token]);

  const endCall = useCallback(() => {
    setToken(null);
    resetCall();
  }, [resetCall]);

  return { token, url, endCall };
}
