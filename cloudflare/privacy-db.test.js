import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { before, after, test } from "node:test";
import assert from "node:assert/strict";

const db = new PGlite();
const owner = "10000000-0000-4000-8000-000000000001", other = "10000000-0000-4000-8000-000000000002", viewer = "10000000-0000-4000-8000-000000000003";
const rpc = async (name, args) => (await db.query(`select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as value`, args)).rows[0].value;
const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0].value;
const settings = { controller_name: "Example Venue SL", controller_address: "Calle Test 1, Málaga", privacy_email: "privacy@venue.example", policy_url: "https://venue.example/privacy", retention_days: 365 };
const consent = (email, status = "granted") => rpc("crm_privacy_consent_record", ["ws_a", owner, { email, status, source: "signup-form-v2", evidence: "Confirmation record: example-proof-123", notice_version: "2026-09-v2", occurred_at: new Date().toISOString() }]);
const send = (email, request = crypto.randomUUID(), workspace = "ws_a", actor = owner, digest = "a".repeat(64)) => rpc("crm_marketing_prepare", [workspace, actor, request, email, "news@venue.example", "Offers you requested", digest]);
before(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; grant usage on schema auth to public;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table public.profiles(id uuid primary key);
    create table public.crm_workspaces(id text primary key);
    create table public.crm_workspace_members(workspace_id text,profile_id uuid,status text,role text,role_template_id uuid);
    create table public.crm_support_mailboxes(workspace_id text,address text,active boolean,verified_at timestamptz);
    create table public.crm_support_contacts(id uuid,workspace_id text,email text,name text);
    create table public.crm_support_tickets(id uuid,workspace_id text,contact_id uuid,number integer,subject text,status text,created_at timestamptz default now(),updated_at timestamptz default now());
    create table public.crm_support_messages(ticket_id uuid,workspace_id text,direction text,text text,created_at timestamptz default now());
    insert into public.profiles values('${owner}'),('${other}'),('${viewer}');
    insert into public.crm_workspaces values('ws_a'),('ws_b');
    insert into public.crm_workspace_members(workspace_id,profile_id,status,role) values('ws_a','${owner}','active','owner'),('ws_b','${other}','active','admin'),('ws_a','${viewer}','active','viewer');
    insert into public.crm_support_mailboxes values('ws_a','news@venue.example',true,now());
  `);
  await db.exec(readFileSync(new URL("../supabase/migrations/20260923001529_privacy_operations.sql", import.meta.url), "utf8"));
  await db.exec("grant select on all tables in schema public to service_role");
  await rpc("crm_privacy_settings_save", ["ws_a", owner, settings]);
});
after(() => db.close());

test("RLS separates tenants, excludes viewers, and denies unauthenticated access", async () => {
  await consent("first@example.com");
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${owner}'`);
  try {
    assert.equal(await rpc("crm_privacy_access", ["ws_a"]), true);
    assert.equal(await rpc("crm_privacy_access", ["ws_b"]), false);
    assert.equal(await scalar("select count(*)::int as value from public.crm_privacy_consents"), 1);
    await assert.rejects(rpc("crm_privacy_consent_record", ["ws_a", owner, {}]), /permission denied/);
    await assert.rejects(db.exec("update public.crm_privacy_settings set retention_days=30"), /permission denied/);
  } finally { await db.exec("reset role"); }
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${viewer}'`);
  try { assert.equal(await scalar("select count(*)::int as value from public.crm_privacy_consents"), 0); }
  finally { await db.exec("reset role"); }
  await db.exec("set role anon");
  try { await assert.rejects(db.exec("select * from public.crm_privacy_settings"), /permission denied/); }
  finally { await db.exec("reset role"); }
  await assert.rejects(rpc("crm_privacy_overview", ["ws_b", owner]), /insufficient_privilege/);
});
test("consent evidence and suppression are append-only, including to service role", async () => {
  await consent("immutable@example.com", "withdrawn");
  await db.exec("set role service_role");
  try {
    await assert.rejects(db.exec("update public.crm_privacy_consents set status='granted'"), /append-only/);
    await assert.rejects(db.exec("delete from public.crm_privacy_events"), /append-only/);
    await assert.rejects(db.exec("delete from public.crm_privacy_suppressions"), /append-only/);
  } finally { await db.exec("reset role"); }
});
test("mail requires existing explicit consent and verified sender, without tenant bypass", async () => {
  await assert.rejects(send("imported-business@example.com"), /insufficient_privilege/);
  await consent("eligible@example.com");
  await assert.rejects(send("eligible@example.com", crypto.randomUUID(), "ws_a", other), /insufficient_privilege/);
  await db.exec("update public.crm_support_mailboxes set verified_at=null");
  await assert.rejects(send("eligible@example.com"), /insufficient_privilege/);
  await db.exec("update public.crm_support_mailboxes set verified_at=now()");
  const first = await send("eligible@example.com");
  assert.ok(first.token); assert.equal(first.duplicate, false);
});
test("idempotency survives retries and rejects changed payloads", async () => {
  await consent("retry@example.com");
  const request = crypto.randomUUID();
  const first = await send("retry@example.com", request);
  await rpc("crm_marketing_finish", [first.id, "sent", "provider-1"]);
  const duplicate = await send("retry@example.com", request);
  assert.equal(duplicate.duplicate, true); assert.equal(duplicate.status, "sent");
  assert.equal(duplicate.id, first.id); assert.equal(duplicate.token, undefined);
  await assert.rejects(send("retry@example.com", request, "ws_a", owner, "b".repeat(64)), /invalid_parameter_value/);
});
test("unsubscribe is idempotent, tenant scoped and cannot be undone by imported consent", async () => {
  await consent("stop@example.com");
  const first = await send("stop@example.com");
  await rpc("crm_marketing_unsubscribe", [first.token]);
  await rpc("crm_marketing_unsubscribe", [first.token]);
  await rpc("crm_marketing_unsubscribe", [crypto.randomUUID()]);
  await assert.rejects(send("stop@example.com"), /insufficient_privilege/);
  const reimport = await consent("stop@example.com"); assert.equal(reimport.suppressed, true);
  await assert.rejects(send("stop@example.com"), /insufficient_privilege/);
  assert.equal(await scalar("select count(*)::int as value from public.crm_privacy_events where kind='marketing_unsubscribe' and subject_email='stop@example.com'"), 1);
});
test("verified provider complaints suppress future sends and deduplicate events", async () => {
  await consent("complained@example.com");
  const row = await send("complained@example.com");
  await rpc("crm_marketing_finish", [row.id, "sent", "provider-complaint"]);
  await rpc("crm_marketing_delivery", ["event-complaint", "email.complained", "provider-complaint"]);
  await rpc("crm_marketing_delivery", ["event-complaint", "email.complained", "provider-complaint"]);
  await assert.rejects(send("complained@example.com"), /insufficient_privilege/);
  assert.equal(await scalar("select count(*)::int as value from privacy_private.delivery_events where id='event-complaint'"), 1);
});
test("early provider callbacks are retained and reconciled after sending completes", async () => {
  await consent("early-bounce@example.com");
  const row = await send("early-bounce@example.com");
  await rpc("crm_marketing_delivery", ["early-event", "email.bounced", "early-provider"]);
  await rpc("crm_marketing_finish", [row.id, "sent", "early-provider"]);
  await assert.rejects(send("early-bounce@example.com"), /insufficient_privilege/);
});
test("uncertain delivery also blocks attempts to resend with a new idempotency key", async () => {
  await consent("uncertain@example.com");
  const row = await send("uncertain@example.com");
  await rpc("crm_marketing_finish", [row.id, "uncertain", null]);
  await assert.rejects(send("uncertain@example.com"), /insufficient_privilege/);
});
test("rights deadlines use the actual supplied receipt date, not a delayed data-entry date", async () => {
  const r = await rpc("crm_privacy_request_create", ["ws_a", owner, { email: "late-entry@example.com", kind: "access", received_at: "2026-01-31T12:00:00Z" }]);
  assert.equal(new Date(r.due_at).toISOString(), "2026-02-28T12:00:00.000Z");
});
test("rights requests use calendar months, verified identity and explained state transitions", async () => {
  const created = await rpc("crm_privacy_request_create", ["ws_a", owner, { email: "subject@example.com", kind: "access", note: "Received by support" }]);
  assert.equal(await scalar("select (due_at=received_at+interval '1 month') as value from public.crm_privacy_requests where id=$1", [created.id]), true);
  await assert.rejects(rpc("crm_privacy_subject_export", ["ws_a", owner, created.id]), /insufficient_privilege/);
  await assert.rejects(rpc("crm_privacy_request_action", ["ws_a", owner, created.id, "complete", "Fulfilled by secure export"]), /invalid_parameter_value/);
  await rpc("crm_privacy_request_action", ["ws_a", owner, created.id, "verify", "Existing authenticated account matched"]);
  const extended = await rpc("crm_privacy_request_action", ["ws_a", owner, created.id, "extend", "Complex cross-module request; requester notified via ticket 123"]);
  assert.equal(extended.extended, true);
  await assert.rejects(rpc("crm_privacy_request_action", ["ws_a", owner, created.id, "extend", "Another two months please"]), /invalid_parameter_value/);
  const exported = await rpc("crm_privacy_subject_export", ["ws_a", owner, created.id]);
  assert.equal(exported.subject_email, "subject@example.com"); assert.equal(exported.coverage.complete_subject_export, false);
  await assert.rejects(rpc("crm_privacy_subject_export", ["ws_b", other, created.id]), /no rows/);
  await rpc("crm_privacy_request_action", ["ws_a", owner, created.id, "complete", "All module reviews completed and response sent via support ticket 123"]);
});
test("erasure intake suppresses marketing without deleting statutory business records", async () => {
  await consent("erase@example.com");
  const before = await scalar("select count(*)::int as value from public.crm_privacy_consents");
  await rpc("crm_privacy_request_create", ["ws_a", owner, { email: "erase@example.com", kind: "erasure" }]);
  await assert.rejects(send("erase@example.com"), /insufficient_privilege/);
  assert.equal(await scalar("select count(*)::int as value from public.crm_privacy_consents"), before);
  assert.equal((await rpc("crm_privacy_overview", ["ws_a", owner])).retention_review.automatic_deletion, false);
});
test("subject export contains their correspondence, not other subjects or internal notes", async () => {
  await db.exec(`insert into public.crm_support_contacts values('20000000-0000-4000-8000-000000000001','ws_a','export@example.com','Subject');
    insert into public.crm_support_tickets(id,workspace_id,contact_id,number,subject,status) values('30000000-0000-4000-8000-000000000001','ws_a','20000000-0000-4000-8000-000000000001',1,'Help','new');
    insert into public.crm_support_messages(ticket_id,workspace_id,direction,text) values('30000000-0000-4000-8000-000000000001','ws_a','inbound','My question'),('30000000-0000-4000-8000-000000000001','ws_a','note','Internal confidential note');`);
  const r = await rpc("crm_privacy_request_create", ["ws_a", owner, { email: "export@example.com", kind: "access" }]);
  await rpc("crm_privacy_request_action", ["ws_a", owner, r.id, "verify", "Identity verified in secure account"]);
  const data = await rpc("crm_privacy_subject_export", ["ws_a", owner, r.id]);
  assert.equal(data.correspondence.length, 1); assert.equal(data.correspondence[0].text, "My question");
});
