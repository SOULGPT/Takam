import { supabase } from './supabase';
import { useStore } from '../store/useStore';

export const trackEvent = async (eventName: string, eventData: any = {}) => {
  try {
    const { profile } = useStore.getState();
    await supabase.from('analytics_events').insert({
      user_id: profile?.id || null,
      event_name: eventName,
      event_data: eventData
    });
  } catch (e) {
    console.debug('Analytics failure', e);
  }
};
