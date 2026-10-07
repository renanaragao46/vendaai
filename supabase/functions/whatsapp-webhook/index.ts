import { withSupabase } from "npm:@supabase/server@^1";
import { runSalesEngine } from "../_shared/ai-sales-engine/engine.ts";
import { sendText, transcribe, verifySignature } from "./meta.ts";

async function sendWhatsAppText(account: any, to: string, text: string) {
  if (account.provider === "WHATSAPP_WEB") {
    const gatewayUrl = Deno.env.get("WHATSAPP_WEB_GATEWAY_URL");
    const gatewayToken = Deno.env.get("WHATSAPP_WEB_GATEWAY_TOKEN");
    if (!gatewayUrl || !gatewayToken || !account.gateway_instance_id) {
      throw new Error("Gateway WhatsApp Web não configurado.");
    }
    const response = await fetch(
      `${gatewayUrl.replace(/\/$/, "")}/v1/instances/${encodeURIComponent(account.gateway_instance_id)}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gatewayToken}`,
        },
        body: JSON.stringify({ to, text }),
      },
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error ?? `Gateway error ${response.status}`);
    return payload;
  }
  return sendText(account.phone_number_id, to, text, Deno.env.get("WHATSAPP_ACCESS_TOKEN")!);
}

async function handleMessage(db: any, message: any, contacts: any[], account: any, token: string) {
  const phone = String(message?.from ?? "");
  if (!phone || !message?.id) return { ignored: true };

  const profileName = String(contacts?.[0]?.profile?.name ?? phone);
  const { data: found } = await db.from("contacts").select("id,name").eq("organization_id", account.organization_id).eq("phone", phone).maybeSingle();
  let contactId = found?.id as string | undefined;
  if (!contactId) {
    const { data, error } = await db.from("contacts").insert({
      organization_id: account.organization_id, name: profileName, phone, source: "WHATSAPP", tags: [],
    }).select("id").single();
    if (error?.code === "23505") {
      const { data: racedContact, error: racedContactError } = await db.from("contacts")
        .select("id,name")
        .eq("organization_id", account.organization_id)
        .eq("phone", phone)
        .maybeSingle();
      if (racedContactError || !racedContact) throw racedContactError ?? new Error("Não foi possível localizar o contato criado em paralelo.");
      contactId = racedContact.id;
    } else {
      if (error || !data) throw error ?? new Error("Não foi possível criar o contato.");
      contactId = data.id;
    }
  } else if (found.name !== profileName && profileName !== phone) {
    const { error: contactUpdateError } = await db.from("contacts")
      .update({ name: profileName })
      .eq("id", contactId)
      .eq("organization_id", account.organization_id);
    if (contactUpdateError) throw contactUpdateError;
  }

  const { data: conversation } = await db.from("conversations")
    .select("id,ai_state")
    .eq("organization_id", account.organization_id)
    .eq("contact_id", contactId)
    .eq("channel", "WHATSAPP")
    .eq("status", "OPEN")
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let text = "";
  let type = "TEXT";
  if (message.type === "text") text = String(message?.text?.body ?? "").trim();
  else if (message.type === "audio" && message?.audio?.id) {
    type = "AUDIO";
    text = account.provider === "WHATSAPP_WEB"
      ? "[AUDIO_RECEBIDO] O cliente enviou um áudio."
      : "[AUDIO] " + await transcribe(String(message.audio.id), token);
  } else if (message.type === "image") {
    type = "IMAGE";
    text = "[IMAGEM_RECEBIDA] O cliente enviou uma imagem.";
  } else if (message.type === "document") {
    type = "DOCUMENT";
    text = "[DOCUMENTO_RECEBIDO] O cliente enviou um documento.";
  } else return { ignored: true, reason: "unsupported_message_type" };

  if (!text.trim()) return { ignored: true };

  if (conversation?.ai_state === "HUMAN_ACTIVE") {
    const { data: existingHumanMessage, error: existingHumanMessageError } = await db.from("messages")
      .select("id")
      .eq("organization_id", account.organization_id)
      .eq("conversation_id", conversation.id)
      .eq("sender_type", "CUSTOMER")
      .contains("metadata", { external_message_id: String(message.id) })
      .maybeSingle();
    if (existingHumanMessageError) throw existingHumanMessageError;
    if (!existingHumanMessage) {
      const { error: humanMessageError } = await db.from("messages").insert({
        organization_id: account.organization_id, conversation_id: conversation.id, sender_type: "CUSTOMER",
        message_type: type, content: text, status: "SENT",
        metadata: {
          channel: "WHATSAPP",
          external_message_id: String(message.id),
          whatsapp_message_id: message.id,
          phone_number_id: account.phone_number_id,
        },
      });
      if (humanMessageError && humanMessageError.code !== "23505") throw humanMessageError;
    }
    return { handoff: true, conversation_id: conversation.id };
  }

  const mediaId = type === "AUDIO" ? String(message?.audio?.id ?? "") : type === "IMAGE" ? String(message?.image?.id ?? "") : type === "DOCUMENT" ? String(message?.document?.id ?? "") : "";

  const result = await runSalesEngine({
    db,
    organizationId: account.organization_id,
    conversationId: conversation?.id ?? null,
    contactId,
    channel: "WHATSAPP",
    customerMessage: text,
    externalMessageId: String(message.id),
  });

  if (result.message_id && mediaId) {
    const media = type === "AUDIO" ? message.audio : type === "IMAGE" ? message.image : message.document;
    const { data: existingAttachment, error: existingAttachmentError } = await db.from("message_attachments")
      .select("id")
      .eq("organization_id", account.organization_id)
      .eq("message_id", result.message_id)
      .eq("external_media_id", mediaId)
      .maybeSingle();
    if (existingAttachmentError) throw existingAttachmentError;
    if (!existingAttachment) {
      await db.from("message_attachments").insert({
        organization_id: account.organization_id,
        message_id: result.message_id,
        external_media_id: mediaId,
        mime_type: media?.mime_type ?? null,
        file_name: media?.filename ?? null,
      });
    }
  }

  if (result.status === "success" && result.response) {
    if (result.replayed) {
      return {
        ...result,
        outbound_message_id: result.outbound_message_id ?? null,
      };
    }

    const outbound = await sendWhatsAppText(account, phone, result.response);
    const { data: currentAiMessage, error: currentAiMessageError } = await db.from("messages")
      .select("metadata")
      .eq("id", result.ai_message_id)
      .eq("organization_id", account.organization_id)
      .maybeSingle();
    if (currentAiMessageError) throw currentAiMessageError;
    const deliveryMetadata = {
      ...(currentAiMessage?.metadata ?? {}),
      external_message_id: String(message.id),
      whatsapp_message_id: message.id,
      outbound_whatsapp_message_id: outbound?.messages?.[0]?.id ?? null,
      intent: result.intent ?? "unknown",
      confidence: result.confidence ?? 1,
      identified_product_id: result.identified_product_id ?? null,
      next_action: result.next_action ?? "RESPOND",
      validation: result.validation ?? { valid: true, issues: [], checks: {} },
    };
    const { error: deliveryMetadataError } = await db.from("messages").update({
      status: "DELIVERED",
      metadata: deliveryMetadata,
    }).eq("id", result.ai_message_id).eq("organization_id", account.organization_id);

    // The customer already received the WhatsApp message. Do not turn a
    // metadata-only persistence failure into a webhook retry, which could
    // send the same message twice.
    if (deliveryMetadataError) console.error("Failed to persist WhatsApp delivery metadata", deliveryMetadataError);

    return { ...result, outbound_message_id: outbound?.messages?.[0]?.id ?? null };
  }
  return result;
}

