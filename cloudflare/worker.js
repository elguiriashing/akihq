/**
 * AkiHQ optional integration gateway for Cloudflare Workers.
 *
 * Secrets stay here rather than in the browser. This starter intentionally
 * implements a small, auditable set of provider actions and a generic webhook
 * event sink. OAuth adapters still need provider-specific client apps.
 */

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const MAX_BODY_BYTES = 1024 * 1024;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      if (request.method === "GET" && url.pathname === "/api/health") {
        return json({ ok: true, service: "akihq-integration-gateway", time: new Date().toISOString() }, 200, cors);
      }

      if (url.pathname.startsWith("/api/webhooks/") && request.method === "POST") {
        return await receiveWebhook(request, env, url, cors);
      }

      const authFailure = await requireApiToken(request, env);
      if (authFailure) return withCors(authFailure, cors);

      if (request.method === "GET" && url.pathname === "/api/integrations/status") {
        return json(integrationStatus(env), 200, cors);
      }

      if (request.method === "POST" && url.pathname === "/api/resend/send") {
        return await sendResend(request, env, cors);
      }

      if (request.method === "POST" && url.pathname === "/api/notify/slack") {
        return await sendSlack(request, env, cors);
      }

      if (request.method === "POST" && url.pathname === "/api/notify/discord") {
        return await sendDiscord(request, env, cors);
      }

      if (request.method === "POST" && url.pathname === "/api/notify/telegram") {
        return await sendTelegram(request, env, cors);
      }

      if (request.method === "POST" && url.pathname === "/api/twilio/sms") {
        return await sendTwilioSms(request, env, cors);
      }

      if (request.method === "POST" && url.pathname === "/api/outbound/webhook") {
        return await sendAllowlistedWebhook(request, env, cors);
      }

      if (url.pathname.startsWith("/api/oauth/")) {
        return json({
          ok: false,
          error: "oauth_adapter_not_implemented",
          message: "Create the provider developer app and implement its OAuth exchange in this Worker before enabling it in production."
        }, 501, cors);
      }

      return json({ ok: false, error: "not_found" }, 404, cors);
    } catch (error) {
      console.error("AkiHQ Worker error", error);
      if (error instanceof HttpError) {
        return json({ ok: false, error: error.code, message: error.message }, error.status, cors);
      }
      return json({ ok: false, error: "internal_error", message: safeError(error) }, 500, cors);
    }
  }
};

function corsHeaders(request, env) {
  const origin = request.headers.get("origin") || "";
  const configured = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
  const allowedOrigin = configured.includes("*") ? "*" : configured.includes(origin) ? origin : "null";
  return {
    "access-control-allow-origin": allowedOrigin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "authorization,content-type,x-akihq-webhook-secret,x-request-id",
    "access-control-max-age": "86400",
    "vary": "Origin"
  };
}

function withCors(response, cors) {
  const headers = new Headers(response.headers);
  Object.entries(cors).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders }
  });
}

async function requireApiToken(request, env) {
  if (!env.AKIHQ_API_TOKEN) {
    return json({ ok: false, error: "gateway_not_configured", message: "AKIHQ_API_TOKEN is missing." }, 503);
  }
  const supplied = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!(await constantTimeEqual(supplied, String(env.AKIHQ_API_TOKEN)))) {
    return json({ ok: false, error: "unauthorized" }, 401, { "www-authenticate": "Bearer" });
  }
  return null;
}

async function constantTimeEqual(left, right) {
  const encoder = new TextEncoder();
  const a = encoder.encode(String(left));
  const b = encoder.encode(String(right));
  const length = Math.max(a.length, b.length, 1);
  let mismatch = a.length ^ b.length;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (a[index % Math.max(a.length, 1)] || 0) ^ (b[index % Math.max(b.length, 1)] || 0);
  }
  return mismatch === 0;
}

async function readJson(request) {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    throw new HttpError(413, "request_too_large", "The JSON body exceeds 1 MB.");
  }
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "invalid_json", "The request body must be valid JSON.");
  }
}

function requireEnv(env, name) {
  const value = env[name];
  if (!value) throw new HttpError(503, "provider_not_configured", `${name} is missing.`);
  return String(value);
}

