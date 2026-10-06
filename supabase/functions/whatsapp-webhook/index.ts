import { withSupabase } from "npm:@supabase/server@^1";
import { runSalesEngine } from "../_shared/ai-sales-engine/engine.ts";
import { sendText, transcribe, verifySignature } from "./meta.ts";

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
    if (error || !data) throw error ?? new Error("Não foi possível criar o contato.");
    contactId = data.id;
  } else if (found.name !== profileName && profileName !== phone) {
    await db.from("contacts").update({ name: profileName }).eq("id", contactId).eq("organization_id", account.organization_id);
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
    text = "[AUDIO] " + await transcribe(String(message.audio.id), token);
  } else if (message.type === "image") {
    type = "IMAGE";
    text = "[IMAGEM_RECEBIDA] O cliente enviou uma imagem.";
  } else if (message.type === "document") {
    type = "DOCUMENT";
    text = "[DOCUMENTO_RECEBIDO] O cliente enviou um documento.";
  } else return { ignored: true, reason: "unsupported_message_type" };

  if (!text.trim()) return { ignored: true };

  if (conversation?.ai_state === "HUMAN_ACTIVE") {
    await db.from("messages").insert({
      organization_id: account.organization_id, conversation_id: conversation.id, sender_type: "CUSTOMER",
      message_type: type, content: text, status: "SENT",
      metadata: { whatsapp_message_id: message.id, phone_number_id: account.phone_number_id },
    });
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
    await db.from("message_attachments").insert({
      organization_id: account.organization_id,
      message_id: result.message_id,
      external_media_id: mediaId,
      mime_type: media?.mime_type ?? null,
      file_name: media?.filename ?? null,
    });
  }

  if (result.status === "success" && result.response) {
    const outbound = await sendText(account.phone_number_id, phone, result.response, token);
    await db.from("messages").update({
      metadata: {
        whatsapp_message_id: message.id,
        outbound_whatsapp_message_id: outbound?.messages?.[0]?.id ?? null,
      },
    }).eq("id", result.ai_message_id).eq("organization_id", account.organization_id);
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
    if (!(await verifySignature(bodyText, req.headers.get("x-hub-signature-256") ?? ""))) {
      return Response.json({ error: "Invalid signature" }, { status: 401 });
    }

    let body: any;
    try { body = JSON.parse(bodyText); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
    if (body?.object !== "whatsapp_business_account") return Response.json({ received: true });

    const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    if (!token) return Response.json({ error: "WHATSAPP_ACCESS_TOKEN not configured" }, { status: 503 });

    let processed = 0;
    let errors = 0;
    for (const entry of body?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        if (change?.field !== "messages") continue;
        const value = change.value ?? {};
        const phoneNumberId = String(value?.metadata?.phone_number_id ?? "");
        if (!phoneNumberId) continue;

        const { data: account, error } = await ctx.supabaseAdmin.from("whatsapp_accounts")
          .select("organization_id,status,phone_number_id")
          .eq("phone_number_id", phoneNumberId)
          .maybeSingle();
        if (error) throw error;
        if (!account || account.status !== "CONNECTED") continue;

        for (const message of value?.messages ?? []) {
          const eventKey = `message:${message.id}`;
          let event: any = null;
          const { data: createdEvent, error: eventError } = await ctx.supabaseAdmin.from("webhook_events").insert({
            organization_id: account.organization_id,
            provider: "META_CLOUD_API",
            event_key: eventKey,
            event_type: message.type ?? "message",
            payload: message,
            status: "RECEIVED",
          }).select("id").maybeSingle();

          if (eventError?.code === "23505") {
            const { data: existingEvent, error: existingEventError } = await ctx.supabaseAdmin.from("webhook_events")
              .select("id,status")
              .eq("provider", "META_CLOUD_API")
              .eq("event_key", eventKey)
              .maybeSingle();
            if (existingEventError) throw existingEventError;
            if (!existingEvent || existingEvent.status === "PROCESSED") continue;
            event = existingEvent;
          } else {
            if (eventError) throw eventError;
            if (!createdEvent) continue;
            event = createdEvent;
          }

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
