import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.js";

function mail(to = "support@tenant.example") {
  const forwarded = [], rejected = [];
  return { forwarded, rejected, from: "customer@example.com", to,
    raw: new Blob(["From: customer@example.com\r\nTo: " + to + "\r\nSubject: Help\r\nMessage-ID: <routing@example.com>\r\n\r\nPlease help."]).stream(),
    headers: new Headers(), forward: async destination => forwarded.push(destination), setReject: reason => rejected.push(reason) };
}
const config = { SUPPORT_INGEST_ENABLED: "true", SUPABASE_URL: "https://db.example", SUPABASE_SERVICE_ROLE_KEY: "service-test", MAIL_FORWARD_DEFAULT: "hq@example.com", SOCIAL_STORE: { put: async () => { throw Error("Support must not enter the global inbox"); } } };

test("gateway health advertises support deployment without leaking workspace or email configuration", async () => {
  const response = await worker.fetch(new Request("https://gateway.example/api/health"), config);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const health = await response.json();
  assert.equal(health.capabilities.support, 1);
  assert.doesNotMatch(JSON.stringify(health), /service-test|hq@example.com|tenant|mailbox/);
});

test("registered tenant support never enters the HQ company inbox or Gmail forwarding", async t => {
  t.mock.method(globalThis, "fetch", async url => {
    if (url.includes("crm_support_mailboxes?")) return Response.json([{ workspace_id: "tenant-a" }]);
    if (url.includes("/storage/")) return Response.json({ ok: true });
    return Response.json({ handled: true, workspace_id: "tenant-a" });
  });
  const message = mail(); await worker.email(message, config, {});
  assert.equal(message.forwarded.length, 0); assert.equal(message.rejected.length, 0);
});
test("HQ support keeps its existing forwarding backup after private intake", async t => {
  t.mock.method(globalThis, "fetch", async url => {
    if (url.includes("crm_support_mailboxes?")) return Response.json([{ workspace_id: "ws_akipasa" }]);
    if (url.includes("/storage/")) return Response.json({ ok: true });
    return Response.json({ handled: true, duplicate: true, workspace_id: "ws_akipasa" });
  });
  const message = mail("support@akipasa.com"); await worker.email(message, config, {});
  assert.deepEqual(message.forwarded, ["hq@example.com"]); assert.equal(message.rejected.length, 0);
});
test("intake failure and disabled feature never fall back to forwarding tenant mail to HQ", async t => {
  t.mock.method(globalThis, "fetch", async () => Response.json({}, { status: 503 }));
  const failed = mail(); await worker.email(failed, config, {});
  assert.equal(failed.forwarded.length, 0); assert.equal(failed.rejected.length, 1);
  const disabled = mail(); await worker.email(disabled, { ...config, SUPPORT_INGEST_ENABLED: "false" }, {});
  assert.equal(disabled.forwarded.length, 0); assert.equal(disabled.rejected.length, 1);
});
test("support preflight allows tenant header and sensitive responses disable caching", async t => {
  t.mock.method(globalThis, "fetch", async () => Response.json({}, { status: 401 }));
  const env = { ...config, ALLOWED_ORIGINS: "https://crm.example" };
  const options = await worker.fetch(new Request("https://gateway.example/api/support/overview", { method: "OPTIONS", headers: { origin: "https://crm.example" } }), env);
  assert.equal(options.headers.get("access-control-allow-origin"), "https://crm.example");
  assert.match(options.headers.get("access-control-allow-headers"), /x-workspace-id/);
  const response = await worker.fetch(new Request("https://gateway.example/api/support/overview", { headers: { origin: "https://crm.example", "x-workspace-id": "tenant-a", authorization: "Bearer invalid" } }), env);
  assert.equal(response.status, 401); assert.equal(response.headers.get("cache-control"), "private, no-store");
});
