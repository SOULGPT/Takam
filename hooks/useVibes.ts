import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';

export const useVibes = (onVibe: (vibe: any) => void) => {
  const { activeBondId } = useStore();

  useEffect(() => {
    if (!activeBondId) return;

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
        (payload) => {
          onVibe(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeBondId, onVibe]);
};

export const sendVibe = async (bondId: string, vibeType: string, content?: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('vibes').insert({
    bond_id: bondId,
    sender_id: user.id,
    vibe_type: vibeType,
    content: content || null,
  });

  if (error) throw error;
};
