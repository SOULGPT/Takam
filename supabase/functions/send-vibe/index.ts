// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RATE_LIMIT = 5;
const WINDOW_MS = 10_000;
const vibeLog: Record<string, number[]> = {};

function isRateLimited(bondId: string): boolean {
  const now = Date.now();
  const log = (vibeLog[bondId] ?? []).filter((t) => now - t < WINDOW_MS);
  vibeLog[bondId] = log;
  if (log.length >= RATE_LIMIT) return true;
  vibeLog[bondId].push(now);
  return false;
}

serve(async (req: Request) => {
  // 1. Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      throw new Error('Missing environment variables: Ensure SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are set.');
    }

    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
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

    const { bond_id, vibe_type } = body;

    if (!bond_id || !vibe_type) {
      return new Response(JSON.stringify({ error: 'Missing bond_id or vibe_type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Logic Execution
    if (isRateLimited(bond_id)) {
      return new Response(
        JSON.stringify({ error: 'rate limit: max 5 vibes per 10 seconds per bond' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      .eq('id', bond_id)
      .single();

    if (bondErr || !bond) return new Response('Bond not found', { status: 404, headers: corsHeaders });
    if (bond.status !== 'active') return new Response('Bond not active', { status: 403, headers: corsHeaders });
    if (bond.user_a !== user.id && bond.user_b !== user.id) {
      return new Response('Forbidden', { status: 403, headers: corsHeaders });
    }

    const { error: insertErr } = await supabase.from('vibes').insert({
      bond_id,
      sender_id: user.id,
      vibe_type,
    });
    if (insertErr) throw insertErr;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    await adminClient.channel(`bond:${bond_id}`).send({
      type: 'broadcast',
      event: 'vibe',
      payload: { vibe_type, sender_id: user.id },
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('send-vibe error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
