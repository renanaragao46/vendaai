import { withSupabase } from "npm:@supabase/server@^1";
import { runSalesEngine } from "../_shared/ai-sales-engine/engine.ts";

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    try {
      const body = await req.json();
      const organizationId = typeof body?.organization_id === "string" ? body.organization_id : "";
      const customerMessage = typeof body?.message === "string" ? body.message.trim() : "";
      if (!organizationId || !customerMessage) return Response.json({ error: "organization_id e message são obrigatórios" }, { status: 400 });

      const { data: membership, error } = await ctx.supabase
        .from("memberships")
        .select("id,role")
        .eq("organization_id", organizationId)
        .eq("user_id", ctx.userClaims?.sub ?? "")
        .maybeSingle();

      if (error || !membership) return Response.json({ error: "Acesso negado à organização." }, { status: 403 });

      // Membership is verified above. Use the server-side client for the engine so
      // authenticated AGENT/MANAGER users are not blocked by write RLS policies
      // intended for direct client access.
      const result = await runSalesEngine({
        db: ctx.supabaseAdmin,
        organizationId,
        conversationId: body?.conversation_id ? String(body.conversation_id) : null,
        channel: "SIMULATOR",
        customerMessage,
        actorUserId: ctx.userClaims?.sub ?? null,
      });

      return Response.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      return Response.json({ status: "error", error: message }, { status: 500 });
    }
  }),
};
