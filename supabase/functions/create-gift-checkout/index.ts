// @ts-nocheck
/// <reference path="https://deno.land/x/types/index.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Validate Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    // 2. Body parsing
    const { bondId, tier, amount } = await req.json();

    // 3. Logic for Stripe
    // NOTE: Requires STRIPE_SECRET_KEY in Supabase Vault
    /*
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"), { apiVersion: "2022-11-15" });
    const session = await stripe.checkout.sessions.create({
       payment_method_types: ["card"],
       line_items: [{
         price_data: {
           currency: "usd",
           product_data: { name: `TAKAM Ritual: ${tier}` },
           unit_amount: amount,
         },
         quantity: 1,
       }],
       mode: "payment",
       success_url: "takam://gift-success",
       cancel_url: "takam://gift-cancel",
    });
    */

    return new Response(JSON.stringify({ url: "https://stripe.com/mock-session", id: "mock_id" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
