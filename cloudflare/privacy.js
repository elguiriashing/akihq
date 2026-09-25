import { z } from "zod";

// No browser-shared gateway token can authorize access to subject records or mail.
// All RPC mutations use a verified user ID plus a database membership check.
export class PrivacyError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const uuid = z.string().uuid();
const workspaceId = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const email = z.string().trim().toLowerCase().email().max(320);
const note = z.string().trim().min(10).max(4000);
const cleanHeader = z.string().trim().min(1).max(300).refine(value => !/[\r\n]/.test(value));
export const privacySettingsSchema = z.object({
  controller_name: z.string().trim().min(2).max(300), controller_address: z.string().trim().min(5).max(1000),
  privacy_email: email, policy_url: z.string().url().max(1000).refine(value => new URL(value).protocol === "https:"),
  retention_days: z.number().int().min(30).max(3650),
}).strict();
export const consentSchema = z.object({
  email, status: z.enum(["granted", "withdrawn"]), source: z.string().trim().min(3).max(1000),
  evidence: note, notice_version: z.string().trim().min(1).max(100), occurred_at: z.string().datetime({ offset: true }),
}).strict();
export const marketingSchema = z.object({
  request_id: uuid, email, sender: email, subject: cleanHeader, text: z.string().trim().min(1).max(50000),
}).strict();

