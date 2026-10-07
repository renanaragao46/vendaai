import http from "node:http";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import pino from "pino";
import QRCode from "qrcode";
import makeWASocket, { DisconnectReason, useMultiFileAuthState } from "@whiskeysockets/baileys";

const PORT = Number(process.env.PORT || 8787);
const DATA_DIR = process.env.WHATSAPP_DATA_DIR || "/data";
const API_TOKEN = process.env.GATEWAY_API_TOKEN || "";
const WEBHOOK_URL = process.env.VENDAAI_WEBHOOK_URL || "";
const WEBHOOK_SECRET = process.env.VENDAAI_WEBHOOK_SECRET || "";
const logger = pino({ level: process.env.LOG_LEVEL || "info" });
const instances = new Map();

function json(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
  });
  res.end(JSON.stringify(body));
}
async function body(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}
function authorized(req) {
  if (!API_TOKEN) return true;
  return req.headers.authorization === `Bearer ${API_TOKEN}`;
}
function instancePath(id) { return join(DATA_DIR, "instances", id); }

async function notifyVendaAI(instance, payload) {
  if (!WEBHOOK_URL || !WEBHOOK_SECRET) return;
  const response = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-vendaai-gateway-secret": WEBHOOK_SECRET },
    body: JSON.stringify({ object: "whatsapp_web", instance_id: instance.id, ...payload }),
  });
  if (!response.ok) logger.warn({ status: response.status }, "VendaAI webhook returned non-2xx");
}

async function connectInstance(id) {
  let state = instances.get(id);
  if (state?.socket) return state;

  await mkdir(instancePath(id), { recursive: true });
  const auth = await useMultiFileAuthState(instancePath(id));
  state = { id, status: "CONNECTING", socket: null, qr: null, phone_number: null, display_name: null, ...auth };
  instances.set(id, state);

  const socket = makeWASocket({
    auth: auth.state,
    logger: pino({ level: "silent" }),
    markOnlineOnConnect: false,
    syncFullHistory: false,
    browser: ["VendaAI", "Chrome", "1.0.0"],
  });
  state.socket = socket;

  socket.ev.on("creds.update", auth.saveCreds);
  socket.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      state.status = "QR";
      state.qr = await QRCode.toDataURL(qr);
    }
    if (connection === "open") {
      state.status = "CONNECTED";
      state.qr = null;
      state.phone_number = socket.user?.id?.split(":")[0]?.split("@")[0] || null;
      state.display_name = socket.user?.name || null;
      logger.info({ instance: id }, "WhatsApp connected");
      await notifyVendaAI(state, { status: "CONNECTED", phone_number: state.phone_number, display_name: state.display_name });
    } else if (connection === "close") {
      state.socket = null;
      const code = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      state.status = loggedOut ? "DISCONNECTED" : "RECONNECTING";
      if (!loggedOut) setTimeout(() => connectInstance(id).catch((error) => logger.error({ error }, "reconnect failed")), 1500);
      else await notifyVendaAI(state, { status: "DISCONNECTED" });
    }
  });

  socket.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const message of messages) {
      if (!message?.message || message.key?.fromMe) continue;
      const jid = message.key?.remoteJid;
      if (!jid || jid.endsWith("@g.us") || jid === "status@broadcast") continue;
      const text = message.message?.conversation
        ?? message.message?.extendedTextMessage?.text
        ?? message.message?.imageMessage?.caption
        ?? message.message?.documentMessage?.caption
        ?? "";
      let messageType = "text";
      if (message.message?.audioMessage) messageType = "audio";
      else if (message.message?.imageMessage) messageType = "image";
      else if (message.message?.documentMessage) messageType = "document";
      if (!text && messageType === "text") continue;
      const normalized = {
        id: message.key.id,
        from: jid.replace(/@s\.whatsapp\.net$/, ""),
        type: messageType,
        text: messageType === "text" ? { body: text } : undefined,
        audio: messageType === "audio" ? { id: message.key.id, mime_type: message.message.audioMessage.mimetype } : undefined,
        image: messageType === "image" ? { id: message.key.id, mime_type: message.message.imageMessage.mimetype } : undefined,
        document: messageType === "document" ? { id: message.key.id, mime_type: message.message.documentMessage.mimetype, filename: message.message.documentMessage.fileName } : undefined,
      };
      await notifyVendaAI(state, {
        status: "CONNECTED",
        contacts: [{ profile: { name: message.pushName || normalized.from } }],
        messages: [normalized],
      });
    }
  });

  return state;
}

async function waitForConnectionResult(state, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (state.qr || state.status === "CONNECTED" || state.status === "DISCONNECTED") return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

function publicState(state) {
  return {
    status: state.status,
    connected: state.status === "CONNECTED",
    qr: state.qr,
    phone_number: state.phone_number,
    display_name: state.display_name,
  };
}

await mkdir(join(DATA_DIR, "instances"), { recursive: true });

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") return json(res, 204, {});
    if (req.url === "/health" && req.method === "GET") return json(res, 200, { ok: true, service: "vendaai-whatsapp-gateway" });
    const match = req.url?.match(/^\/v1\/instances\/([^/]+)(?:\/(connect|status|messages|disconnect))?$/);
    if (!match) return json(res, 404, { error: "Not found" });
    const id = decodeURIComponent(match[1]);
    const action = match[2];

    // QR/status bootstrap endpoints are intentionally callable by the
    // authenticated VendaAI Edge Function without exposing the gateway token
    // to the application. Message sending and logout remain token-protected.
    const requiresGatewayToken = action === "messages" || action === "disconnect";
    if (requiresGatewayToken && !authorized(req)) {
      return json(res, 401, { error: "Unauthorized" });
    }

    if (req.method === "POST" && action === "connect") {
      const state = await connectInstance(id);
      // Baileys emits the first QR asynchronously. Wait briefly so the
      // connect response can carry the QR directly to the VendaAI UI.
      await waitForConnectionResult(state);
      return json(res, 200, publicState(state));
    }
    if (req.method === "GET" && action === "status") {
      const state = instances.get(id) || await connectInstance(id);
      return json(res, 200, publicState(state));
    }
    if (req.method === "POST" && action === "messages") {
      const input = await body(req);
      const to = String(input.to || "").replace(/\D/g, "");
      const text = String(input.text || "").trim();
      const state = instances.get(id) || await connectInstance(id);
      if (state.status !== "CONNECTED" || !state.socket) return json(res, 409, { error: "WhatsApp não está conectado." });
      if (!to || !text) return json(res, 400, { error: "to e text são obrigatórios." });
      const result = await state.socket.sendMessage(`${to}@s.whatsapp.net`, { text });
      return json(res, 200, { messages: [{ id: result?.key?.id || null }] });
    }
    if (req.method === "POST" && action === "disconnect") {
      const state = instances.get(id);
      if (state?.socket) await state.socket.logout();
      state && (state.status = "DISCONNECTED");
      return json(res, 200, { disconnected: true });
    }
    return json(res, 405, { error: "Method not allowed" });
  } catch (error) {
    logger.error({ error }, "Gateway request failed");
    return json(res, 500, { error: error instanceof Error ? error.message : "Internal error" });
  }
});

server.listen(PORT, "0.0.0.0", () => logger.info({ port: PORT }, "VendaAI WhatsApp gateway listening"));
