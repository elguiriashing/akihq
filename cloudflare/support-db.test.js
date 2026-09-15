import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { before, after, test } from "node:test";

const db = new PGlite();
const owner = "10000000-0000-4000-8000-000000000001";
const other = "10000000-0000-4000-8000-000000000002";
const viewer = "10000000-0000-4000-8000-000000000003";
const staff = "10000000-0000-4000-8000-000000000004";
const role = "20000000-0000-4000-8000-000000000001";
const scalar = async (sql, params = []) => (await db.query(sql, params)).rows[0]?.value;
const rpc = (name, params) => scalar(`select public.${name}(${params.map((_, i) => `$${i + 1}`).join(",")}) value`, params);
before(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; grant usage on schema auth to public;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table public.profiles(id uuid primary key,display_name text,app_role text);
    create table public.crm_workspaces(id text primary key,status text default 'active',owner_profile_id uuid);
    create table public.crm_tool_catalog(tool_key text primary key,name text,description text,category text,billable boolean,sort_order integer,active boolean);
    create table public.crm_workspace_entitlements(workspace_id text,tool_key text,active boolean,starts_at timestamptz default now(),ends_at timestamptz,source text,primary key(workspace_id,tool_key));
    create table public.crm_role_templates(id uuid primary key,workspace_id text);
    create table public.crm_role_template_tools(template_id uuid,tool_key text);
    create table public.crm_workspace_members(workspace_id text,profile_id uuid,status text default 'active',role text,role_template_id uuid,primary key(workspace_id,profile_id));
    create function public.has_active_entitlement(p uuid,t text) returns boolean language sql stable as $$ select true $$;
    insert into public.profiles values('${owner}','Test owner','administrator'),('${other}','Other owner','administrator'),('${viewer}','Read only','user'),('${staff}','No support role','user');
    insert into public.crm_workspaces(id,owner_profile_id) values('ws_akipasa','${owner}'),('ws_other','${other}');
    insert into public.crm_workspace_members(workspace_id,profile_id,role) values('ws_akipasa','${owner}','owner'),('ws_other','${other}','owner'),('ws_akipasa','${viewer}','viewer'),('ws_akipasa','${staff}','staff');
    insert into public.crm_role_templates values('${role}','ws_akipasa');
    insert into public.crm_role_template_tools values('${role}','support');
    update public.crm_workspace_members set role_template_id='${role}' where profile_id='${viewer}';
  `);
  await db.exec(readFileSync(new URL("../supabase/migrations/20260915074426_support_desk.sql", import.meta.url), "utf8"));
  await db.exec(`
    grant select on all tables in schema public to service_role;
    insert into public.crm_workspace_entitlements(workspace_id,tool_key,active) values('ws_other','support',true);
    insert into public.crm_support_settings(workspace_id) values('ws_other');
    insert into public.crm_support_mailboxes(workspace_id,address,active,verified_at) values('ws_other','support@other.example',true,now());
    update public.crm_support_mailboxes set active=true,verified_at=now() where workspace_id='ws_akipasa';
  `);
});
after(() => db.close());
let n = 0;
async function intake({ recipient = "support@akipasa.com", from = "customer@example.com", message = `<message-${++n}@example.com>`, references = [], reason = "", text = "Where can I see my ticket?" } = {}) {
  return rpc("crm_support_ingest", [recipient, from, "Test Customer", "Support question", text, message, references, [], reason]);
}
async function detail(id, workspace = "ws_akipasa", actor = owner) { return rpc("crm_support_detail", [workspace, actor, id]); }
async function action(id, a, actor = owner) { const d = await detail(id); return rpc("crm_support_action", ["ws_akipasa", actor, id, d.ticket.version, a]); }
const settings = mode => rpc("crm_support_settings_save", ["ws_akipasa", owner, { enabled: true, ai_mode: mode, daily_ai_limit: 25, max_ai_replies: 2, knowledge: [{ id: "ticket", question: "Where is my ticket?", answer: "You can find your ticket number in the subject of our response." }] }]);

test("atomic intake creates numbered tickets, contact IDs and deduplicated message IDs", async () => {
  const first = await intake({ message: "<stable@example.com>" });
  const duplicate = await intake({ message: "<stable@example.com>" });
  assert.equal(duplicate.duplicate, true);
  const d = await detail(first.ticket_id);
  assert.equal(d.ticket.number, 1); assert.equal(d.messages.length, 1); assert.ok(d.contact.id);
  const reply = await intake({ message: "<reply@example.com>", references: ["<stable@example.com>"] });
  assert.equal(reply.ticket_id, first.ticket_id);
  const unrelated = await intake(); assert.notEqual(unrelated.ticket_id, first.ticket_id);
});
test("thread references never cross customers or workspaces", async () => {
  const stranger = await intake({ from: "different@example.com", references: ["<stable@example.com>"] });
  const d = await detail(stranger.ticket_id); assert.equal(d.messages.length, 1);
  const tenant = await intake({ recipient: "support@other.example", references: ["<stable@example.com>"] });
  assert.equal(tenant.workspace_id, "ws_other");
  await assert.rejects(detail(tenant.ticket_id), /no rows/);
  await assert.rejects(detail(tenant.ticket_id, "ws_other", owner), /insufficient_privilege/);
});
test("RLS hides other tenants even from platform admins and prevents direct writes", async () => {
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${owner}';`);
  try {
    const rows = await db.query("select distinct workspace_id from public.crm_support_tickets");
    assert.deepEqual(rows.rows, [{ workspace_id: "ws_akipasa" }]);
    assert.equal((await rpc("crm_support_access", ["ws_other"])).read, false);
    await assert.rejects(db.exec("update public.crm_support_settings set ai_mode='auto'"), /permission denied/);
    await assert.rejects(rpc("crm_support_ingest", ["support@akipasa.com", "attacker@example.com", "", "bad", "bad", "<fake@test.com>", [], [], ""]), /permission denied/);
  } finally { await db.exec("reset role"); }
  await db.exec(`set role anon;`);
  try { await assert.rejects(db.exec("select * from public.crm_support_tickets"), /permission denied/); }
  finally { await db.exec("reset role"); }
});
test("viewer can read but cannot reply; entitlement and role-template revoke access", async () => {
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${viewer}';`);
  try { assert.deepEqual(await rpc("crm_support_access", ["ws_akipasa"]), { read: true, write: false, manage: false }); }
  finally { await db.exec("reset role"); }
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${staff}';`);
  try { assert.equal((await rpc("crm_support_access", ["ws_akipasa"])).read, false); }
  finally { await db.exec("reset role"); }
  await db.exec("update public.crm_workspace_entitlements set active=false where workspace_id='ws_akipasa'");
  await assert.rejects(rpc("crm_support_overview", ["ws_akipasa", owner, "all", "", 0]), /insufficient_privilege/);
  await db.exec("update public.crm_workspace_entitlements set active=true where workspace_id='ws_akipasa'");
});
test("human actions use optimistic concurrency, reject other-tenant assignees and stop AI", async () => {
  const { ticket_id } = await intake(); const old = await detail(ticket_id);
  await assert.rejects(action(ticket_id, { kind: "update", status: "in_progress", priority: "normal", assigned_to: other }), /invalid_parameter_value/);
  await action(ticket_id, { kind: "takeover" });
  await assert.rejects(rpc("crm_support_action", ["ws_akipasa", owner, ticket_id, old.ticket.version, { kind: "takeover" }]), /serialization_failure/);
  await assert.rejects(action(ticket_id, { kind: "takeover" }, viewer), /insufficient_privilege/);
  const d = await detail(ticket_id); assert.equal(d.ticket.human_control, true); assert.equal(d.ticket.assigned_to, owner);
});
test("reply outbox is idempotent and a message is claimed for sending only once", async () => {
  const { ticket_id } = await intake(); const d = await detail(ticket_id);
  const a = { kind: "reply", request_id: crypto.randomUUID(), text: "Thanks, we can help." };
  const first = await rpc("crm_support_action", ["ws_akipasa", owner, ticket_id, d.ticket.version, a]);
  const again = await rpc("crm_support_action", ["ws_akipasa", owner, ticket_id, d.ticket.version, a]);
  assert.equal(first.outbound_id, again.outbound_id);
  const delivery = await rpc("crm_support_claim_delivery", ["ws_akipasa", first.outbound_id]);
  assert.equal(delivery.from, "support@akipasa.com"); assert.equal(delivery.to, "customer@example.com"); assert.match(delivery.subject, /SUP-/);
  assert.equal(await rpc("crm_support_claim_delivery", ["ws_akipasa", first.outbound_id]), null);
  await rpc("crm_support_delivery_result", ["ws_akipasa", first.outbound_id, "sent", "<out@example.com>"]);
  assert.equal((await detail(ticket_id)).ticket.status, "waiting_customer");
});
test("AI may send only approved answers and human takeover beats in-flight AI", async () => {
  await settings("auto");
  const { ticket_id } = await intake(); const work = await rpc("crm_support_claim_ai", []);
  const ticket = work.find(t => t.id === ticket_id); assert.ok(ticket);
  await action(ticket_id, { kind: "takeover" });
  await rpc("crm_support_finish_ai", ["ws_akipasa", ticket_id, ticket.version, "ticket", "Matched", ticket.knowledge_version]);
  assert.equal((await detail(ticket_id)).messages.length, 1);
  const next = await intake(); const nextWork = (await rpc("crm_support_claim_ai", [])).find(t => t.id === next.ticket_id);
  await rpc("crm_support_finish_ai", ["ws_akipasa", next.ticket_id, nextWork.version, "invented", "Needs a person", nextWork.knowledge_version]);
  assert.equal((await detail(next.ticket_id)).ticket.status, "needs_human");
});
test("AI auto mode queues exact approved text; draft mode never sends", async () => {
  await settings("auto");
  const a = await intake(); const job = (await rpc("crm_support_claim_ai", [])).find(t => t.id === a.ticket_id);
  await rpc("crm_support_finish_ai", ["ws_akipasa", a.ticket_id, job.version, "ticket", "Matched", job.knowledge_version]);
  const d = await detail(a.ticket_id); assert.equal(d.messages[1].delivery_status, "queued"); assert.equal(d.messages[1].text, "You can find your ticket number in the subject of our response.");
  await action(a.ticket_id, { kind: "takeover" });
  assert.equal((await detail(a.ticket_id)).messages[1].delivery_status, "cancelled");
  await settings("draft");
  const b = await intake(); const second = (await rpc("crm_support_claim_ai", [])).find(t => t.id === b.ticket_id);
  await rpc("crm_support_finish_ai", ["ws_akipasa", b.ticket_id, second.version, "ticket", "Matched", second.knowledge_version]);
  const draft = await detail(b.ticket_id); assert.equal(draft.messages.length, 1); assert.ok(draft.ticket.ai_draft); assert.equal(draft.ticket.status, "needs_human");
});
test("private notes never enter delivery queue; revoked permissions cancel sends", async () => {
  const a = await intake(); await action(a.ticket_id, { kind: "note", request_id: crypto.randomUUID(), text: "Private team note" });
  let d = await detail(a.ticket_id); assert.equal(d.messages[1].delivery_status, "internal");
  const reply = await action(a.ticket_id, { kind: "reply", request_id: crypto.randomUUID(), text: "Customer response" });
  await db.exec(`update public.crm_workspace_members set status='inactive' where profile_id='${owner}'`);
  assert.equal(await rpc("crm_support_claim_delivery", ["ws_akipasa", reply.outbound_id]), null);
  await db.exec(`update public.crm_workspace_members set status='active' where profile_id='${owner}'`);
  d = await detail(a.ticket_id); assert.equal(d.messages[2].delivery_status, "cancelled");
});

