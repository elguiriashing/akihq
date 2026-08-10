/**
 * AkiHQ optional integration gateway for Cloudflare Workers.
 *
 * Secrets stay here rather than in the browser. The gateway implements an
 * encrypted social credential vault, Facebook/Instagram/TikTok OAuth and
 * metrics sync, plus a small, auditable set of provider actions and a generic webhook event sink.
 */

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const MAX_BODY_BYTES = 1024 * 1024;
const SOCIAL_PROVIDERS = new Set(["meta", "instagram", "tiktok"]);
const SOCIAL_ACCOUNT_PREFIX = "social:account:";

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

      if (request.method === "GET" && url.pathname.startsWith("/api/social/oauth/callback/")) {
        return await handleSocialOAuthCallback(request, env, url);
      }

      if (url.pathname.startsWith("/api/webhooks/") && request.method === "POST") {
        return await receiveWebhook(request, env, url, cors);
      }

      if (url.pathname.startsWith("/api/social/")) {
        const staff = await authenticateStaff(request, env);
        if (request.method === "GET" && url.pathname === "/api/social/overview") {
          return await socialOverview(env, url, cors);
        }
        if (request.method === "POST" && url.pathname === "/api/social/credentials") {
          requireAdministrator(staff);
          return await saveSocialCredentials(request, env, staff, cors);
        }
        if (request.method === "POST" && url.pathname === "/api/social/oauth/start") {
          requireAdministrator(staff);
          return await startSocialOAuth(request, env, staff, url, cors);
        }
        if (request.method === "POST" && url.pathname === "/api/social/sync") {
          return await syncSocialAccounts(request, env, cors);
        }
        if (request.method === "POST" && url.pathname === "/api/social/accounts/disconnect") {
          requireAdministrator(staff);
          return await disconnectSocialAccount(request, env, cors);
        }
        return json({ ok: false, error: "not_found" }, 404, cors);
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
  },
  async scheduled(_controller, env, ctx) {
    const request = new Request("https://internal.akihq/api/social/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}"
    });
    ctx.waitUntil(syncSocialAccounts(request, env, {}));
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
    headers: { ...JSON_HEADERS, "cache-control": "no-store", ...extraHeaders }
  });
}

