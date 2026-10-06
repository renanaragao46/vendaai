const GRAPH_VERSION = Deno.env.get("WHATSAPP_GRAPH_VERSION") ?? "v24.0";

export async function verifySignature(body: string, signature: string) {
  const secret = Deno.env.get("WHATSAPP_APP_SECRET") ?? "";
  if (!secret || !signature) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const raw = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const expected = "sha256=" + [...new Uint8Array(raw)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

export async function graph(path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${path.replace(/^\//, "")}`, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message ?? `Graph API error ${response.status}`);
  return payload;
}

export async function transcribe(mediaId: string, token: string) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada.");
  const media = await graph(mediaId, token);
  const audio = await fetch(media.url, { headers: { Authorization: `Bearer ${token}` } });
  if (!audio.ok) throw new Error("Não foi possível baixar o áudio.");
  const form = new FormData();
  form.append("file", await audio.blob(), "whatsapp-audio.ogg");
  form.append("model", "gpt-4o-mini-transcribe");
  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message ?? "Falha na transcrição.");
  return String(payload.text ?? "").trim();
}

export async function sendText(phoneNumberId: string, to: string, body: string, token: string) {
  return graph(`${phoneNumberId}/messages`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { preview_url: true, body } }),
  });
}
