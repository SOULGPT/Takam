import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { playSound } from '../lib/sound';
import { trackEvent } from '../lib/analytics';

const HAPTIC_PATTERNS: Record<string, () => Promise<void>> = {
  miss_you: async () => {
    if (Platform.OS === 'web') return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await delay(50);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },
  love: async () => {
    if (Platform.OS === 'web') return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await delay(500);
  },
  thinking_of_you: async () => {
    if (Platform.OS === 'web') return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await delay(80);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await delay(80);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },
};

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export function useVibes(onVibeReceived?: (vibe: any) => void) {
  const activeBondId = useStore((s) => s.activeBondId);
  const session = useStore((s) => s.session);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!activeBondId || !session?.user?.id) return;

    const channel = supabase
      .channel(`vibes:${activeBondId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'vibes',
          filter: `bond_id=eq.${activeBondId}`,
        },
        async (payload) => {
          const row = payload.new as any;

          // Skip vibes I sent myself
          if (row.sender_id === session.user!.id) return;

          const vibeType = row.vibe_type ?? 'miss_you';

          // Play haptic on native
          const hapticFn = HAPTIC_PATTERNS[vibeType] ?? HAPTIC_PATTERNS.miss_you;
          hapticFn().catch(() => {});

          // Notify UI to queue full screen animation
          onVibeReceived?.(row);
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeBondId, session?.user?.id, onVibeReceived]);

  return channelRef;
}

export async function sendVibe(bondId: string, vibeType: string, content?: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('vibes').insert({
    bond_id: bondId,
    sender_id: user.id,
    vibe_type: vibeType,
    content: content,
  });

  if (error) throw new Error(error.message);
  
  // Also invoke sound locally for the sender immediately
  await playSound('send');
  await trackEvent('vibe_sent', { vibeType });
}
