// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.10.0';

serve(async (req: Request) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Webhook payload from Supabase
    let payload;
    try {
      payload = await req.json();
    } catch (e) {
      return new Response('Invalid JSON', { status: 400 });
    }

    // Verify it's an INSERT event
    if (payload.type !== 'INSERT') {
      return new Response('Not an insert event', { status: 200 });
    }

    const { table, record } = payload;
    let recipientId = '';
    let notificationTitle = '';
    let notificationBody = '';

    if (table === 'messages') {
      const bondId = record.bond_id;
      const { data: bond, error: bondErr } = await supabase.from('bonds').select('*').eq('id', bondId).single();
      
      if (bondErr || !bond) return new Response('Bond record not found', { status: 200 });

      recipientId = bond.user_a === record.sender_id ? bond.user_b : bond.user_a;
      notificationTitle = 'New Message 💬';
      notificationBody = 'Someone just messaged you!'; 
      
    } else if (table === 'vibes') {
      const bondId = record.bond_id;
      const { data: bond, error: bondErr } = await supabase.from('bonds').select('*').eq('id', bondId).single();
      
      if (bondErr || !bond) return new Response('Bond record not found', { status: 200 });

      recipientId = bond.user_a === record.sender_id ? bond.user_b : bond.user_a;
      
      const vibeType = record.vibe_type || 'unknown';
      const vibeLabel = vibeType.replace('_', ' ').toUpperCase();
      notificationTitle = 'New Vibe Received! ✨';
      notificationBody = `You were sent a ${vibeLabel} vibe!`;
    } else {
      return new Response('Unhandled table', { status: 200 });
    }

    // Lookup Push Token
    const { data: userProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('expo_push_token')
      .eq('id', recipientId)
      .single();

    const pushToken = userProfile?.expo_push_token;
    if (profileErr || !pushToken) {
      console.log(`No push token found for user ${recipientId}. Skipping.`);
      return new Response('No push token found', { status: 200 });
    }

    // Fire to Expo's Push API
    const pushMsg = {
      to: pushToken,
      sound: 'default',
      title: notificationTitle,
      body: notificationBody,
      data: { url: '/connections' }, 
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
    console.log('Push notification result:', resData);
    
    return new Response(JSON.stringify(resData), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('push-notify execution failed:', errorMsg);
    return new Response(JSON.stringify({ error: errorMsg }), { status: 500 });
  }
});
