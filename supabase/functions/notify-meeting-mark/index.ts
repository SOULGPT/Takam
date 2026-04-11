// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.10.0';

serve(async (req: Request) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const googleKey = Deno.env.get('GOOGLE_PLACES_KEY') || Deno.env.get('EXPO_PUBLIC_GOOGLE_PLACES_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.json();
    if (payload.type !== 'INSERT') {
      return new Response('Not an insert', { status: 200 });
    }

    const { record } = payload;
    const { bond_id, latitude, longitude, category, created_by } = record;

    // 1. Get Bond & Recipient
    const { data: bond } = await supabase.from('bonds').select('*').eq('id', bond_id).single();
    if (!bond) return new Response('Bond not found', { status: 200 });
    const recipientId = bond.user_a === created_by ? bond.user_b : bond.user_a;

    // 2. Reverse Geocode (Heavy Lifting)
    let locationName = 'a secret spot';
    if (googleKey) {
      try {
        const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${googleKey}`;
        const geoRes = await fetch(geoUrl);
        const geoData = await geoRes.json();
        
        if (geoData.results && geoData.results[0]) {
          // Find the city/locality
          const cityComp = geoData.results[0].address_components.find(c => 
            c.types.includes('locality') || c.types.includes('administrative_area_level_1')
          );
          if (cityComp) locationName = cityComp.long_name;
        }
      } catch (e) {
        console.error('Geocoding failed:', e);
      }
    }

    // 3. Craft Message
    const categoryLabels = {
      coffee: 'a coffee date',
      dinner: 'a romantic dinner',
      meet: 'a secret meetup',
      stay: 'a place to stay'
    };
    const activity = categoryLabels[category] || 'a new mark';
    
    // 4. Lookup Push Token
    const { data: profile } = await supabase.from('profiles').select('expo_push_token').eq('id', recipientId).single();
    if (!profile?.expo_push_token) return new Response('No push token', { status: 200 });

    // 5. Send Push
    const pushMsg = {
      to: profile.expo_push_token,
      sound: 'default',
      title: '📍 New Mark Dropped',
      body: `They just marked a spot in ${locationName}—they're thinking of ${activity}.`,
      data: { url: '/bridge' }
    };

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pushMsg),
    });

    return new Response(JSON.stringify({ success: true, location: locationName }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
