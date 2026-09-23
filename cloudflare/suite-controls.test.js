import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";
import XLSX from "xlsx";

const source = fs.readFileSync(new URL("../assets/suite-controls.js", import.meta.url), "utf8");
function setup(overrides = {}) {
  const dom = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only" });
  dom.window.eval(fs.readFileSync(new URL("../assets/fiscal-core.js", import.meta.url), "utf8"));
  dom.window.XLSX = XLSX;
  dom.window.eval(source);
  const calls = [], downloads = [], toasts = [];
  const fiscal = { access: { read: true, manage: true, export: true }, profile: { legal_name: "Example <img src=x onerror=alert(1)>", tax_id: "89890001K" }, tax_assignments: [], documents: [] };
  const privacy = { settings: { controller_name: "Example" }, requests: [], counts: {} };
  const ctx = { workspace: { id: "ws_1" }, products: [{ id: "product-id", name: "Coffee" }], client: { rpc: async (name, args) => { calls.push({ name, args }); return { data: name === "crm_fiscal_overview" ? fiscal : {} }; } }, request: async (path, opts) => { calls.push({ path, opts }); return privacy; }, download: (...args) => downloads.push(args), toast: (...args) => toasts.push(args), refresh() {}, ...overrides };
  const ui = dom.window.AkiHQSuiteControls.create(ctx);
  const mount = () => { dom.window.document.body.innerHTML = ui.render(); };
  return { dom, ctx, ui, mount, fiscal, privacy, calls, downloads, toasts };
}

test("suite controls render escaped input, honest restrictions and no fiscal issue/send action", async () => {
  const t = setup(); await t.ui.load(); t.mount();
  assert.equal(t.dom.window.document.querySelector("img"), null);
  assert.match(t.dom.window.document.body.textContent, /Fiscal issuance unavailable/);
  assert.match(t.dom.window.document.body.textContent, /support correspondence only/);
  assert.equal(t.dom.window.document.querySelector("[data-action='suite-issue'],[data-action='suite-send']"), null);
  assert.equal(t.dom.window.document.querySelector("#suite-fiscal-profile input[name='legal_name']").value, t.fiscal.profile.legal_name);
  assert.equal(await t.ui.action({ dataset: { action: "unrelated" } }), false);
});

test("fiscal profile submission uses the current workspace and explicit supported scope", async () => {
  const t = setup(); await t.ui.load(); t.mount();
  const f = t.dom.window.document.querySelector("#suite-fiscal-profile");
  for (const [key, value] of Object.entries({ legal_name: "Example SL", tax_id: "89890001k", address: "Calle Mayor 1", postal_code: "29640", city: "Fuengirola" })) f.elements.namedItem(key).value = value;
  f.elements.namedItem("scope_confirmed").checked = true;
  assert.equal(await t.ui.submit(f), true);
  const saved = t.calls.find(c => c.name === "crm_fiscal_save_profile");
  assert.equal(saved.args.p_workspace, "ws_1");
  assert.equal(saved.args.p_profile.tax_id, "89890001K");
  assert.equal(saved.args.p_profile.jurisdiction, "common_territory");
  assert.equal(saved.args.p_profile.sii, false);
});

test("fiscal ledger export paginates all records using the first server snapshot", async () => {
  const t = setup(); const asOf = "2026-09-23T10:00:00Z"; let pages = 0;
  const original = t.ctx.client.rpc;
  t.ctx.client.rpc = async (name, args) => {
    if (name !== "crm_fiscal_export_ledger") return original(name, args);
    t.calls.push({ name, args }); pages++;
    const doc = id => ({ id, workspace_id: "ws_1", lines: [], tax_summary: [], taxable_base_cents: 0, tax_cents: 0, total_cents: 0 });
    return { data: { as_of: asOf, documents: pages === 1 ? Array.from({ length: 250 }, (_, i) => doc(String(i).padStart(4, "0"))) : [doc("0250")] } };
  };
  await t.ui.load(); t.mount();
  const f = t.dom.window.document.querySelector("#suite-fiscal-export"); f.elements.namedItem("format").value = "json";
  await t.ui.submit(f);
  assert.equal(pages, 2); assert.equal(t.downloads.length, 1);
  const data = JSON.parse(t.downloads[0][1]); assert.equal(data.documents.length, 251); assert.equal(data.official_aeat_book, false);
  const requests = t.calls.filter(c => c.name === "crm_fiscal_export_ledger");
  assert.equal(requests[0].args.p_as_of, null);
  assert.equal(requests[1].args.p_as_of, asOf);
  assert.equal(requests[1].args.p_after, "0249");
});

