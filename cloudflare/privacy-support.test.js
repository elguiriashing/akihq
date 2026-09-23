import assert from "node:assert/strict";
import { test } from "node:test";
import { deliverSupportMessage, humanReason } from "./support.js";

const env = { SUPABASE_URL: "https://db.example", SUPABASE_PUBLISHABLE_KEY: "public", SUPABASE_SERVICE_ROLE_KEY: "server" };
const id = "10000000-0000-4000-8000-000000000001";
for (const author of ["human", "ai"]) test(`${author} support delivery uses server-confirmed authorship and transparent AI identification`, async t => {
  let sent, inspected;
  t.mock.method(globalThis, "fetch", async url => {
    if (url.endsWith("claim_delivery")) return Response.json({ from: "support@venue.example", to: "customer@example.com", subject: "Your ticket", text: "Your approved answer." });
    if (url.includes("crm_support_messages?")) { inspected = url; return Response.json([{ author_kind: author }]); }
    return Response.json(null);
  });
  await deliverSupportMessage({ ...env, EMAIL: { send: async data => { sent = data; return { messageId: "provider@example.com" }; } } }, "ws_venue", id);
  assert.ok(inspected.includes(`id=eq.${id}&workspace_id=eq.ws_venue&select=author_kind`));
  if (author === "human") assert.equal(sent.text, "Your approved answer.");
  else {
    assert.match(sent.text, /^Respuesta automática de un asistente de IA/);
    assert.match(sent.text, /AI assistant/); assert.match(sent.text, /Reply “human”/);
    assert.ok(humanReason({ text: "human", authenticated: true }));
    assert.ok(humanReason({ text: "humano", authenticated: true }));
  }
});
test("unknown support authorship fails closed before provider request", async t => {
  let sends = 0, outcome;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    if (url.endsWith("claim_delivery")) return Response.json({ from: "support@venue.example", to: "customer@example.com", subject: "Your ticket", text: "Your approved answer." });
    if (url.includes("crm_support_messages?")) return Response.json([]);
    outcome = JSON.parse(options.body).p_outcome; return Response.json(null);
  });
  await deliverSupportMessage({ ...env, EMAIL: { send: async () => { sends++; } } }, "ws_venue", id);
  assert.equal(sends, 0); assert.equal(outcome, "failed");
});