async function authenticateStaff(request, env) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "unauthorized", "Sign in to AkiHQ first.");
  const supabaseUrl = requireEnv(env, "SUPABASE_URL").replace(/\/$/, "");
  const publishableKey = requireEnv(env, "SUPABASE_PUBLISHABLE_KEY");
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: publishableKey, authorization: `Bearer ${token}` }
  });
  if (!userResponse.ok) throw new HttpError(401, "unauthorized", "Your AkiHQ session is invalid or expired.");
  const user = await userResponse.json();
  if (!user?.id) throw new HttpError(401, "unauthorized", "No authenticated user was returned.");

  const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "");
  const databaseKey = serviceKey || publishableKey;
  const databaseToken = serviceKey || token;
  const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=app_role&limit=1`, {
    headers: { apikey: databaseKey, authorization: `Bearer ${databaseToken}` }
  });
  if (!profileResponse.ok) throw new HttpError(403, "role_check_failed", "Your staff role could not be verified.");
  const profiles = await profileResponse.json();
  const role = profiles?.[0]?.app_role;
  if (!new Set(["moderator", "administrator"]).has(role)) throw new HttpError(403, "forbidden", "Staff access is required.");
  return { id: user.id, email: user.email || "", role };
}

function requireAdministrator(staff) {
  if (staff?.role !== "administrator") throw new HttpError(403, "administrator_required", "Only an administrator can change social credentials or connections.");
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

function providerErrorDetail(data, status) {
  const candidates = [
    data?.error_message,
    data?.error_description,
    data?.message,
    data?.error?.message,
    typeof data?.error === "string" ? data.error : "",
    data?.raw
  ];
  const message = candidates.find(value => typeof value === "string" && value.trim())?.trim() || `Provider request failed (${status}).`;
  const codes = [data?.error_type, data?.error?.type, data?.error?.code, data?.code]
    .map(value => String(value ?? "").trim())
    .filter(Boolean);
  const code = [...new Set(codes)].join(" / ");
  return code ? `${message} [${code}]` : message;
}

async function providerFetch(url, options, context = "Provider request") {
  const response = await fetch(url, options);
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 1000) }; }
  if (!response.ok) {
    const detail = providerErrorDetail(data, response.status);
    console.error(JSON.stringify({ event: "social_provider_error", context, host: new URL(url).hostname, status: response.status, code: data?.error?.code || data?.code || "", type: data?.error_type || data?.error?.type || "", detail }));
    throw new HttpError(response.status >= 500 ? 502 : 400, "provider_error", `${context}: ${detail}`);
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

function requireSocialStore(env) {
  if (!env.SOCIAL_STORE) throw new HttpError(503, "social_store_not_configured", "The encrypted social account store is not configured.");
  return env.SOCIAL_STORE;
}

function cleanText(value, maxLength, field) {
  const text = String(value || "").trim();
  if (!text) throw new HttpError(400, "missing_field", `${field} is required.`);
  if (text.length > maxLength) throw new HttpError(400, "invalid_field", `${field} is too long.`);
  return text;
}

function socialCredentialKey(provider) {
  return `social:credentials:${provider}`;
}

function socialProviderName(provider) {
  if (provider === "meta") return "Facebook";
  if (provider === "instagram") return "Instagram";
  return "TikTok";
}

function maskIdentifier(value) {
  const text = String(value || "");
  return text.length <= 4 ? "Configured" : `••••${text.slice(-4)}`;
}

async function saveSocialCredentials(request, env, staff, cors) {
  const store = requireSocialStore(env);
  const body = await readJson(request);
  const provider = cleanText(body.provider, 30, "provider").toLowerCase();
  if (!SOCIAL_PROVIDERS.has(provider)) throw new HttpError(400, "invalid_provider", "provider must be meta, instagram or tiktok.");
  const clientId = cleanText(body.client_id, 300, "client_id");
  const clientSecret = cleanText(body.client_secret, 2000, "client_secret");
  const scopes = cleanText(body.scopes, 800, "scopes");
  const apiVersion = provider !== "tiktok" ? cleanText(body.api_version || "v25.0", 20, "api_version") : "";
  if (provider !== "tiktok" && !/^v\d+\.\d+$/.test(apiVersion)) throw new HttpError(400, "invalid_api_version", "Graph API version must look like v25.0.");
  const updatedAt = new Date().toISOString();
  const encrypted = await encryptSocialValue(env, { provider, clientId, clientSecret, scopes, apiVersion, updatedAt, updatedBy: staff.id });
  await store.put(socialCredentialKey(provider), encrypted, { metadata: { updatedAt, updatedBy: staff.id, clientIdHint: maskIdentifier(clientId) } });
  return json({ ok: true, provider, configured: true, updated_at: updatedAt, client_id_hint: maskIdentifier(clientId) }, 200, cors);
}

async function getSocialCredentials(env, provider) {
  const store = requireSocialStore(env);
  const encrypted = await store.get(socialCredentialKey(provider));
  if (!encrypted) throw new HttpError(409, "credentials_required", `${socialProviderName(provider)} app credentials must be added first.`);
  return decryptSocialValue(env, encrypted);
}

async function socialCredentialStatus(env, provider) {
  const store = requireSocialStore(env);
  const result = await store.getWithMetadata(socialCredentialKey(provider), { type: "text" });
  return {
    configured: Boolean(result.value),
    updatedAt: result.metadata?.updatedAt || null,
    clientIdHint: result.metadata?.clientIdHint || ""
  };
}

async function listSocialAccounts(env) {
  const store = requireSocialStore(env);
  const accounts = [];
  let cursor;
  do {
    const page = await store.list({ prefix: SOCIAL_ACCOUNT_PREFIX, cursor, limit: 1000 });
    for (const key of page.keys) {
      const encrypted = await store.get(key.name);
      if (!encrypted) continue;
      try { accounts.push(await decryptSocialValue(env, encrypted)); } catch (error) { console.error("Could not decrypt social account", key.name, error); }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return accounts;
}

async function saveSocialAccount(env, incoming) {
  const store = requireSocialStore(env);
  const accounts = await listSocialAccounts(env);
  const existing = accounts.find(account => account.provider === incoming.provider && account.businessId === incoming.businessId && account.externalAccountId === incoming.externalAccountId);
  const now = new Date().toISOString();
  const account = {
    ...existing,
    ...incoming,
    id: existing?.id || crypto.randomUUID(),
    history: Array.isArray(existing?.history) ? existing.history : [],
    connectedAt: existing?.connectedAt || now,
    updatedAt: now,
    status: incoming.status || "healthy",
    lastError: incoming.lastError || ""
  };
  await store.put(`${SOCIAL_ACCOUNT_PREFIX}${account.id}`, await encryptSocialValue(env, account));
  return account;
}

function publicSocialAccount(account, rangeDays) {
  const cutoff = Date.now() - rangeDays * 86400000;
  const history = (account.history || []).filter(point => new Date(point.date).getTime() >= cutoff);
  return {
    id: account.id,
    provider: account.provider,
    businessId: account.businessId,
    businessName: account.businessName,
    externalAccountId: account.externalAccountId,
    username: account.username || "",
    displayName: account.displayName || "",
    avatarUrl: account.avatarUrl || "",
    connectedAt: account.connectedAt,
    lastSyncedAt: account.lastSyncedAt || null,
    expiresAt: account.expiresAt || null,
    status: account.status || "healthy",
    metrics: account.metrics || {},
    content: Array.isArray(account.content) ? account.content : [],
    history
  };
}

async function socialOverview(env, url, cors) {
  const rangeDays = Math.min(180, Math.max(7, Number(url.searchParams.get("range") || 30)));
  const businessId = String(url.searchParams.get("business_id") || "");
  const accounts = (await listSocialAccounts(env)).filter(account => !businessId || account.businessId === businessId).map(account => publicSocialAccount(account, rangeDays));
  const followers = accounts.reduce((sum, account) => sum + Number(account.metrics?.followers || 0), 0);
  const views = accounts.reduce((sum, account) => sum + Number(account.metrics?.views || 0), 0);
  const engagements = accounts.reduce((sum, account) => sum + Number(account.metrics?.engagements || 0), 0);
  const earliestFollowers = accounts.reduce((sum, account) => sum + Number(account.history?.[0]?.followers || account.metrics?.followers || 0), 0);
  const hasComparison = accounts.some(account => (account.history || []).length > 1);
  const trendMap = new Map();
  for (const account of accounts) {
    for (const point of account.history || []) {
      const current = trendMap.get(point.date) || { date: point.date, followers: 0, views: 0, engagements: 0 };
      current.followers += Number(point.followers || 0);
      current.views += Number(point.views || 0);
      current.engagements += Number(point.engagements || 0);
      trendMap.set(point.date, current);
    }
  }
  const [meta, instagram, tiktok] = await Promise.all([socialCredentialStatus(env, "meta"), socialCredentialStatus(env, "instagram"), socialCredentialStatus(env, "tiktok")]);
  return json({
    ok: true,
    credentials: { meta, instagram, tiktok },
    summary: { connectedAccounts: accounts.length, followers, followerChange: hasComparison ? followers - earliestFollowers : null, views, engagements },
    accounts,
    trend: [...trendMap.values()].sort((a, b) => a.date.localeCompare(b.date))
  }, 200, cors);
}

async function encryptSocialValue(env, value) {
  const key = await socialEncryptionKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return JSON.stringify({ v: 1, iv: bytesToBase64(iv), data: bytesToBase64(new Uint8Array(ciphertext)) });
}

async function decryptSocialValue(env, value) {
  const envelope = JSON.parse(value);
  if (envelope?.v !== 1 || !envelope.iv || !envelope.data) throw new Error("Unsupported encrypted value.");
  const key = await socialEncryptionKey(env);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(envelope.iv) }, key, base64ToBytes(envelope.data));
  return JSON.parse(new TextDecoder().decode(plaintext));
}

async function socialEncryptionKey(env) {
  const raw = requireEnv(env, "SOCIAL_ENCRYPTION_KEY");
  const keyBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function randomState() {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(32))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function isAllowedRequestOrigin(origin, env) {
  if (!origin) return false;
  const configured = String(env.ALLOWED_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean);
  return configured.includes("*") || configured.includes(origin);
}

async function startSocialOAuth(request, env, staff, workerUrl, cors) {
  const body = await readJson(request);
  const provider = cleanText(body.provider, 30, "provider").toLowerCase();
  if (!SOCIAL_PROVIDERS.has(provider)) throw new HttpError(400, "invalid_provider", "provider must be meta, instagram or tiktok.");
  const businessId = cleanText(body.business_id, 200, "business_id");
  const businessName = cleanText(body.business_name, 300, "business_name");
  const credentials = await getSocialCredentials(env, provider);
  const state = randomState();
  const requestOrigin = request.headers.get("origin") || "";
  const returnUrl = isAllowedRequestOrigin(requestOrigin, env) ? `${requestOrigin}/#/crm/social` : requireEnv(env, "SOCIAL_RETURN_URL");
  const redirectUri = `${workerUrl.origin}/api/social/oauth/callback/${provider}`;
  const session = { provider, businessId, businessName, staffId: staff.id, returnUrl, redirectUri, createdAt: new Date().toISOString() };
  await requireSocialStore(env).put(`social:oauth:${state}`, await encryptSocialValue(env, session), { expirationTtl: 600 });

  let authorizationUrl;
  if (provider === "meta") {
    const graphVersion = credentials.apiVersion || "v25.0";
    const params = new URLSearchParams({ client_id: credentials.clientId, redirect_uri: redirectUri, state, response_type: "code", scope: credentials.scopes });
    authorizationUrl = `https://www.facebook.com/${encodeURIComponent(graphVersion)}/dialog/oauth?${params}`;
  } else if (provider === "instagram") {
    const params = new URLSearchParams({ client_id: credentials.clientId, redirect_uri: redirectUri, state, response_type: "code", scope: credentials.scopes });
    authorizationUrl = `https://www.instagram.com/oauth/authorize?${params}`;
  } else {
    const params = new URLSearchParams({ client_key: credentials.clientId, redirect_uri: redirectUri, state, response_type: "code", scope: credentials.scopes });
    authorizationUrl = `https://www.tiktok.com/v2/auth/authorize/?${params}`;
  }
  return json({ ok: true, authorization_url: authorizationUrl, callback_url: redirectUri }, 200, cors);
}