test("edited approved answers invalidate an in-flight AI decision", async () => {
  await settings("auto"); const a = await intake();
  const job = (await rpc("crm_support_claim_ai", [])).find(t => t.id === a.ticket_id);
  await settings("auto");
  await rpc("crm_support_finish_ai", ["ws_akipasa", a.ticket_id, job.version, "ticket", "Matched", job.knowledge_version]);
  const d = await detail(a.ticket_id); assert.equal(d.ticket.status, "needs_human"); assert.equal(d.messages.length, 1);
});
test("AI daily budget and disabled mailboxes escalate without sending", async () => {
  await settings("auto");
  await db.exec("update public.crm_support_settings set ai_day=current_date,ai_requests=daily_ai_limit where workspace_id='ws_akipasa'");
  const a = await intake(); await rpc("crm_support_claim_ai", []);
  assert.equal((await detail(a.ticket_id)).ticket.status, "needs_human");
  await db.exec("update public.crm_support_mailboxes set active=false where workspace_id='ws_akipasa'");
  const b = await intake(); const work = await rpc("crm_support_claim_ai", []);
  assert.equal(work.some(t => t.id === b.ticket_id), false);
  assert.equal((await detail(b.ticket_id)).ticket.status, "needs_human");
  const duplicate = await intake({ message: "<stable@example.com>" });
  assert.equal(duplicate.workspace_id, "ws_akipasa");
  await db.exec("update public.crm_support_mailboxes set active=true where workspace_id='ws_akipasa'");
});
test("a customer follow-up during sending is not overwritten by the send result", async () => {
  await settings("off");
  const a = await intake({ message: "<send-race@example.com>" });
  const reply = await action(a.ticket_id, { kind: "reply", request_id: crypto.randomUUID(), text: "Hello customer" });
  await rpc("crm_support_claim_delivery", ["ws_akipasa", reply.outbound_id]);
  await intake({ references: ["<send-race@example.com>"] });
  await rpc("crm_support_delivery_result", ["ws_akipasa", reply.outbound_id, "sent", "<race-out@example.com>"]);
  assert.equal((await detail(a.ticket_id)).ticket.status, "needs_human");
});
test("original emails stay private despite unrelated broad storage policies", async () => {
  await db.exec(`grant usage on schema storage to authenticated; grant select on storage.objects to authenticated;
    create policy unrelated_broad_read on storage.objects for select to authenticated using(true);
    insert into storage.objects(bucket_id,name) values('crm-support-mail','ws_akipasa/private.eml'),('unrelated','public.png');
    set role authenticated;`);
  try { const rows = await db.query("select name from storage.objects"); assert.deepEqual(rows.rows.map(row => row.name), ["public.png"]); }
  finally { await db.exec("reset role"); }
  assert.equal(await scalar("select public value from storage.buckets where id='crm-support-mail'"), false);
});