function configuration(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.SUPABASE_PUBLISHABLE_KEY) throw new PrivacyError(503, "Privacy operations are not configured.");
  return { url: String(env.SUPABASE_URL).replace(/\/$/, ""), key: String(env.SUPABASE_SERVICE_ROLE_KEY) };
}
export async function privacyRpc(env, name, args, token) {
  const { url, key } = configuration(env);
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST", headers: { apikey: token ? env.SUPABASE_PUBLISHABLE_KEY : key, authorization: `Bearer ${token || key}`, "content-type": "application/json" },
    body: JSON.stringify(args), signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const failure = await response.json().catch(() => ({}));
    if (failure.code === "42501") throw new PrivacyError(403, "Permission, verified sender, or active marketing consent is missing, or this recipient is suppressed.");
    if (failure.code === "P0002") throw new PrivacyError(404, "The record or required controller settings were not found in this workspace.");
    if (["22023", "23514", "23502", "22P02"].includes(failure.code)) throw new PrivacyError(400, "Check the values, request state and idempotency key before trying again.");
    throw new PrivacyError(503, "Privacy storage is unavailable. No permission or suppression check was bypassed.");
  }
  const raw = await response.text();
  return raw ? JSON.parse(raw) : null;
}
export async function authenticatePrivacy(request, env) {
  const workspace = workspaceId.parse(request.headers.get("x-workspace-id"));
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new PrivacyError(401, "Sign in to AkiHQ first.");
  const { url } = configuration(env);
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new PrivacyError(401, "Your session expired. Sign in again.");
  const user = await response.json();
  if (!uuid.safeParse(user?.id).success) throw new PrivacyError(401, "Invalid session.");
  if (!await privacyRpc(env, "crm_privacy_access", { p_workspace: workspace }, token)) throw new PrivacyError(403, "An active owner or administrator membership in this workspace is required.");
  return { workspace, actor: user.id, token };
}
export async function boundedText(request, limit = 150000) {
  if (Number(request.headers.get("content-length")) > limit) throw new PrivacyError(413, "Request too large.");
  const reader = request.body?.getReader();
  if (!reader) return "";
  let length = 0; const chunks = [];
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    length += value.byteLength;
    if (length > limit) { await reader.cancel(); throw new PrivacyError(413, "Request too large."); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}
async function body(request) {
  try { return JSON.parse(await boundedText(request)); }
  catch (error) { if (error instanceof PrivacyError) throw error; throw new PrivacyError(400, "Valid JSON is required."); }
}
const responseJson = (data, status = 200) => Response.json(data, { status, headers: { "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export function marketingPayload(input, settings, unsubscribeUrl) {
  const footer = `${settings.controller_name}\n${settings.controller_address}\nPrivacy: ${settings.policy_url}\nContact: ${settings.privacy_email}\nUnsubscribe / Darme de baja: ${unsubscribeUrl}`;
  const text = `${input.text}\n\n—\n${footer}`;
  return { from: input.sender, to: [input.email], subject: input.subject, text,
    html: `<html lang="es"><head><title>${escapeHtml(input.subject)}</title></head><body><main><div style="white-space:pre-wrap">${escapeHtml(input.text)}</div><hr><p>${escapeHtml(settings.controller_name)}<br>${escapeHtml(settings.controller_address)}</p><p><a href="${escapeHtml(settings.policy_url)}">Privacy / Privacidad</a> · <a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe / Darme de baja</a></p><p>${escapeHtml(settings.privacy_email)}</p></main></body></html>`,
    headers: { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}
export async function sendMarketing(request, env, auth) {
  if (String(env.PRIVACY_MARKETING_ENABLED) !== "true" || !env.RESEND_API_KEY || !env.RESEND_WEBHOOK_SECRET) throw new PrivacyError(503, "Marketing delivery requires a configured sender, signed bounce/complaint webhook and administrator activation.");
  let base;
  try { base = new URL(env.PRIVACY_PUBLIC_ORIGIN); } catch { throw new PrivacyError(503, "Configure the public HTTPS unsubscribe origin first."); }
  if (base.protocol !== "https:" || base.username || base.password) throw new PrivacyError(503, "The unsubscribe origin must use HTTPS.");
  const input = marketingSchema.parse(await body(request));
  const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(input))))].map(v => v.toString(16).padStart(2, "0")).join("");
  const record = await privacyRpc(env, "crm_marketing_prepare", { p_workspace: auth.workspace, p_actor: auth.actor, p_request_id: input.request_id, p_email: input.email, p_sender: input.sender, p_subject: input.subject, p_digest: digest });
  if (record.duplicate) return responseJson({ ok: record.status === "sent", duplicate: true, id: record.id, status: record.status }, record.status === "sent" ? 200 : 409);
  const unsubscribe = new URL("/api/privacy/unsubscribe", base.origin); unsubscribe.searchParams.set("token", uuid.parse(record.token));
  let status = "uncertain", providerId = null;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json", "Idempotency-Key": `akihq-marketing-${record.id}` },
      body: JSON.stringify(marketingPayload(input, record.settings, unsubscribe.href)), signal: AbortSignal.timeout(20000),
    });
    if (response.ok) { const data = await response.json(); providerId = data.id; status = providerId ? "sent" : "uncertain"; }
    else status = response.status >= 500 ? "uncertain" : "failed";
  } catch { /* A timeout does not prove the provider failed. Never automatically resend. */ }
  await privacyRpc(env, "crm_marketing_finish", { p_id: record.id, p_status: status, p_provider_id: providerId });
  return responseJson({ ok: status === "sent", id: record.id, status, ...(status !== "sent" ? { message: "Delivery requires review. This request will not be sent again automatically." } : {}) }, status === "sent" ? 200 : 502);
}