function socialResultUrl(returnUrl, result, errorMessage = "") {
  const target = new URL(returnUrl);
  target.searchParams.set("social", result);
  if (errorMessage) target.searchParams.set("social_error", String(errorMessage).replace(/[\r\n]+/g, " ").slice(0, 240));
  target.hash = "/crm/social";
  return target.toString();
}

async function handleSocialOAuthCallback(request, env, url) {
  const provider = decodeURIComponent(url.pathname.slice("/api/social/oauth/callback/".length)).toLowerCase();
  if (!SOCIAL_PROVIDERS.has(provider)) return json({ ok: false, error: "invalid_provider" }, 400);
  const state = String(url.searchParams.get("state") || "");
  if (!state) return json({ ok: false, error: "missing_state" }, 400);
  const store = requireSocialStore(env);
  const encryptedSession = await store.get(`social:oauth:${state}`);
  if (!encryptedSession) return json({ ok: false, error: "invalid_or_expired_state", message: "The connection request expired. Return to AkiHQ and try again." }, 400);
  await store.delete(`social:oauth:${state}`);
  const session = await decryptSocialValue(env, encryptedSession);
  if (session.provider !== provider) return json({ ok: false, error: "provider_mismatch" }, 400);
  try {
    if (url.searchParams.get("error")) throw new Error(url.searchParams.get("error_description") || "The provider denied the connection request.");
    const code = cleanText(url.searchParams.get("code"), 3000, "code");
    const credentials = await getSocialCredentials(env, provider);
    if (provider === "meta") await exchangeMetaAuthorization(code, credentials, session, env);
    else if (provider === "instagram") await exchangeInstagramAuthorization(code, credentials, session, env);
    else await exchangeTikTokAuthorization(code, credentials, session, env);
    return Response.redirect(socialResultUrl(session.returnUrl, "connected"), 303);
  } catch (error) {
    console.error("Social OAuth callback failed", provider, error);
    const message = error instanceof Error ? error.message : "The provider rejected the connection request.";
    return Response.redirect(socialResultUrl(session.returnUrl, "connection_failed", message), 303);
  }
}