test("cross-tenant records and pagination errors never produce a partial fiscal file", async () => {
  const t = setup(); const original = t.ctx.client.rpc;
  t.ctx.client.rpc = async (name, args) => name === "crm_fiscal_export_ledger" ? { data: { as_of: "2026-09-23T10:00:00Z", documents: [{ id: "1", workspace_id: "ws_other" }] } } : original(name, args);
  await t.ui.load(); t.mount(); await t.ui.submit(t.dom.window.document.querySelector("#suite-fiscal-export"));
  assert.equal(t.downloads.length, 0); assert.match(t.toasts.at(-1)[1], /workspace/);
});

test("default fiscal export produces a real Excel workbook with explicit scope", async () => {
  const t = setup(); const original = t.ctx.client.rpc;
  t.ctx.client.rpc = async (name, args) => name === "crm_fiscal_export_ledger" ? { data: { as_of: "2026-09-23T10:00:00Z", documents: [] } } : original(name, args);
  await t.ui.load(); t.mount(); await t.ui.submit(t.dom.window.document.querySelector("#suite-fiscal-export"));
  assert.equal(t.downloads.length, 1);
  assert.match(t.downloads[0][0], /\.xlsx$/);
  const workbook = XLSX.read(t.downloads[0][1], { type: "array" });
  assert.deepEqual(workbook.SheetNames, ["Readme", "Documents", "Lines", "Tax breakdown"]);
  assert.match(workbook.Sheets.Readme.B6.v, /not the official AEAT IVA book/);
});

test("privacy request is validated and routed without any marketing send", async () => {
  const t = setup(); await t.ui.load(); t.mount();
  const f = t.dom.window.document.querySelector("#suite-privacy-request");
  f.elements.namedItem("email").value = "alex@example.com";
  f.elements.namedItem("kind").value = "access";
  f.elements.namedItem("note").value = "Please provide my records.";
  await t.ui.submit(f);
  const saved = t.calls.find(c => c.path === "/api/privacy/requests");
  assert.equal(saved.opts.body.email, "alex@example.com");
  assert.equal(saved.opts.body.kind, "access");
  assert.equal(t.calls.some(c => c.path?.includes("/marketing/send")), false);
});

test("scoped privacy export requires verified request and retains server coverage manifest", async () => {
  const t = setup(); t.privacy.requests = [{ id: "request-1", email: "alex@example.com", kind: "access", status: "received" }];
  await t.ui.load();
  await t.ui.action({ dataset: { action: "suite-privacy-export", id: "request-1" } });
  assert.equal(t.downloads.length, 0);
  t.privacy.requests[0].verified_at = "2026-09-23T10:00:00Z";
  const original = t.ctx.request;
  t.ctx.request = async (path, opts) => path.startsWith("/api/privacy/export") ? { coverage: { complete: false, included: ["support"] }, subject_email: "alex@example.com" } : original(path, opts);
  await t.ui.action({ dataset: { action: "suite-privacy-export", id: "request-1" } });
  assert.equal(JSON.parse(t.downloads[0][1]).coverage.complete, false);
});

test("disposing or changing workspace prevents future requests and rendering", async () => {
  const t = setup(); t.ui.dispose(); assert.equal(t.ui.render(), "");
  await assert.rejects(t.ui.load(), /Workspace changed/);
  const other = setup(); other.ctx.workspace.id = "ws_2";
  await assert.rejects(other.ui.load(), /Workspace changed/);
  assert.equal(other.calls.length, 0);
});
