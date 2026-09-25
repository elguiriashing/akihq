import assert from "node:assert/strict";
import test from "node:test";
import { handleSupport, humanReason, ingestSupportEmail, messageReferences, settingsSchema, chooseSupportAnswer, deliverSupportMessage } from "./support.js";
const env = { SUPABASE_URL: "https://db.example", SUPABASE_PUBLISHABLE_KEY: "public-test", SUPABASE_SERVICE_ROLE_KEY: "service-test" };
const actor = "10000000-0000-4000-8000-000000000001";
const request = (path, body, headers = {}) => new Request("https://gateway.example" + path, { method: body ? "POST" : "GET", headers: { authorization: "Bearer test-user-token", "x-workspace-id": "tenant-a", ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
test("support endpoint fails closed for wrong tenant before reading tickets", async t => {
  const urls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    urls.push(url);
    if (url.endsWith("/user")) return Response.json({ id: actor });
    assert.equal(JSON.parse(options.body).p_workspace, "tenant-a");
    return Response.json({ read: false });
  });
  const res = await handleSupport(request("/api/support/overview"), env);
  assert.equal(res.status, 403); assert.equal(urls.length, 2);
});
test("missing workspace and invalid token never fall back to AkiPasa HQ", async t => {
  t.mock.method(globalThis, "fetch", async () => Response.json({}, { status: 401 }));
  assert.equal((await handleSupport(request("/api/support/overview", null, { "x-workspace-id": "" }), env)).status, 400);
  assert.equal((await handleSupport(request("/api/support/overview"), env)).status, 401);
});
test("bot messages, sensitive requests, unauthenticated senders and attachments escalate", () => {
  for (const input of [{ text: "I want a refund", authenticated: true }, { text: "Quiero hablar con una persona", authenticated: true }, { text: "Hi", attachments: [{}], authenticated: true }, { text: "Hi", autoSubmitted: "auto-generated", authenticated: true }, { text: "Hi", authenticated: false }]) assert.ok(humanReason(input));
  assert.equal(humanReason({ text: "Where do I find my saved events?", authenticated: true }), "");
  assert.deepEqual(messageReferences("<ok@example.com>\r\nX-Evil: yes <two@example.com>"), ["<ok@example.com>", "<two@example.com>"]);
});
test("ingestion routes by envelope recipient, deduplicates and passes no client-supplied tenant", async t => {
  let args;
  t.mock.method(globalThis, "fetch", async (_, options) => { args = JSON.parse(options.body); return Response.json({ handled: true }); });
  await ingestSupportEmail(env, { to: "support@akipasa.com", from: "customer@example.com", headers: new Headers() }, { to: [{ address: "support@other.example" }], from: { address: "customer@example.com" }, text: "Hello", subject: "Hello" }, "abc123");
  assert.equal(args.p_recipient, "support@akipasa.com"); assert.equal(args.p_message_id, "<sha256-abc123@inbound.local>"); assert.equal(args.p_workspace, undefined); assert.ok(args.p_reason);
});
test("settings validation rejects duplicate approved-answer IDs and unknown fields", () => {
  const settings = { enabled: true, ai_mode: "auto", max_ai_replies: 2, daily_ai_limit: 25, knowledge: [{ id: "help", question: "How do I get help?", answer: "Reply with your question." }] };
  assert.ok(settingsSchema.safeParse(settings).success);
  assert.equal(settingsSchema.safeParse({ ...settings, workspace_id: "other" }).success, false);
  assert.equal(settingsSchema.safeParse({ ...settings, knowledge: [...settings.knowledge, ...settings.knowledge] }).success, false);
});
test("AI gets only this email and approved answers, no tools, no provider storage", async t => {
  let body;
  t.mock.method(globalThis, "fetch", async (_, options) => { body = JSON.parse(options.body); return Response.json({ status: "completed", output: [{ content: [{ type: "output_text", text: '{"answer_id":"help","reason":"Matched"}' }] }] }); });
  const decision = await chooseSupportAnswer({ OPENAI_API_KEY: "test", SUPPORT_AI_MODEL: "configured-model" }, { subject: "Help", text: "How?", secret: "never send this" }, [{ id: "help", answer: "Use the help screen" }]);
  assert.equal(decision.answer_id, "help"); assert.equal(body.store, false); assert.equal(body.tools, undefined); assert.doesNotMatch(JSON.stringify(body), /never send this/);
});
test("ambiguous transport failure is recorded as uncertain and not retried", async t => {
  const outcomes = []; let sends = 0;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    if (url.endsWith("claim_delivery")) return Response.json(sends ? null : { from: "support@akipasa.com", to: "customer@example.com", subject: "Ticket", text: "Answer" });
    if (url.includes("crm_support_messages?")) return Response.json([{ author_kind: "human" }]);
    outcomes.push(JSON.parse(options.body)); return Response.json(null);
  });
  const sending = { ...env, EMAIL: { send: async () => { sends++; throw new Error("timeout"); } } };
  await deliverSupportMessage(sending, "tenant-a", actor); await deliverSupportMessage(sending, "tenant-a", actor);
  assert.equal(sends, 1); assert.equal(outcomes[0].p_outcome, "uncertain");
});
test("forged auth headers alone cannot trigger AI; HTML and long emails stay readable but escalate", async t => {
  let args;
  t.mock.method(globalThis, "fetch", async (_, options) => { args = JSON.parse(options.body); return Response.json({ handled: true }); });
  const message = { to: "support@akipasa.com", from: "customer@example.com", headers: new Headers({ "Authentication-Results": "forged; dmarc=pass" }) };
  await ingestSupportEmail(env, message, { text: "Where is my ticket?" }, "digest");
  assert.match(args.p_reason, /authentication/);
  await ingestSupportEmail(env, { ...message, canBeForwarded: true }, { plainTextFallback: "Readable HTML body" }, "digest");
  assert.equal(args.p_text, "Readable HTML body"); assert.match(args.p_reason, /HTML/);
  await ingestSupportEmail(env, { ...message, canBeForwarded: true }, { text: "Long email ".repeat(2100) }, "digest");
  assert.ok(args.p_text.length <= 20000); assert.match(args.p_reason, /Long/);
});
test("provider IDs are normalized for inbound References threading", async t => {
  let result;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    if (url.endsWith("claim_delivery")) return Response.json({ from: "support@akipasa.com", to: "customer@example.com", subject: "Ticket", text: "Answer", in_reply_to: "<original@example.com>" });
    if (url.includes("crm_support_messages?")) return Response.json([{ author_kind: "human" }]);
    result = JSON.parse(options.body); return Response.json(null);
  });
  await deliverSupportMessage({ ...env, EMAIL: { send: async value => { assert.equal(value.headers["In-Reply-To"], "<original@example.com>"); return { messageId: "provider@example.com" }; } } }, "tenant-a", actor);
  assert.equal(result.p_provider_id, "<provider@example.com>"); assert.equal(result.p_outcome, "sent");
});
test("original download checks workspace permission and never exposes a public file URL", async t => {
  let storage = 0;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    if (url.endsWith("/user")) return Response.json({ id: actor });
    if (url.endsWith("/crm_support_access")) return Response.json({ read: true });
    if (url.endsWith("/crm_support_original")) return Response.json({ key: "tenant-b/private.eml" });
    storage++; return new Response("private email");
  });
  const response = await handleSupport(request(`/api/support/original?id=${actor}`), env);
  assert.equal(response.status, 404); assert.equal(storage, 0);
});
test("raw email is stored privately under the server-selected tenant before ticket intake", async t => {
  const digest = "a".repeat(64); let upload, intakeArgs;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    if (url.includes("crm_support_mailboxes?")) return Response.json([{ workspace_id: "tenant-a" }]);
    if (url.includes("/storage/")) { upload = { url, options }; return Response.json({ ok: true }); }
    intakeArgs = JSON.parse(options.body); return Response.json({ handled: true, workspace_id: "tenant-a" });
  });
  const raw = new TextEncoder().encode("Subject: Test\r\n\r\nOriginal email").buffer;
  await ingestSupportEmail(env, { to: "support@akipasa.com", from: "customer@example.com", headers: new Headers() }, { text: "Original email" }, digest, raw);
  assert.ok(upload.url.endsWith(`/storage/v1/object/crm-support-mail/tenant-a/${digest}.eml`));
  assert.equal(upload.options.body, raw); assert.equal(intakeArgs.p_original_key, `tenant-a/${digest}.eml`);
});