async function safeProviderFetch(url, options) {
  try { return await providerFetch(url, options); } catch (error) { console.warn("Optional provider request failed", error.message); return null; }
}

async function exchangeMetaAuthorization(code, credentials, session, env) {
  const version = credentials.apiVersion || "v25.0";
  const graphRoot = `https://graph.facebook.com/${encodeURIComponent(version)}`;
  const tokenParams = new URLSearchParams({ client_id: credentials.clientId, client_secret: credentials.clientSecret, redirect_uri: session.redirectUri, code });
  const shortToken = await providerFetch(`${graphRoot}/oauth/access_token?${tokenParams}`, { method: "GET" });
  if (!shortToken.access_token) throw new HttpError(400, "meta_token_missing", "Meta did not return an access token.");
  const longParams = new URLSearchParams({ grant_type: "fb_exchange_token", client_id: credentials.clientId, client_secret: credentials.clientSecret, fb_exchange_token: shortToken.access_token });
  const longToken = await safeProviderFetch(`${graphRoot}/oauth/access_token?${longParams}`, { method: "GET" });
  const userToken = longToken?.access_token || shortToken.access_token;
  const expiresIn = Number(longToken?.expires_in || shortToken.expires_in || 0);
  const pageParams = new URLSearchParams({ fields: "id,name,access_token", access_token: userToken });
  const pageResponse = await providerFetch(`${graphRoot}/me/accounts?${pageParams}`, { method: "GET" });
  const pages = Array.isArray(pageResponse.data) ? pageResponse.data : [];
  if (!pages.length) throw new HttpError(409, "no_meta_pages", "No Facebook Pages were returned. Confirm Page access and approved scopes in Meta.");
  for (const page of pages) {
    const pageToken = page.access_token || userToken;
    const detailParams = new URLSearchParams({ fields: "id,name,fan_count,followers_count,picture,instagram_business_account", access_token: pageToken });
    const detail = await safeProviderFetch(`${graphRoot}/${encodeURIComponent(page.id)}?${detailParams}`, { method: "GET" }) || page;
    await saveSocialAccount(env, {
      provider: "facebook",
      authProvider: "meta",
      businessId: session.businessId,
      businessName: session.businessName,
      externalAccountId: String(page.id),
      displayName: detail.name || page.name || "Facebook Page",
      username: "",
      avatarUrl: detail.picture?.data?.url || "",
      accessToken: pageToken,
      expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
      metrics: { followers: Number(detail.followers_count || detail.fan_count || 0), views: 0, engagements: 0 },
      content: [],
      status: "healthy"
    });
    const instagramId = detail.instagram_business_account?.id;
    if (instagramId) {
      const igParams = new URLSearchParams({ fields: "id,username,name,profile_picture_url,followers_count,media_count", access_token: pageToken });
      const instagram = await safeProviderFetch(`${graphRoot}/${encodeURIComponent(instagramId)}?${igParams}`, { method: "GET" });
      if (instagram) await saveSocialAccount(env, {
        provider: "instagram",
        authProvider: "meta",
        businessId: session.businessId,
        businessName: session.businessName,
        externalAccountId: String(instagramId),
        displayName: instagram.name || instagram.username || "Instagram",
        username: instagram.username || "",
        avatarUrl: instagram.profile_picture_url || "",
        accessToken: pageToken,
        expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
        metrics: { followers: Number(instagram.followers_count || 0), views: 0, engagements: 0, contentCount: Number(instagram.media_count || 0) },
        content: [],
        status: "healthy"
      });
    }
  }
}