function requireFields(body, fields) {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      throw new HttpError(400, "missing_field", `${field} is required.`);
    }
  }
}

async function providerFetch(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 1000) }; }
  if (!response.ok) {
    const message = data?.message || data?.error?.message || data?.error || `Provider request failed (${response.status}).`;
    throw new HttpError(response.status >= 500 ? 502 : 400, "provider_error", String(message));
  }
  return data;
}

async function sendResend(request, env, cors) {
  const apiKey = requireEnv(env, "RESEND_API_KEY");
  const body = await readJson(request);
  requireFields(body, ["from", "to", "subject"]);
  if (!body.html && !body.text) throw new HttpError(400, "missing_content", "html or text is required.");
  const payload = {
    from: body.from,
    to: Array.isArray(body.to) ? body.to : [body.to],
    subject: body.subject,
    ...(body.html ? { html: body.html } : {}),
    ...(body.text ? { text: body.text } : {}),
    ...(body.reply_to ? { reply_to: body.reply_to } : {}),
    ...(body.cc ? { cc: Array.isArray(body.cc) ? body.cc : [body.cc] } : {}),
    ...(body.bcc ? { bcc: Array.isArray(body.bcc) ? body.bcc : [body.bcc] } : {})
  };
  const data = await providerFetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  return json({ ok: true, provider: "resend", data }, 200, cors);
}

async function sendSlack(request, env, cors) {
  const webhookUrl = requireEnv(env, "SLACK_WEBHOOK_URL");
  const body = await readJson(request);
  requireFields(body, ["text"]);
  await providerFetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: body.text, ...(body.blocks ? { blocks: body.blocks } : {}) })
  });
  return json({ ok: true, provider: "slack" }, 200, cors);
}

async function sendDiscord(request, env, cors) {
  const webhookUrl = requireEnv(env, "DISCORD_WEBHOOK_URL");
  const body = await readJson(request);
  requireFields(body, ["content"]);
  const data = await providerFetch(`${webhookUrl}${webhookUrl.includes("?") ? "&" : "?"}wait=true`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content: body.content, ...(body.username ? { username: body.username } : {}), ...(body.embeds ? { embeds: body.embeds } : {}) })
  });
  return json({ ok: true, provider: "discord", data }, 200, cors);
}

async function sendTelegram(request, env, cors) {
  const token = requireEnv(env, "TELEGRAM_BOT_TOKEN");
  const body = await readJson(request);
  const chatId = body.chat_id || requireEnv(env, "TELEGRAM_CHAT_ID");
  requireFields(body, ["text"]);
  const data = await providerFetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: body.text, parse_mode: body.parse_mode || undefined, disable_web_page_preview: Boolean(body.disable_web_page_preview) })
  });
  return json({ ok: true, provider: "telegram", data }, 200, cors);
}

