import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const source = readFileSync(new URL("../assets/support-desk.js", import.meta.url), "utf8");
const tick = () => new Promise(resolve => setImmediate(resolve));
const ticket = { id: "a-ticket", number: 12, subject: "Booking help <img src=x onerror=alert(1)>", status: "needs_human", priority: "normal", requester_name: "Customer", requester_email: "customer@example.com", updated_at: "2026-09-15T12:00:00Z", version: 1 };
const overview = { tickets: [ticket], attention: { count: 1, at: ticket.updated_at }, counts: { needs_human: 1 }, members: [], mailboxes: [{ address: "support@example.com", active: true, verified: true }], settings: { enabled: true, ai_mode: "off", knowledge: [], max_ai_replies: 2, daily_ai_limit: 25 }, access: { read: true, write: true, manage: true }, sending_configured: true, ai_configured: false };
const detail = { ticket, contact: { id: "customer-id", name: "Customer", email: "customer@example.com" }, mailbox: { address: "support@example.com" }, messages: [{ id: "email-id", direction: "inbound", author_kind: "customer", text: "Hello <script>steal()</script>", delivery_status: "received", created_at: ticket.updated_at }], events: [] };

function setup(t, handler, initial = overview, initialHealth = { capabilities: { support: 1 } }) {
  const dom = new JSDOM('<main id="support"></main>', { url: "https://qa.example", runScripts: "outside-only" });
  const { window } = dom; window.structuredClone = structuredClone;
  window.eval(source);
  const calls = []; let workspace = "tenant-a", allowed = true, health = initialHealth;
  const desk = window.createSupportDesk({ workspace: () => workspace, workspaceName: () => workspace, user: () => "user-a", locale: () => "en", route: () => "support", allowed: () => allowed,
    icon: () => '<svg aria-hidden="true"></svg>', toast: () => {}, render: () => { window.document.querySelector("main").innerHTML = desk.render(); },
    request: async (path, options) => { calls.push({ path, options }); if (path === "/api/health") return structuredClone(health); return handler ? handler(path, options) : structuredClone(path.includes("/ticket") ? detail : initial); }
  });
  t.after(() => window.close());
  return { window, desk, calls, setHealth: value => { health = value; }, setWorkspace: value => { workspace = value; desk.reset(); }, revoke: () => { allowed = false; }, render: () => { window.document.querySelector("main").innerHTML = desk.render(); } };
}
function click(ui, selector) { const target = ui.window.document.querySelector(selector); assert.ok(target, selector); target.click(); }