async function exchangeInstagramAuthorization(code, credentials, session, env) {
  const form = new FormData();
  form.append("client_id", credentials.clientId);
  form.append("client_secret", credentials.clientSecret);
  form.append("grant_type", "authorization_code");
  form.append("redirect_uri", session.redirectUri);
  form.append("code", code);
  const shortToken = await providerFetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body: form
  }, "Instagram token exchange");
  if (!shortToken.access_token) throw new HttpError(400, "instagram_token_missing", "Instagram did not return an access token.");
  const longParams = new URLSearchParams({ grant_type: "ig_exchange_token", client_secret: credentials.clientSecret, access_token: shortToken.access_token });
  const longToken = await providerFetch(`https://graph.instagram.com/access_token?${longParams}`, { method: "GET" }, "Instagram long-lived token exchange");
  if (!longToken.access_token) throw new HttpError(400, "instagram_long_token_missing", "Instagram did not return a long-lived access token.");
  const accessToken = longToken.access_token;
  const version = credentials.apiVersion || "v25.0";
  const profileParams = new URLSearchParams({ fields: "id,user_id,username,name,profile_picture_url,followers_count,media_count", access_token: accessToken });
  const profile = await providerFetch(`https://graph.instagram.com/${encodeURIComponent(version)}/me?${profileParams}`, { method: "GET" }, "Instagram account lookup");
  const externalAccountId = String(profile.id || profile.user_id || shortToken.user_id || "");
  if (!externalAccountId) throw new HttpError(400, "instagram_account_missing", "Instagram did not return the professional account ID.");
  const expiresIn = Number(longToken.expires_in || 0);
  await saveSocialAccount(env, {
    provider: "instagram",
    authProvider: "instagram",
    businessId: session.businessId,
    businessName: session.businessName,
    externalAccountId,
    displayName: profile.name || profile.username || "Instagram",
    username: profile.username || "",
    avatarUrl: profile.profile_picture_url || "",
    accessToken,
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
    metrics: { followers: Number(profile.followers_count || 0), views: 0, engagements: 0, contentCount: Number(profile.media_count || 0) },
    content: [],
    status: "healthy"
  });
}