async function sendTwilioSms(request, env, cors) {
  const accountSid = requireEnv(env, "TWILIO_ACCOUNT_SID");
  const authToken = requireEnv(env, "TWILIO_AUTH_TOKEN");
  const defaultFrom = requireEnv(env, "TWILIO_FROM_NUMBER");
  const body = await readJson(request);
  requireFields(body, ["to", "body"]);
  const form = new URLSearchParams({ To: body.to, From: body.from || defaultFrom, Body: body.body });
  const data = await providerFetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`, {
    method: "POST",
    headers: {
      authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      "content-type": "application/x-www-form-urlencoded"
    },
    body: form.toString()
  });
  return json({ ok: true, provider: "twilio", data: { sid: data.sid, status: data.status, to: data.to } }, 200, cors);
}

async function sendAllowlistedWebhook(request, env, cors) {
  const body = await readJson(request);
  requireFields(body, ["url", "event"]);
  let endpoint;
  try { endpoint = new URL(body.url); } catch { throw new HttpError(400, "invalid_url", "url must be an absolute HTTPS URL."); }
  if (endpoint.protocol !== "https:") throw new HttpError(400, "invalid_url", "Only HTTPS webhook destinations are allowed.");

  const allowlist = String(env.OUTBOUND_WEBHOOK_HOSTS || "")
    .split(",")
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
  if (!allowlist.includes(endpoint.hostname.toLowerCase())) {
    throw new HttpError(403, "host_not_allowed", "Add this exact hostname to OUTBOUND_WEBHOOK_HOSTS first.");
  }

  const event = {
    id: crypto.randomUUID(),
    type: body.event,
    workspace_id: body.workspace_id || "workspace_main",
    created_at: new Date().toISOString(),
    data: body.payload || {}
  };
  const raw = JSON.stringify(event);
  const signature = env.OUTBOUND_WEBHOOK_SECRET ? await hmacHex(String(env.OUTBOUND_WEBHOOK_SECRET), raw) : null;
  const response = await fetch(endpoint.toString(), {
    method: "POST",
    redirect: "error",
    headers: {
      "content-type": "application/json",
      "user-agent": "AkiHQ-Webhook/0.1",
      ...(signature ? { "x-akihq-signature": `sha256=${signature}` } : {})
    },
    body: raw
  });
  if (!response.ok) throw new HttpError(502, "webhook_failed", `Destination returned ${response.status}.`);
  return json({ ok: true, event_id: event.id, destination: endpoint.hostname }, 200, cors);
}

async function receiveWebhook(request, env, url, cors) {
  const provider = decodeURIComponent(url.pathname.slice("/api/webhooks/".length)).trim().toLowerCase();
  if (!provider || !/^[a-z0-9][a-z0-9_-]{0,50}$/.test(provider)) {
    return json({ ok: false, error: "invalid_provider" }, 400, cors);
  }

  const configuredSecret = String(env.WEBHOOK_INGEST_SECRET || "");
  const suppliedSecret = request.headers.get("x-akihq-webhook-secret") || "";
  const signatureVerified = configuredSecret ? await constantTimeEqual(suppliedSecret, configuredSecret) : false;
  if (configuredSecret && !signatureVerified) return json({ ok: false, error: "invalid_webhook_secret" }, 401, cors);

  const payload = await readJson(request);
  const eventType = String(payload.type || payload.event || payload.action || "unknown").slice(0, 180);
  const externalEventId = payload.id || payload.event_id || payload.data?.id || null;
  const requestMeta = {
    request_id: request.headers.get("x-request-id") || crypto.randomUUID(),
    user_agent: (request.headers.get("user-agent") || "").slice(0, 300),
    content_type: request.headers.get("content-type") || "",
    cf_country: request.cf?.country || null
  };

  await storeIntegrationEvent(env, {
    workspace_id: payload.workspace_id || "workspace_main",
    provider,
    event_type: eventType,
    external_event_id: externalEventId ? String(externalEventId).slice(0, 250) : null,
    payload,
    request_meta: requestMeta,
    signature_verified: signatureVerified
  });

  return json({ ok: true, accepted: true }, 202, cors);
}

async function storeIntegrationEvent(env, event) {
  const supabaseUrl = requireEnv(env, "SUPABASE_URL").replace(/\/$/, "");
  const serviceRole = requireEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${supabaseUrl}/rest/v1/integration_events`, {
    method: "POST",
    headers: {
      apikey: serviceRole,
      authorization: `Bearer ${serviceRole}`,
      "content-type": "application/json",
      prefer: "return=minimal,resolution=ignore-duplicates"
    },
    body: JSON.stringify(event)
  });
  if (!response.ok && response.status !== 409) {
    const detail = (await response.text()).slice(0, 600);
    throw new HttpError(502, "event_storage_failed", detail || `Supabase returned ${response.status}.`);
  }
}

async function hmacHex(secret, value) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return [...new Uint8Array(signature)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function integrationStatus(env) {
  return {
    ok: true,
    providers: {
      resend: Boolean(env.RESEND_API_KEY),
      slack: Boolean(env.SLACK_WEBHOOK_URL),
      discord: Boolean(env.DISCORD_WEBHOOK_URL),
      telegram: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID),
      twilio: Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER),
      supabase_event_sink: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
      outbound_webhooks: Boolean(env.OUTBOUND_WEBHOOK_HOSTS)
    }
  };
}

function safeError(error) {
  if (error instanceof HttpError) return error.message;
  return "Unexpected gateway failure.";
}

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
