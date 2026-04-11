import { serve } from "https://deno.land/std@0.131.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { type, group_id, sender_id, payload } = await req.json();

    // 1. Get Group Info
    const { data: group } = await supabase.from('groups').select('name').eq('id', group_id).single();
    if (!group) return new Response("Group not found", { status: 404 });

    // 2. Get All Active Members (excluding sender)
    const { data: members } = await supabase
      .from('group_members')
      .select('user_id, profile:profiles(display_name, push_token)')
      .eq('group_id', group_id)
      .eq('status', 'active')
      .neq('user_id', sender_id);

    if (!members || members.length === 0) return new Response("No members to notify", { status: 200 });

    const notifications = [];
    const senderName = payload.sender_name || "Someone";

    for (const member of members) {
      if (member.profile?.push_token) {
        let body = "";
        let title = group.name;

        if (type === "VIBE_SENT") {
          body = `${senderName} sent a vibe to the group: ${payload.vibe_emoji}`;
        } else if (type === "USER_JOINED") {
          body = `${senderName} joined the group! ✨`;
        }

        notifications.push({
          to: member.profile.push_token,
          sound: "default",
          title,
          body,
          data: { group_id, type },
        });
      }
    }

    if (notifications.length > 0) {
      await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notifications),
      });
    }

    return new Response(JSON.stringify({ sent: notifications.length }), { status: 200 });
  } catch (err) {
    return new Response(String(err), { status: 500 });
  }
});