async function exchangeTikTokAuthorization(code, credentials, session, env) {
  const form = new URLSearchParams({ client_key: credentials.clientId, client_secret: credentials.clientSecret, code, grant_type: "authorization_code", redirect_uri: session.redirectUri });
  const token = await providerFetch("https://open.tiktokapis.com/v2/oauth/token/", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form.toString() });
  if (!token.access_token || !token.open_id) throw new HttpError(400, "tiktok_token_missing", "TikTok did not return the required access token and account ID.");
  const fields = "open_id,union_id,avatar_url,display_name,profile_deep_link,is_verified,follower_count,following_count,likes_count,video_count";
  const userResponse = await providerFetch(`https://open.tiktokapis.com/v2/user/info/?fields=${encodeURIComponent(fields)}`, { headers: { authorization: `Bearer ${token.access_token}` } });
  if (userResponse.error && userResponse.error.code && userResponse.error.code !== "ok") throw new HttpError(400, "tiktok_user_error", userResponse.error.message || "TikTok user lookup failed.");
  const user = userResponse.data?.user || {};
  await saveSocialAccount(env, {
    provider: "tiktok",
    authProvider: "tiktok",
    businessId: session.businessId,
    businessName: session.businessName,
    externalAccountId: String(token.open_id),
    displayName: user.display_name || "TikTok account",
    username: "",
    avatarUrl: user.avatar_url || "",
    profileUrl: user.profile_deep_link || "",
    accessToken: token.access_token,
    refreshToken: token.refresh_token || "",
    expiresAt: token.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString() : null,
    refreshExpiresAt: token.refresh_expires_in ? new Date(Date.now() + Number(token.refresh_expires_in) * 1000).toISOString() : null,
    metrics: { followers: Number(user.follower_count || 0), views: 0, engagements: Number(user.likes_count || 0), contentCount: Number(user.video_count || 0), following: Number(user.following_count || 0) },
    content: [],
    status: "healthy"
  });
}

function recordSocialSnapshot(account) {
  const date = new Date().toISOString().slice(0, 10);
  const point = { date, followers: Number(account.metrics?.followers || 0), views: Number(account.metrics?.views || 0), engagements: Number(account.metrics?.engagements || 0) };
  const history = Array.isArray(account.history) ? account.history.filter(item => item.date !== date) : [];
  history.push(point);
  account.history = history.sort((a, b) => a.date.localeCompare(b.date)).slice(-180);
}

async function syncSocialAccounts(request, env, cors) {
  const body = await readJson(request);
  const businessId = String(body.business_id || "").trim();
  const accounts = (await listSocialAccounts(env)).filter(account => !businessId || account.businessId === businessId);
  let synced = 0;
  const errors = [];
  for (const account of accounts) {
    try {
      if (account.provider === "tiktok") await syncTikTokAccount(account, env);
      else if (account.provider === "instagram" && account.authProvider === "instagram") await syncInstagramAccount(account, env);
      else await syncMetaAccount(account, env);
      account.status = "healthy";
      account.lastError = "";
      account.lastSyncedAt = new Date().toISOString();
      recordSocialSnapshot(account);
      synced += 1;
    } catch (error) {
      console.error("Social account sync failed", account.id, error);
      account.status = "attention";
      account.lastError = safeError(error);
      errors.push({ account_id: account.id, provider: account.provider, message: safeError(error) });
    }
    account.updatedAt = new Date().toISOString();
    await requireSocialStore(env).put(`${SOCIAL_ACCOUNT_PREFIX}${account.id}`, await encryptSocialValue(env, account));
  }
  return json({ ok: errors.length === 0, synced, failed: errors.length, errors }, errors.length && !synced ? 502 : 200, cors);
}

function countNestedSummary(value) {
  return Number(value?.summary?.total_count || value?.count || 0);
}

async function syncMetaAccount(account, env) {
  const credentials = await getSocialCredentials(env, "meta");
  const root = `https://graph.facebook.com/${encodeURIComponent(credentials.apiVersion || "v25.0")}`;
  if (account.provider === "facebook") {
    const fields = "id,name,fan_count,followers_count,picture,posts.limit(12){id,message,created_time,permalink_url,full_picture,shares,comments.limit(0).summary(true),reactions.limit(0).summary(true)}";
    const params = new URLSearchParams({ fields, access_token: account.accessToken });
    const page = await providerFetch(`${root}/${encodeURIComponent(account.externalAccountId)}?${params}`, { method: "GET" });
    const posts = Array.isArray(page.posts?.data) ? page.posts.data : [];
    account.displayName = page.name || account.displayName;
    account.avatarUrl = page.picture?.data?.url || account.avatarUrl;
    account.content = posts.map(post => {
      const engagements = countNestedSummary(post.reactions) + countNestedSummary(post.comments) + Number(post.shares?.count || 0);
      return { id: String(post.id), title: String(post.message || "Facebook post").slice(0, 140), publishedAt: post.created_time, url: post.permalink_url || "", thumbnail: post.full_picture || "", views: null, engagements };
    });
    account.metrics = {
      followers: Number(page.followers_count || page.fan_count || 0),
      views: account.content.reduce((sum, item) => sum + Number(item.views || 0), 0),
      engagements: account.content.reduce((sum, item) => sum + Number(item.engagements || 0), 0),
      contentCount: account.content.length
    };
    return;
  }

  const fields = "id,username,name,profile_picture_url,followers_count,media_count,media.limit(12){id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count}";
  const params = new URLSearchParams({ fields, access_token: account.accessToken });
  const profile = await providerFetch(`${root}/${encodeURIComponent(account.externalAccountId)}?${params}`, { method: "GET" });
  const media = Array.isArray(profile.media?.data) ? profile.media.data : [];
  const content = [];
  for (const item of media) {
    const insightParams = new URLSearchParams({ metric: "views,reach,saved,shares,total_interactions", access_token: account.accessToken });
    const insightResponse = await safeProviderFetch(`${root}/${encodeURIComponent(item.id)}/insights?${insightParams}`, { method: "GET" });
    const metrics = {};
    for (const metric of insightResponse?.data || []) metrics[metric.name] = Number(metric.total_value?.value ?? metric.values?.[0]?.value ?? 0);
    content.push({
      id: String(item.id),
      title: String(item.caption || `${item.media_type || "Instagram"} post`).slice(0, 140),
      publishedAt: item.timestamp,
      url: item.permalink || "",
      thumbnail: item.thumbnail_url || item.media_url || "",
      views: Number(metrics.views || metrics.reach || 0),
      engagements: Number(metrics.total_interactions || 0) || Number(item.like_count || 0) + Number(item.comments_count || 0) + Number(metrics.saved || 0) + Number(metrics.shares || 0)
    });
  }
  account.displayName = profile.name || profile.username || account.displayName;
  account.username = profile.username || account.username;
  account.avatarUrl = profile.profile_picture_url || account.avatarUrl;
  account.content = content;
  account.metrics = {
    followers: Number(profile.followers_count || 0),
    views: content.reduce((sum, item) => sum + Number(item.views || 0), 0),
    engagements: content.reduce((sum, item) => sum + Number(item.engagements || 0), 0),
    contentCount: Number(profile.media_count || content.length)
  };
}

