import assert from "node:assert/strict";
import { test } from "node:test";
import { handlePrivacy, verifyResendWebhook, marketingPayload, marketingSchema, consentSchema, boundedText } from "./privacy.js";

const env = { SUPABASE_URL: "https://database.example", SUPABASE_SERVICE_ROLE_KEY: "server-secret", SUPABASE_PUBLISHABLE_KEY: "public-key" };
const headers = { authorization: "Bearer user-token", "x-workspace-id": "ws_a", "content-type": "application/json" };
const actor = "10000000-0000-4000-8000-000000000001";
const request = (path, body, extra = {}) => new Request(`https://gateway.example/api/privacy/${path}`, { headers, ...(body === undefined ? {} : { method: "POST", body: JSON.stringify(body) }), ...extra });

test("schema prevents header injection, arbitrary extra recipients and invented consent times", () => {
  const valid = { request_id: crypto.randomUUID(), email: "user@example.com", sender: "venue@example.com", subject: "Offers", text: "Requested news" };
  assert.equal(marketingSchema.safeParse(valid).success, true);
  assert.equal(marketingSchema.safeParse({ ...valid, subject: "Offers\r\nBcc: stolen@example.com" }).success, false);
  assert.equal(marketingSchema.safeParse({ ...valid, bcc: "stolen@example.com" }).success, false);
  assert.equal(consentSchema.safeParse({ email: "user@example.com", status: "granted" }).success, false);
});
test("every marketing payload includes controller identity, text and HTML unsubscribe and RFC8058 headers", () => {
  const url = "https://gateway.example/api/privacy/unsubscribe?token=123";
  const payload = marketingPayload({ sender: "venue@example.com", email: "user@example.com", subject: "Requested offer", text: "<script>not executable</script>" }, { controller_name: "Example SL", controller_address: "Main Street 1", privacy_email: "privacy@example.com", policy_url: "https://example.com/privacy" }, url);
  assert.match(payload.text, /Example SL\nMain Street 1/); assert.ok(payload.text.includes(url));
  assert.ok(payload.html.includes("&lt;script&gt;")); assert.ok(!payload.html.includes("<script>"));
  assert.equal(payload.headers["List-Unsubscribe"], `<${url}>`);
  assert.equal(payload.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
});
test("signed webhook verifies raw body and timestamp, and rejects forgery/stale delivery", async () => {
  const bytes = new TextEncoder().encode("a-strong-test-signature-secret");
  const secret = `whsec_${btoa(String.fromCharCode(...bytes))}`;
  const raw = '{"type":"email.complained","data":{"email_id":"provider-1"}}';
  const now = Date.now(), timestamp = String(Math.floor(now / 1000)), id = "msg_123";
  const key = await crypto.subtle.importKey("raw", bytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${raw}`)));
  const h = new Headers({ "svix-id": id, "svix-timestamp": timestamp, "svix-signature": `v1,${btoa(String.fromCharCode(...signature))}` });
  assert.equal(await verifyResendWebhook(raw, h, secret, now), true);
  assert.equal(await verifyResendWebhook(`${raw} `, h, secret, now), false);
  assert.equal(await verifyResendWebhook(raw, h, secret, now + 301000), false);
  assert.equal(await verifyResendWebhook(raw, h, "", now), false);
});
test("unsubscribe GET has no effects; POST needs no account and stores suppression", async t => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => { calls.push({ url, body: JSON.parse(options.body) }); return Response.json(null); });
  const token = crypto.randomUUID();
  const get = await handlePrivacy(new Request(`https://gateway.example/api/privacy/unsubscribe?token=${token}`), env);
  assert.equal(get.status, 200); assert.match(await get.text(), /<form method="post">/); assert.equal(calls.length, 0);
  const post = await handlePrivacy(new Request(`https://gateway.example/api/privacy/unsubscribe?token=${token}`, { method: "POST", body: "List-Unsubscribe=One-Click" }), env);
  assert.equal(post.status, 200); assert.equal(calls.length, 1); assert.ok(calls[0].url.endsWith("crm_marketing_unsubscribe"));
  assert.deepEqual(calls[0].body, { p_token: token });
});
test("privacy routes verify user and membership before reading a tenant", async t => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async url => {
    calls.push(url);
    return url.endsWith("/auth/v1/user") ? Response.json({ id: actor }) : Response.json(false);
  });
  const response = await handlePrivacy(request("overview"), env);
  assert.equal(response.status, 403); assert.equal(calls.length, 2);
  assert.ok(!calls.some(url => url.endsWith("crm_privacy_overview")));
});
test("marketing stays disabled without verified delivery configuration", async t => {
  t.mock.method(globalThis, "fetch", async url => url.endsWith("/auth/v1/user") ? Response.json({ id: actor }) : Response.json(true));
  const response = await handlePrivacy(request("marketing/send", {}), env);
  assert.equal(response.status, 503);
});
test("oversized bodies are stopped while streaming", async () => {
  await assert.rejects(boundedText(new Request("https://example.com", { method: "POST", body: "0123456789" }), 5), /too large/);
});
test("provider timeout is uncertain, recorded once, and never automatically retried", async t => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options = {}) => {
    calls.push({ url, body: options.body && JSON.parse(options.body) });
    if (url.endsWith("/auth/v1/user")) return Response.json({ id: actor });
    if (url.endsWith("crm_privacy_access")) return Response.json(true);
    if (url.endsWith("crm_marketing_prepare")) return Response.json({ id: crypto.randomUUID(), token: crypto.randomUUID(), settings: { controller_name: "Example", controller_address: "Main Street", policy_url: "https://example.com/privacy", privacy_email: "privacy@example.com" } });
    if (url === "https://api.resend.com/emails") throw new Error("timeout");
    if (url.endsWith("crm_marketing_finish")) return Response.json(null);
    throw new Error("unexpected call");
  });
  const configured = { ...env, RESEND_API_KEY: "provider-secret", RESEND_WEBHOOK_SECRET: "signature-secret", PRIVACY_PUBLIC_ORIGIN: "https://gateway.example", PRIVACY_MARKETING_ENABLED: "true" };
  const response = await handlePrivacy(request("marketing/send", { request_id: crypto.randomUUID(), email: "user@example.com", sender: "venue@example.com", subject: "Offers", text: "Requested news" }), configured);
  assert.equal(response.status, 502); assert.equal((await response.json()).status, "uncertain");
  assert.equal(calls.filter(call => call.url === "https://api.resend.com/emails").length, 1);
  assert.equal(calls.find(call => call.url.endsWith("crm_marketing_finish")).body.p_status, "uncertain");
});
