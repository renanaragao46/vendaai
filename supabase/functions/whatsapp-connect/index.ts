import { withSupabase } from "npm:@supabase/server@^1";

const version = Deno.env.get("WHATSAPP_GRAPH_VERSION") ?? "v24.0";

async function graph(path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`https://graph.facebook.com/${version}/${path.replace(/^\//, "")}`, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `Meta Graph API error ${response.status}`);
  }
  return payload;
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    try {
      const body = await req.json();
      const organizationId = String(body?.organization_id ?? "");
      if (!organizationId) {
        return Response.json({ error: "organization_id é obrigatório" }, { status: 400 });
      }

      const userId = String(ctx.userClaims?.id ?? "");
      const { data: membership, error: membershipError } = await ctx.supabase
        .from("memberships")
        .select("role")
        .eq("organization_id", organizationId)
        .eq("user_id", userId)
        .maybeSingle();

      if (membershipError) throw membershipError;
      if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
        return Response.json({ error: "Acesso negado." }, { status: 403 });
      }

      const { data: account, error: accountError } = await ctx.supabase
        .from("whatsapp_accounts")
        .select("*")
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (accountError) throw accountError;
      if (!account) {
        return Response.json({ error: "Configure primeiro a conexão do WhatsApp." }, { status: 400 });
      }

      if (account.provider === "WHATSAPP_WEB") {
        const gatewayUrl = Deno.env.get("WHATSAPP_WEB_GATEWAY_URL");
        const gatewayToken = Deno.env.get("WHATSAPP_WEB_GATEWAY_TOKEN");
        if (!gatewayUrl || !gatewayToken) {
          return Response.json({
            error: "O gateway WhatsApp Web não está configurado nos Secrets do backend.",
          }, { status: 503 });
        }

        const instanceId = String(account.gateway_instance_id || organizationId);
        const response = await fetch(
          `${gatewayUrl.replace(/\\/$/, "")}/v1/instances/${encodeURIComponent(instanceId)}/connect`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${gatewayToken}`,
            },
            body: JSON.stringify({
              phone_number: account.phone_number ?? null,
              organization_id: organizationId,
            }),
          },
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error ?? `Gateway error ${response.status}`);

        const { error: updateError } = await ctx.supabase
          .from("whatsapp_accounts")
          .update({
            provider: "WHATSAPP_WEB",
            status: payload?.connected ? "CONNECTED" : "PENDING",
            gateway_instance_id: instanceId,
            gateway_status: payload?.status ?? "CONNECTING",
            display_name: payload?.display_name ?? account.display_name,
            phone_number: payload?.phone_number ?? account.phone_number,
            last_error: null,
          })
          .eq("organization_id", organizationId);
        if (updateError) throw updateError;

        return Response.json({
          connected: Boolean(payload?.connected),
          pending_webhook_verification: !payload?.connected,
          gateway: {
            instance_id: instanceId,
            status: payload?.status ?? "CONNECTING",
            qr: payload?.qr ?? null,
            pairing_code: payload?.pairing_code ?? null,
          },
        });
      }

      const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
      if (!token) {
        return Response.json({ error: "WHATSAPP_ACCESS_TOKEN não configurado nos Secrets do backend." }, { status: 503 });
      }

      if (!account?.business_account_id || !account?.phone_number_id) {
        return Response.json({
          error: "Informe o WhatsApp Business Account ID e o Phone Number ID antes de testar.",
        }, { status: 400 });
      }

      const wabaId = String(account.business_account_id);
      const phoneNumberId = String(account.phone_number_id);

      // 1) Validate the WABA itself with Meta.
      const waba = await graph(`${wabaId}?fields=id,name`, token);
      if (String(waba?.id ?? "") !== wabaId) {
        throw new Error("O WhatsApp Business Account ID informado não corresponde à conta retornada pela Meta.");
      }

      // 2) Validate the phone number and make sure it belongs to the supplied WABA.
      const phone = await graph(
        `${phoneNumberId}?fields=id,display_phone_number,verified_name,whatsapp_business_account`,
        token,
      );

      const returnedWabaId = String(phone?.whatsapp_business_account?.id ?? "");
      if (String(phone?.id ?? "") !== phoneNumberId) {
        throw new Error("O Phone Number ID informado não corresponde ao número retornado pela Meta.");
      }
      if (returnedWabaId && returnedWabaId !== wabaId) {
        throw new Error("O Phone Number ID informado pertence a outro WhatsApp Business Account.");
      }

      // 3) Subscribe the app to the WABA so Meta can deliver WhatsApp webhooks.
      // Meta documents this subscription as required to receive events for the
      // phone numbers under the WABA.
      await graph(`${wabaId}/subscribed_apps`, token, { method: "POST" });

      // A successful Graph validation/subscription is not, by itself, proof
      // that Meta has completed the webhook callback verification. Keep the
      // account pending until the webhook endpoint receives a verified
      // callback. This prevents the UI from claiming a connection too early.
      const webhookVerified = Boolean(account.webhook_verified_at);
      const nextStatus = webhookVerified ? "CONNECTED" : "PENDING";
      const now = new Date().toISOString();

      const { error: updateError } = await ctx.supabase
        .from("whatsapp_accounts")
        .update({
          status: nextStatus,
          phone_number: phone.display_phone_number ?? account.phone_number,
          display_name: phone.verified_name ?? account.display_name,
          business_account_id: wabaId,
          phone_number_id: phoneNumberId,
          connected_at: webhookVerified ? (account.connected_at ?? now) : null,
          last_error: null,
        })
        .eq("organization_id", organizationId);

      if (updateError) throw updateError;

      return Response.json({
        connected: webhookVerified,
        pending_webhook_verification: !webhookVerified,
        subscribed: true,
        account: {
          id: phone.id,
          display_phone_number: phone.display_phone_number ?? null,
          verified_name: phone.verified_name ?? null,
          whatsapp_business_account_id: wabaId,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      try {
        const body = await req.clone().json();
        const organizationId = String(body?.organization_id ?? "");
        if (organizationId) {
          await ctx.supabase
            .from("whatsapp_accounts")
            .update({ status: "ERROR", last_error: message })
            .eq("organization_id", organizationId);
        }
      } catch {
        // Preserve the original Meta error response even if error persistence fails.
      }
      return Response.json({ error: message }, { status: 400 });
    }
  }),
};
