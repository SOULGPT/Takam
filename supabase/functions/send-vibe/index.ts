// TAKAM — send-vibe Edge Function
// Rate limit: max 5 vibes per bond per 10 seconds
// Deploy: supabase functions deploy send-vibe

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RATE_LIMIT = 5;
const WINDOW_MS = 10_000;

// In-memory store (per instance). For production, use Supabase KV or Redis.
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
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { bond_id, vibe_type } = await req.json();

    if (!bond_id || !vibe_type) {
      return new Response(JSON.stringify({ error: 'Missing bond_id or vibe_type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (isRateLimited(bond_id)) {
      return new Response(
        JSON.stringify({ error: 'rate limit: max 5 vibes per 10 seconds per bond' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401 });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user is in this bond
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return new Response('Unauthorized', { status: 401 });

    const { data: bond, error: bondErr } = await supabase
      .from('bonds')
      .select('id, user_a, user_b, status')
      .eq('id', bond_id)
      .single();

    if (bondErr || !bond) return new Response('Bond not found', { status: 404 });
    if (bond.status !== 'active') return new Response('Bond not active', { status: 403 });
    if (bond.user_a !== user.id && bond.user_b !== user.id) {
      return new Response('Forbidden', { status: 403 });
    }

    // Insert vibe record
    const { error: insertErr } = await supabase.from('vibes').insert({
      bond_id,
      sender_id: user.id,
      vibe_type,
    });
    if (insertErr) throw insertErr;

    // Broadcast to Realtime channel
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    await adminClient.channel(`bond:${bond_id}`).send({
      type: 'broadcast',
      event: 'vibe',
      payload: { vibe_type, sender_id: user.id },
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
