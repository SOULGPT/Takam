// @ts-nocheck
/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { handshakeId } = await req.json()
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(token)

    if (!user) throw new Error('Unauthorized')

    // 1. Find the target user by handshakeId
    const { data: handshake, error: hError } = await supabase
      .from('proximity_handshakes')
      .select('user_id')
      .eq('handshake_id', handshakeId)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (hError || !handshake) {
      throw new Error('Handshake expired or invalid')
    }

    if (handshake.user_id === user.id) {
      throw new Error('Cannot bond with self')
    }

    // 2. Fetch both profiles for the system message Nature info
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', [user.id, handshake.user_id])

    // 3. Create the bond
    // We check if a bond already exists
    const { data: existingBond } = await supabase
      .from('bonds')
      .select('id')
      .or(`and(user_a.eq.${user.id},user_b.eq.${handshake.user_id}),and(user_a.eq.${handshake.user_id},user_b.eq.${user.id})`)
      .single()

    if (existingBond) {
      return new Response(JSON.stringify({ status: 'already_bonded', bond_id: existingBond.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: bond, error: bError } = await supabase
      .from('bonds')
      .insert({
        user_a: user.id,
        user_b: handshake.user_id,
        status: 'pending', // Modal will then prompt for type and update to active
        bond_type: 'other'
      })
      .select()
      .single()

    if (bError) throw bError

    return new Response(JSON.stringify({ status: 'success', bond_id: bond.id, partner_id: handshake.user_id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