async function refreshInstagramToken(account) {
  const params = new URLSearchParams({ grant_type: "ig_refresh_token", access_token: account.accessToken });
  const token = await providerFetch(`https://graph.instagram.com/refresh_access_token?${params}`, { method: "GET" });
  if (!token.access_token) throw new HttpError(401, "instagram_refresh_failed", "Instagram did not return a refreshed access token.");
  account.accessToken = token.access_token;
  account.expiresAt = token.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString() : account.expiresAt;
}

async function syncInstagramAccount(account, env) {
  const credentials = await getSocialCredentials(env, "instagram");
  if (account.expiresAt && new Date(account.expiresAt).getTime() < Date.now() + 7 * 86400000) await refreshInstagramToken(account);
  const root = `https://graph.instagram.com/${encodeURIComponent(credentials.apiVersion || "v25.0")}`;
  const profileParams = new URLSearchParams({ fields: "id,user_id,username,name,profile_picture_url,followers_count,media_count", access_token: account.accessToken });
  const profile = await providerFetch(`${root}/me?${profileParams}`, { method: "GET" });
  const mediaParams = new URLSearchParams({ fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count", limit: "12", access_token: account.accessToken });
  const mediaResponse = await providerFetch(`${root}/me/media?${mediaParams}`, { method: "GET" });
  const media = Array.isArray(mediaResponse.data) ? mediaResponse.data : [];
  const content = [];
  for (const item of media) {
    const insightParams = new URLSearchParams({ metric: "views,reach,saved,shares,total_interactions", access_token: account.accessToken });
    const insightResponse = await safeProviderFetch(`${root}/${encodeURIComponent(item.id)}/insights?${insightParams}`, { method: "GET" });
    const metrics = {};
    for (const metric of insightResponse?.data || []) metrics[metric.name] = Number(metric.total_value?.value ?? metric.values?.[0]?.value ?? 0);
    content.push({
      id: String(item.id),
      title: String(item.caption || `${item.media_type || "Instagram"} post`).slice(0, 140),
      publishedAt: item.timestamp,
      url: item.permalink || "",
      thumbnail: item.thumbnail_url || item.media_url || "",
      views: Number(metrics.views || metrics.reach || 0),
      engagements: Number(metrics.total_interactions || 0) || Number(item.like_count || 0) + Number(item.comments_count || 0) + Number(metrics.saved || 0) + Number(metrics.shares || 0)
    });
  }
  account.externalAccountId = String(profile.id || profile.user_id || account.externalAccountId);
  account.displayName = profile.name || profile.username || account.displayName;
  account.username = profile.username || account.username;
  account.avatarUrl = profile.profile_picture_url || account.avatarUrl;
  account.content = content;
  account.metrics = {
    followers: Number(profile.followers_count || 0),
    views: content.reduce((sum, item) => sum + Number(item.views || 0), 0),
    engagements: content.reduce((sum, item) => sum + Number(item.engagements || 0), 0),
    contentCount: Number(profile.media_count || content.length)
  };
}

async function refreshTikTokToken(account, credentials) {
  if (!account.refreshToken) throw new HttpError(401, "tiktok_reconnect_required", "TikTok access expired and no refresh token is available.");
  const form = new URLSearchParams({ client_key: credentials.clientId, client_secret: credentials.clientSecret, grant_type: "refresh_token", refresh_token: account.refreshToken });
  const token = await providerFetch("https://open.tiktokapis.com/v2/oauth/token/", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form.toString() });
  if (!token.access_token) throw new HttpError(401, "tiktok_refresh_failed", "TikTok did not return a refreshed access token.");
  account.accessToken = token.access_token;
  account.refreshToken = token.refresh_token || account.refreshToken;
  account.expiresAt = token.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString() : account.expiresAt;
  account.refreshExpiresAt = token.refresh_expires_in ? new Date(Date.now() + Number(token.refresh_expires_in) * 1000).toISOString() : account.refreshExpiresAt;
}

async function syncTikTokAccount(account, env) {
  const credentials = await getSocialCredentials(env, "tiktok");
  if (account.expiresAt && new Date(account.expiresAt).getTime() < Date.now() + 300000) await refreshTikTokToken(account, credentials);
  const userFields = "open_id,union_id,avatar_url,display_name,profile_deep_link,is_verified,follower_count,following_count,likes_count,video_count";
  const userResponse = await providerFetch(`https://open.tiktokapis.com/v2/user/info/?fields=${encodeURIComponent(userFields)}`, { headers: { authorization: `Bearer ${account.accessToken}` } });
  if (userResponse.error && userResponse.error.code && userResponse.error.code !== "ok") throw new HttpError(400, "tiktok_user_error", userResponse.error.message || "TikTok user lookup failed.");
  const videoFields = "id,title,video_description,duration,cover_image_url,embed_link,share_url,create_time,like_count,comment_count,share_count,view_count";
  const videoResponse = await providerFetch(`https://open.tiktokapis.com/v2/video/list/?fields=${encodeURIComponent(videoFields)}`, { method: "POST", headers: { authorization: `Bearer ${account.accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ max_count: 20 }) });
  if (videoResponse.error && videoResponse.error.code && videoResponse.error.code !== "ok") throw new HttpError(400, "tiktok_video_error", videoResponse.error.message || "TikTok video lookup failed.");
  const user = userResponse.data?.user || {};
  const videos = Array.isArray(videoResponse.data?.videos) ? videoResponse.data.videos : [];
  account.displayName = user.display_name || account.displayName;
  account.avatarUrl = user.avatar_url || account.avatarUrl;
  account.profileUrl = user.profile_deep_link || account.profileUrl;
  account.content = videos.map(video => ({
    id: String(video.id),
    title: String(video.title || video.video_description || "TikTok video").slice(0, 140),
    publishedAt: video.create_time ? new Date(Number(video.create_time) * 1000).toISOString() : null,
    url: video.share_url || video.embed_link || "",
    thumbnail: video.cover_image_url || "",
    views: Number(video.view_count || 0),
    engagements: Number(video.like_count || 0) + Number(video.comment_count || 0) + Number(video.share_count || 0)
  }));
  account.metrics = {
    followers: Number(user.follower_count || 0),
    following: Number(user.following_count || 0),
    likes: Number(user.likes_count || 0),
    views: account.content.reduce((sum, item) => sum + Number(item.views || 0), 0),
    engagements: account.content.reduce((sum, item) => sum + Number(item.engagements || 0), 0),
    contentCount: Number(user.video_count || account.content.length)
  };
}

async function disconnectSocialAccount(request, env, cors) {
  const body = await readJson(request);
  const accountId = cleanText(body.account_id, 100, "account_id");
  const store = requireSocialStore(env);
  const key = `${SOCIAL_ACCOUNT_PREFIX}${accountId}`;
  const encrypted = await store.get(key);
  if (!encrypted) throw new HttpError(404, "account_not_found", "The social account was not found.");
  const account = await decryptSocialValue(env, encrypted);
  if (account.provider === "tiktok" && account.accessToken) {
    try {
      const credentials = await getSocialCredentials(env, "tiktok");
      const form = new URLSearchParams({ client_key: credentials.clientId, client_secret: credentials.clientSecret, token: account.accessToken });
      await safeProviderFetch("https://open.tiktokapis.com/v2/oauth/revoke/", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form.toString() });
    } catch (error) { console.warn("TikTok revoke skipped", error.message); }
  }
  await store.delete(key);
  return json({ ok: true, disconnected: true }, 200, cors);
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
      outbound_webhooks: Boolean(env.OUTBOUND_WEBHOOK_HOSTS),
      social_store: Boolean(env.SOCIAL_STORE && env.SOCIAL_ENCRYPTION_KEY),
      social_auth: Boolean(env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY)
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