export async function verifyResendWebhook(raw, headers, secret, now = Date.now()) {
  const id = headers.get("svix-id") || "", timestamp = headers.get("svix-timestamp") || "";
  if (!secret || !/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300 || !id || id.length > 300) return false;
  try {
    const bytes = Uint8Array.from(atob(String(secret).replace(/^whsec_/, "")), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey("raw", bytes, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const payload = new TextEncoder().encode(`${id}.${timestamp}.${raw}`);
    for (const part of (headers.get("svix-signature") || "").split(" ")) {
      if (!part.startsWith("v1,")) continue;
      const signature = Uint8Array.from(atob(part.slice(3)), c => c.charCodeAt(0));
      if (await crypto.subtle.verify("HMAC", key, signature, payload)) return true;
    }
  } catch { return false; }
  return false;
}
async function receiveDelivery(request, env) {
  const raw = await boundedText(request);
  if (!await verifyResendWebhook(raw, request.headers, env.RESEND_WEBHOOK_SECRET)) throw new PrivacyError(401, "Invalid delivery signature.");
  let event; try { event = JSON.parse(raw); } catch { throw new PrivacyError(400, "Invalid delivery event."); }
  if (["email.bounced", "email.complained"].includes(event.type)) {
    const providerId = z.string().min(1).max(300).parse(event.data?.email_id);
    await privacyRpc(env, "crm_marketing_delivery", { p_event_id: request.headers.get("svix-id"), p_kind: event.type, p_provider_id: providerId });
  }
  return responseJson({ ok: true });
}
async function unsubscribe(request, env) {
  const token = uuid.parse(new URL(request.url).searchParams.get("token"));
  if (request.method === "POST") {
    await privacyRpc(env, "crm_marketing_unsubscribe", { p_token: token });
    return new Response("Unsubscribed / Baja registrada.", { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" } });
  }
  // GET is deliberately side-effect free: security link scanners must not opt people out.
  return new Response(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Unsubscribe / Darme de baja</title><body><main><h1>Unsubscribe / Darme de baja</h1><p>Stop this business's promotional emails. / Dejar de recibir publicidad de esta empresa.</p><form method="post"><button>Unsubscribe / Darme de baja</button></form></main></body></html>`, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer", "content-security-policy": "default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'", "x-content-type-options": "nosniff" } });
}

export async function handlePrivacy(request, env) {
  try {
    const { pathname, searchParams } = new URL(request.url);
    if (pathname === "/api/privacy/unsubscribe" && ["GET", "POST"].includes(request.method)) return await unsubscribe(request, env);
    if (pathname === "/api/privacy/delivery" && request.method === "POST") return await receiveDelivery(request, env);
    const auth = await authenticatePrivacy(request, env);
    const args = { p_workspace: auth.workspace, p_actor: auth.actor };
    if (pathname === "/api/privacy/overview" && request.method === "GET") {
      const overview = await privacyRpc(env, "crm_privacy_overview", args);
      return responseJson({ ok: true, ...overview, marketing_configured: String(env.PRIVACY_MARKETING_ENABLED) === "true" && Boolean(env.RESEND_API_KEY && env.RESEND_WEBHOOK_SECRET && env.PRIVACY_PUBLIC_ORIGIN) });
    }
    if (pathname === "/api/privacy/settings" && request.method === "POST") return responseJson(await privacyRpc(env, "crm_privacy_settings_save", { ...args, p_settings: privacySettingsSchema.parse(await body(request)) }));
    if (pathname === "/api/privacy/consent" && request.method === "POST") return responseJson(await privacyRpc(env, "crm_privacy_consent_record", { ...args, p_consent: consentSchema.parse(await body(request)) }));
    if (pathname === "/api/privacy/requests" && request.method === "POST") {
      const input = z.object({ email, kind: z.enum(["access", "erasure", "rectification", "restriction", "objection", "portability"]), note: z.string().trim().max(4000).default(""), received_at: z.string().datetime({ offset: true }).optional() }).strict().parse(await body(request));
      return responseJson({ ok: true, request: await privacyRpc(env, "crm_privacy_request_create", { ...args, p_request: input }) }, 201);
    }
    if (pathname === "/api/privacy/request-action" && request.method === "POST") {
      const input = z.object({ id: uuid, action: z.enum(["verify", "extend", "complete", "reject"]), note }).strict().parse(await body(request));
      return responseJson({ ok: true, request: await privacyRpc(env, "crm_privacy_request_action", { ...args, p_id: input.id, p_action: input.action, p_note: input.note }) });
    }
    if (pathname === "/api/privacy/export" && request.method === "GET") {
      const id = uuid.parse(searchParams.get("id"));
      const data = await privacyRpc(env, "crm_privacy_subject_export", { ...args, p_id: id });
      return new Response(JSON.stringify(data, null, 2), { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="subject-data-${id}.json"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
    }
    if (pathname === "/api/privacy/marketing/send" && request.method === "POST") return await sendMarketing(request, env, auth);
    throw new PrivacyError(404, "Privacy endpoint not found.");
  } catch (error) {
    return responseJson({ ok: false, message: error instanceof z.ZodError ? "Check the privacy form values and selected workspace." : error instanceof PrivacyError ? error.message : "The privacy operation could not be completed." }, error instanceof z.ZodError ? 400 : error instanceof PrivacyError ? error.status : 500);
  }
}
