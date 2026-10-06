import { withSupabase } from "npm:@supabase/server@^1";

const version = Deno.env.get("WHATSAPP_GRAPH_VERSION") ?? "v24.0";

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    try {
      const body = await req.json();
      const organizationId = String(body?.organization_id ?? "");
      if (!organizationId) return Response.json({ error: "organization_id é obrigatório" }, { status: 400 });

      const { data: membership } = await ctx.supabase.from("memberships")
        .select("role").eq("organization_id", organizationId).eq("user_id", ctx.userClaims?.sub ?? "").maybeSingle();
      if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) return Response.json({ error: "Acesso negado." }, { status: 403 });

      const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
      if (!token) return Response.json({ error: "WHATSAPP_ACCESS_TOKEN não configurado." }, { status: 503 });

      const { data: account, error } = await ctx.supabase.from("whatsapp_accounts")
        .select("*").eq("organization_id", organizationId).maybeSingle();
      if (error || !account?.phone_number_id) return Response.json({ error: "Informe o Phone Number ID antes de testar." }, { status: 400 });

      const response = await fetch(`https://graph.facebook.com/${version}/${account.phone_number_id}?fields=id,display_phone_number,verified_name,whatsapp_business_account`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        await ctx.supabase.from("whatsapp_accounts").update({ status: "ERROR", last_error: payload?.error?.message ?? "Falha na validação." }).eq("organization_id", organizationId);
        return Response.json({ error: payload?.error?.message ?? "Falha ao validar WhatsApp." }, { status: 400 });
      }

      await ctx.supabase.from("whatsapp_accounts").update({
        status: "CONNECTED",
        phone_number: payload.display_phone_number ?? account.phone_number,
        display_name: payload.verified_name ?? account.display_name,
        business_account_id: payload.whatsapp_business_account?.id ?? account.business_account_id,
        connected_at: new Date().toISOString(),
        webhook_verified_at: new Date().toISOString(),
        last_error: null,
      }).eq("organization_id", organizationId);

      return Response.json({ connected: true, account: payload });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "Erro desconhecido" }, { status: 500 });
    }
  }),
};
