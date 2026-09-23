import assert from "node:assert/strict";
import { test } from "node:test";
import worker from "./worker.js";

const actor = "10000000-0000-4000-8000-000000000001";
const env = { SUPABASE_URL: "https://database.example", SUPABASE_SERVICE_ROLE_KEY: "server-secret", SUPABASE_PUBLISHABLE_KEY: "public-key", AKIHQ_API_TOKEN: "old-shared-token" };
const request = (path, method = "GET", token = "user-token", workspace = "ws_akipasa") => new Request(`https://gateway.example${path}`, { method, headers: { authorization: `Bearer ${token}`, "x-workspace-id": workspace, "content-type": "application/json" }, ...(method === "POST" ? { body: "{}" } : {}) });
test("old shared-token email/SMS endpoints never send arbitrary messages", async t => {
  t.mock.method(globalThis, "fetch", async () => { throw new Error("No external request should occur"); });
  for (const path of ["/api/resend/send", "/api/twilio/sms"]) {
    const result = await worker.fetch(request(path, "POST", "old-shared-token"), env);
    assert.equal(result.status, 409); assert.equal((await result.json()).error, "governed_delivery_required");
  }
});
test("unsigned generic ingestion fails closed and never writes data", async t => {
  t.mock.method(globalThis, "fetch", async () => { throw new Error("No external request should occur"); });
  const result = await worker.fetch(request("/api/webhooks/example", "POST"), env);
  assert.equal(result.status, 503);
});
test("global staff role does not expose shared company inbox to a different tenant", async t => {
  t.mock.method(globalThis, "fetch", async url => url.endsWith("/auth/v1/user") ? Response.json({ id: actor }) : Response.json([{ app_role: "administrator" }]));
  const result = await worker.fetch(request("/api/mail/overview", "GET", "user-token", "ws_customer"), env);
  assert.equal(result.status, 403); assert.equal((await result.json()).error, "tenant_integration_unavailable");
});
test("company integrations require active company membership even for platform administrators", async t => {
  t.mock.method(globalThis, "fetch", async url => {
    if (url.endsWith("/auth/v1/user")) return Response.json({ id: actor });
    if (url.includes("/profiles?")) return Response.json([{ app_role: "administrator" }]);
    if (url.includes("/crm_workspace_members?")) return Response.json([]);
    throw new Error("unexpected request");
  });
  const result = await worker.fetch(request("/api/social/overview"), env);
  assert.equal(result.status, 403); assert.equal((await result.json()).error, "workspace_administrator_required");
});
test("generic ingest binds workspace to server configuration, ignoring forged payload tenant", async t => {
  let event;
  t.mock.method(globalThis, "fetch", async (_url, options) => { event = JSON.parse(options.body); return new Response(null, { status: 201 }); });
  const input = new Request("https://gateway.example/api/webhooks/test", { method: "POST", headers: { "x-akihq-webhook-secret": "ingest-secret", "content-type": "application/json" }, body: JSON.stringify({ workspace_id: "ws_victim", id: "test-event" }) });
  const result = await worker.fetch(input, { ...env, WEBHOOK_INGEST_SECRET: "ingest-secret", WEBHOOK_WORKSPACE_ID: "ws_akipasa" });
  assert.equal(result.status, 202); assert.equal(event.workspace_id, "ws_akipasa"); assert.equal(event.signature_verified, true);
});