export default {
  fetch: withSupabase({ auth: "none" }, async (req, ctx) => {
    const url = new URL(req.url);

    if (req.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const verifyToken = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      if (mode === "subscribe" && challenge && verifyToken && verifyToken === Deno.env.get("WHATSAPP_VERIFY_TOKEN")) {
        return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
      }
      return Response.json({ error: "Webhook verification failed" }, { status: 403 });
    }

    if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });

    const bodyText = await req.text();

    const gatewaySecret = Deno.env.get("WHATSAPP_WEB_GATEWAY_SECRET");
    const isGatewayRequest = Boolean(gatewaySecret) && req.headers.get("x-vendaai-gateway-secret") === gatewaySecret;

    if (!isGatewayRequest && !(await verifySignature(bodyText, req.headers.get("x-hub-signature-256") ?? ""))) {
      return Response.json({ error: "Invalid signature" }, { status: 401 });
    }

    let body: any;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (isGatewayRequest) {
      if (body?.object !== "whatsapp_web" || !body?.instance_id) {
        return Response.json({ error: "Invalid gateway payload" }, { status: 400 });
      }
    } else if (body?.object !== "whatsapp_business_account") {
      return Response.json({ received: true });
    }

    const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN") ?? "";
    if (!isGatewayRequest && !token) {
      return Response.json({ error: "WHATSAPP_ACCESS_TOKEN not configured" }, { status: 503 });
    }

    const webhookEntries = isGatewayRequest
      ? [{
          id: "",
          changes: [{
            field: "messages",
            value: {
              metadata: { phone_number_id: null },
              contacts: body?.contacts ?? [],
              messages: body?.messages ?? [],
            },
          }],
        }]
      : (body?.entry ?? []);

    let processed = 0;
    let errors = 0;
    for (const entry of webhookEntries) {
      for (const change of entry?.changes ?? []) {
        if (change?.field !== "messages") continue;
        const value = change.value ?? {};
        const phoneNumberId = String(value?.metadata?.phone_number_id ?? "");
        if (!isGatewayRequest && !phoneNumberId) continue;

        const accountQuery = ctx.supabaseAdmin.from("whatsapp_accounts")
          .select("organization_id,status,provider,phone_number_id,business_account_id,gateway_instance_id");
        const { data: account, error } = await (isGatewayRequest
          ? accountQuery.eq("gateway_instance_id", String(body?.instance_id ?? "")).eq("provider", "WHATSAPP_WEB")
          : accountQuery.eq("phone_number_id", phoneNumberId))
          .maybeSingle();
        if (error) throw error;
        if (!account || !["CONNECTED", "PENDING"].includes(account.status)) continue;

        const entryWabaId = String(entry?.id ?? "");
        if (!isGatewayRequest && entryWabaId && entryWabaId !== String(account.business_account_id ?? "")) continue;

        // A valid Meta-signed POST reaching this phone-number endpoint proves
        // that the webhook is configured and delivering events end-to-end.
        // This is stronger than merely validating the Graph API credentials.
        const verifiedQuery = ctx.supabaseAdmin
          .from("whatsapp_accounts")
          .update({
            status: "CONNECTED",
            webhook_verified_at: new Date().toISOString(),
            connected_at: account.status === "CONNECTED" ? undefined : new Date().toISOString(),
            last_error: null,
          })
          .eq("organization_id", account.organization_id);
        const { error: webhookVerifiedError } = await (isGatewayRequest
          ? verifiedQuery.eq("gateway_instance_id", String(body?.instance_id ?? ""))
          : verifiedQuery.eq("phone_number_id", phoneNumberId));
        if (webhookVerifiedError) throw webhookVerifiedError;

        for (const message of value?.messages ?? []) {
          const eventKey = `${isGatewayRequest ? "web" : "message"}:${message.id}`;
          let event: any = null;
          const { data: createdEvent, error: eventError } = await ctx.supabaseAdmin.from("webhook_events").insert({
            organization_id: account.organization_id,
            provider: isGatewayRequest ? "WHATSAPP_WEB" : "META_CLOUD_API",
            event_key: eventKey,
            event_type: message.type ?? "message",
            payload: message,
            status: "RECEIVED",
          }).select("id").maybeSingle();

          if (eventError?.code === "23505") {
            const { data: existingEvent, error: existingEventError } = await ctx.supabaseAdmin.from("webhook_events")
              .select("id,status,received_at")
              .eq("provider", isGatewayRequest ? "WHATSAPP_WEB" : "META_CLOUD_API")
              .eq("event_key", eventKey)
              .maybeSingle();
            if (existingEventError) throw existingEventError;
            if (!existingEvent || existingEvent.status === "PROCESSED") continue;
            if (existingEvent.status === "PROCESSING") {
              const receivedAt = Date.parse(String(existingEvent.received_at ?? ""));
              const stale = Number.isFinite(receivedAt) && Date.now() - receivedAt > 10 * 60 * 1000;
              if (!stale) continue;
            }
            event = existingEvent;
          } else {
            if (eventError) throw eventError;
            if (!createdEvent) continue;
            event = createdEvent;
          }

          const staleProcessing = event.status === "PROCESSING";
          const processingQuery = ctx.supabaseAdmin.from("webhook_events")
            .update({ status: "PROCESSING", error: null })
            .eq("id", event.id);
          const { data: processingEvent, error: processingError } = await (staleProcessing
            ? processingQuery.eq("status", "PROCESSING")
            : processingQuery.in("status", ["RECEIVED", "ERROR"]))
            .select("id")
            .maybeSingle();
          if (processingError) throw processingError;
          if (!processingEvent) continue;

          try {
            await handleMessage(ctx.supabaseAdmin, message, value.contacts ?? [], account, token);
            await ctx.supabaseAdmin.from("webhook_events").update({ status: "PROCESSED", processed_at: new Date().toISOString() }).eq("id", event.id);
            processed++;
          } catch (error) {
            errors++;
            await ctx.supabaseAdmin.from("webhook_events").update({
              status: "ERROR",
              error: error instanceof Error ? error.message : "Unknown error",
              processed_at: new Date().toISOString(),
            }).eq("id", event.id);
          }
        }
      }
    }

    return Response.json({ received: true, processed, errors }, { status: errors ? 500 : 200 });
  }),
};