test("support UI escapes customer HTML, displays ticket IDs and offers a separate private-note form", async t => {
  const ui = setup(t); await ui.desk.refresh();
  assert.match(ui.window.document.body.textContent, /SUP-000012/);
  assert.equal(ui.window.document.querySelector("img"), null);
  click(ui, '[data-support-action="select"]'); await tick();
  assert.match(ui.window.document.body.textContent, /Hello <script>steal\(\)<\/script>/);
  assert.equal(ui.window.document.querySelector("script"), null);
  assert.ok(ui.window.document.querySelector('[data-support-form="reply"]'));
  assert.ok(ui.window.document.querySelector('[data-support-form="note"]'));
  assert.equal(ui.window.localStorage.length, 0);
});
test("viewer UI hides replies, takeover and support settings", async t => {
  const ui = setup(t, undefined, { ...overview, access: { read: true, write: false, manage: false } });
  await ui.desk.refresh(); click(ui, '[data-support-action="select"]'); await tick();
  assert.equal(ui.window.document.querySelector('[data-support-form="reply"]'), null);
  assert.equal(ui.window.document.querySelector('[data-support-action="takeover"]'), null);
  assert.equal(ui.window.document.querySelector('[data-support-action="settings"]'), null);
});
test("switching workspace discards in-flight responses, drafts and notifications", async t => {
  let release;
  const ui = setup(t, () => new Promise(resolve => { release = resolve; }));
  const pending = ui.desk.refresh();
  await tick();
  ui.setWorkspace("tenant-b"); release(structuredClone(overview)); await pending;
  assert.equal(ui.desk.attention().count, 0); assert.equal(ui.desk.notifications().length, 0);
  ui.revoke(); ui.render(); assert.equal(ui.window.document.querySelector("main").textContent, "");
  assert.equal(ui.calls[0].options.headers["x-workspace-id"], "tenant-a");
});
test("an older gateway shows connection pending without claiming an empty inbox, then recovers on refresh", async t => {
  const ui = setup(t, undefined, overview, { ok: true });
  await ui.desk.refresh(); await tick();
  assert.match(ui.window.document.body.textContent, /Support is being connected/);
  assert.doesNotMatch(ui.window.document.body.textContent, /All clear here/);
  assert.equal(ui.window.document.querySelector('[data-support-form="search"]'), null);
  assert.equal(ui.calls.length, 1);
  ui.setHealth({ capabilities: { support: 1 } });
  click(ui, '[data-support-action="refresh"]'); await tick();
  assert.match(ui.window.document.body.textContent, /SUP-000012/);
  assert.doesNotMatch(ui.window.document.body.textContent, /Support is being connected/);
});
test("a failed overview is reported as unavailable and never as an empty inbox", async t => {
  const ui = setup(t, () => { throw Error("Connection failed"); });
  await ui.desk.refresh();
  assert.match(ui.window.document.body.textContent, /Support unavailable/);
  assert.doesNotMatch(ui.window.document.body.textContent, /All clear here/);
});
test("revoked membership makes no gateway calls and hides connection status", async t => {
  const ui = setup(t, undefined, overview, { ok: true });
  ui.revoke(); await ui.desk.refresh(); ui.render();
  assert.equal(ui.calls.length, 0);
  assert.equal(ui.window.document.querySelector("main").textContent, "");
});
test("support notification summary contains no email body and disappears on revocation", async t => {
  const ui = setup(t); await ui.desk.refresh();
  assert.equal(ui.desk.attention().count, 1);
  assert.equal(ui.desk.notifications()[0].route, "support");
  assert.doesNotMatch(JSON.stringify(ui.desk.notifications()), /customer@example.com|Booking help/);
  ui.revoke(); assert.equal(ui.desk.notifications().length, 0);
});
test("reply and private note actions retain idempotency IDs across failed retries", async t => {
  const actions = [];
  const ui = setup(t, (path, options) => {
    if (path.includes("/action")) { actions.push(options.body.action); throw Error("Temporary failure"); }
    return structuredClone(path.includes("/ticket") ? detail : overview);
  });
  await ui.desk.refresh(); click(ui, '[data-support-action="select"]'); await tick();
  let text = ui.window.document.querySelector('[data-support-draft="note"]'); text.value = "Team only"; text.dispatchEvent(new ui.window.Event("input", { bubbles: true }));
  const submit = () => ui.window.document.querySelector('[data-support-form="note"]').dispatchEvent(new ui.window.Event("submit", { bubbles: true, cancelable: true }));
  submit(); await tick(); submit(); await tick();
  assert.equal(actions.length, 2); assert.equal(actions[0].kind, "note");
  assert.equal(actions[0].request_id, actions[1].request_id);
  assert.equal(ui.window.document.querySelector('[data-support-draft="note"]').value, "Team only");
});
test("search and filters are sent to the server; settings show missing provider clearly", async t => {
  const ui = setup(t); await ui.desk.refresh();
  click(ui, '[data-filter="needs_human"]'); await tick();
  assert.match(ui.calls.at(-1).path, /filter=needs_human/);
  const form = ui.window.document.querySelector('[data-support-form="search"]'); form.querySelector("input").value = "Example";
  form.dispatchEvent(new ui.window.Event("submit", { bubbles: true, cancelable: true })); await tick();
  assert.match(ui.calls.at(-1).path, /search=Example/);
  click(ui, '[data-support-action="settings"]');
  assert.match(ui.window.document.body.textContent, /AI provider not configured/);
});
