// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { AccessToken } from 'npm:livekit-server-sdk';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables.');
    }

    // 2. Safe Body Parsing
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { room_name, participant_name } = body;

    if (!room_name || !participant_name) {
      return new Response(JSON.stringify({ error: 'Missing room_name or participant_name' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

    const { data: bond, error: bondErr } = await supabase
      .from('bonds')
      .select('id, user_a, user_b, status')
      .eq('id', room_name)
      .single();

    if (bondErr || !bond) return new Response('Bond not found', { status: 404, headers: corsHeaders });
    if (bond.status !== 'active') return new Response('Bond not active', { status: 403, headers: corsHeaders });
    if (bond.user_a !== user.id && bond.user_b !== user.id) {
      return new Response('Forbidden', { status: 403, headers: corsHeaders });
    }

    // Generate Token
    const apiKey = Deno.env.get('LIVEKIT_API_KEY');
    const apiSecret = Deno.env.get('LIVEKIT_API_SECRET');

    if (!apiKey || !apiSecret) {
      throw new Error('LiveKit credentials not configured');
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: user.id,
      name: participant_name,
    });
    
    at.addGrant({ roomJoin: true, room: room_name, canPublish: true, canSubscribe: true });
    const token = await at.toJwt();

    return new Response(JSON.stringify({ token }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('livekit-token error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
