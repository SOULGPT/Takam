// Follow this setup guide to integrate and deploy:
// https://supabase.com/docs/guides/functions/quickstart

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.10.0';

// Initialize Supabase Client
const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  try {
    // Webhook payload from Supabase
    const payload = await req.json();

    // Verify it's an INSERT event
    if (payload.type !== 'INSERT') {
      return new Response('Not an insert event', { status: 200 });
    }

    const { table, record } = payload;
    let recipientId = '';
    let notificationTitle = '';
    let notificationBody = '';

    if (table === 'messages') {
      // Find the partner to send the message to
      const bondId = record.bond_id;
      const { data: bond } = await supabase.from('bonds').select('*').eq('id', bondId).single();
      
      recipientId = bond.user_a === record.sender_id ? bond.user_b : bond.user_a;
      notificationTitle = 'New Message 💬';
      notificationBody = 'Someone just messaged you!'; // Or extract snippet if desired
      
    } else if (table === 'vibes') {
      // Find the partner
      const bondId = record.bond_id;
      const { data: bond } = await supabase.from('bonds').select('*').eq('id', bondId).single();
      
      recipientId = bond.user_a === record.sender_id ? bond.user_b : bond.user_a;
      
      const vibeLabel = record.vibe_type.replace('_', ' ').toUpperCase();
      notificationTitle = 'New Vibe Received! ✨';
      notificationBody = `You were sent a ${vibeLabel} vibe!`;
    } else {
      return new Response('Unhandled table', { status: 200 });
    }

    // Lookup Push Token
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('expo_push_token')
      .eq('id', recipientId)
      .single();

    const pushToken = userProfile?.expo_push_token;
    if (!pushToken) {
      return new Response('No push token found for user.', { status: 200 });
    }

    // Fire to Expo's Push API
    const pushMsg = {
      to: pushToken,
      sound: 'default',
      title: notificationTitle,
      body: notificationBody,
      data: { url: '/connections' }, // Custom payload allowing Deep Linking
    };

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pushMsg),
    });

    const resData = await res.json();
    return new Response(JSON.stringify(resData), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
