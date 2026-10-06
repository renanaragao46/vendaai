import { withSupabase } from "npm:@supabase/server@^1";

export default {
  fetch: withSupabase({ auth: "none" }, async (req) => {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      if (token && challenge && token === Deno.env.get("WHATSAPP_VERIFY_TOKEN")) return new Response(challenge);
      return Response.json({ error: "Webhook verification failed" }, { status: 403 });
    }
    if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
    return Response.json({ received: true });
  }),
};
