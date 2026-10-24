import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { before, beforeEach, after, test } from "node:test";
import assert from "node:assert/strict";
const db = new PGlite();
const owner = "00000000-0000-4000-8000-000000000001",
  other = "00000000-0000-4000-8000-000000000002",
  venue = "10000000-0000-4000-8000-000000000001",
  foreign = "10000000-0000-4000-8000-000000000002",
  property = "10000000-0000-4000-8000-000000000003",
  fleet = "20000000-0000-4000-8000-000000000001",
  foreignFleet = "20000000-0000-4000-8000-000000000002",
  org = "30000000-0000-4000-8000-000000000001";
const until = "2026-10-20T00:00:00.000Z";
async function actor(id = owner) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
}
async function report(kind = "venue", id = venue, days = 7, end = until) {
  return (
    await db.query(
      "select public.akipulse_scope_analytics($1,$2,$3,$4) report",
      [kind, id, days, end],
    )
  ).rows[0].report;
}
before(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role;create schema auth;create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create function public.account_features_allowed() returns boolean language sql stable as $$ select current_setting('test.account_allowed',true) is distinct from 'false' $$;
 create type public.venue_member_role as enum('owner','manager','editor');
 create table venues(id uuid primary key,name text,discovery_vertical text);
 create table venue_members(venue_id uuid,profile_id uuid,role venue_member_role);
 create table car_rental_companies(id uuid primary key,name text,submitted_by uuid);
 create table car_rental_vehicles(id uuid primary key,company_id uuid,active boolean);
 create table operating_organisations(id uuid primary key,name text,status text,owner_profile_id uuid);
 create table operating_organisation_locations(organisation_id uuid,workspace_id text);
 create table crm_workspaces(id text primary key,source_venue_id uuid,status text);
 create table booking_requests(id serial,venue_id uuid,created_at timestamptz,status text,contact_email text);
 create table accommodation_reservations(id serial,venue_id uuid,created_at timestamptz,status text,contact_email text);
 create table car_rental_bookings(id serial,vehicle_id uuid,created_at timestamptz,status text,contact_email text);
 create table accommodation_units(id serial,venue_id uuid,active boolean);
 create table analytics_events(id serial,venue_id uuid,occurred_at timestamptz,action text,profile_id uuid);
 create function public.is_venue_member(p uuid,roles venue_member_role[] default array['owner','manager','editor']::venue_member_role[]) returns boolean language sql stable security definer as $$select exists(select 1 from public.venue_members where venue_id=p and profile_id=auth.uid() and role=any(roles))$$;
 create function public.can_manage_rental_company(p uuid) returns boolean language sql stable security definer as $$select exists(select 1 from public.car_rental_companies where id=p and submitted_by=auth.uid())$$;
 create function public.can_manage_operating_organisation(p uuid) returns boolean language sql stable security definer as $$select exists(select 1 from public.operating_organisations where id=p and owner_profile_id=auth.uid() and status='active')$$;
 grant usage on schema public,auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
 `);
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20261020180504_akipulse_scoped_booking_aggregates.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(`create table crm_workspace_members(workspace_id text,profile_id uuid,status text,role text);
 create function public.crm_can_access_workspace(w text) returns boolean language sql stable as $$ select exists(select 1 from public.crm_workspace_members where workspace_id=w and profile_id=auth.uid() and status='active') $$;`);
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20261020235637_trusted_business_funnel_projection.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(`
 create table profiles(id uuid primary key);
 insert into profiles values('${owner}'),('${other}');
 alter table crm_workspaces add column name text default 'Synthetic workspace',add column owner_profile_id uuid;
 create schema accommodation_property_private;create table accommodation_property_private.launch_settings(singleton boolean primary key,enabled boolean,inventory_enabled boolean);insert into accommodation_property_private.launch_settings values(true,true,true);
 create table accommodation_properties(id uuid primary key,name text,workspace_id text,owner_profile_id uuid);
 create table accommodation_property_units(id serial,property_id uuid,active boolean);
 create table accommodation_property_reservations(id serial,property_id uuid,created_at timestamptz,status text,contact_email text);
 create function public.can_manage_accommodation_property(p uuid) returns boolean language sql stable as $$ select current_setting('test.native_ready',true)='true' and exists(select 1 from public.accommodation_properties a where a.id=p and a.owner_profile_id=auth.uid() and (a.workspace_id is null or public.crm_can_access_workspace(a.workspace_id))) $$;
 create function public.can_manage_accommodation_inventory(p uuid) returns boolean language sql stable as $$ select public.can_manage_accommodation_property(p) $$;
 create schema suite_funnel_private;
 create table suite_funnel_private.settings(singleton boolean primary key,enabled boolean,enabled_since timestamptz,retention_days integer);
 insert into suite_funnel_private.settings values(true,false,null,null);
 create table suite_funnel_private.stages(stage text,proof_key text,profile_id uuid,workspace_id text,venue_id uuid,occurred_at timestamptz,unique(stage,proof_key));
 create function suite_funnel_private.subject_allowed(p uuid) returns boolean language sql stable as $$ select p='${owner}'::uuid $$;
 `);
  for (const migration of [
    "20261021141734_akipulse_native_scope_adapters.sql",
    "20261021141744_akipulse_organisation_verified_funnel.sql",
    "20261021141816_akipulse_native_property_report.sql",
    "20261021141823_akipulse_native_organisation_report.sql",
    "20261021141838_akipulse_explicit_funnel_dispatch.sql",
    "20261021142517_akipulse_explicit_rental_workspace_links.sql",
    "20261021142549_akipulse_rental_workspace_owner_controls.sql",
    "20261021142652_akipulse_organisation_rental_cohorts.sql",
    "20261021145321_akipulse_management_privacy_export.sql",
  ])
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/" + migration, import.meta.url),
        "utf8",
      ),
    );
});
beforeEach(async () => {
  await db.exec(
    "reset role; truncate akipulse_private.rental_link_audit,akipulse_rental_workspaces,suite_funnel_private.stages,accommodation_properties,accommodation_property_units,accommodation_property_reservations,crm_workspace_members,venues,venue_members,car_rental_companies,car_rental_vehicles,operating_organisations,operating_organisation_locations,crm_workspaces,booking_requests,accommodation_reservations,car_rental_bookings,accommodation_units,analytics_events restart identity;",
  );
  await actor();
  await db.query("select set_config('test.native_ready','true',false)");
  await db.exec(
    "update accommodation_property_private.launch_settings set enabled=true,inventory_enabled=true;update suite_funnel_private.settings set enabled=false,enabled_since=null,retention_days=null",
  );
  await db.query("select set_config('test.account_allowed','true',false)");
  await db.exec(`insert into venues values('${venue}','Owned venue','activities'),('${foreign}','Private foreign','activities'),('${property}','Owned property','accommodation');
 insert into venue_members values('${venue}','${owner}','owner'),('${property}','${owner}','manager'),('${foreign}','${other}','owner');
 insert into car_rental_companies values('${fleet}','Owned rental','${owner}'),('${foreignFleet}','Private rental','${other}');
 insert into car_rental_vehicles values('${fleet}','${fleet}',true),('${foreignFleet}','${foreignFleet}',true);
 insert into operating_organisations values('${org}','Owned organisation','active','${owner}');
 insert into crm_workspaces(id,source_venue_id,status) values('one','${venue}','active'),('two','${property}','active'),('foreign','${foreign}','active'),('unlinked',null,'active');update crm_workspaces set owner_profile_id='${owner}' where id<>'foreign';update crm_workspaces set owner_profile_id='${other}' where id='foreign';
 insert into operating_organisation_locations values('${org}','one'),('${org}','two'),('${org}','foreign'),('${org}','unlinked');
 insert into booking_requests(venue_id,created_at,status,contact_email) values('${venue}','2026-10-13','confirmed','secret@example.invalid'),('${venue}','2026-10-06','cancelled','secret@example.invalid'),('${venue}','2026-10-20','requested','secret@example.invalid'),('${foreign}','2026-10-19','confirmed','private@example.invalid');
 insert into accommodation_reservations(venue_id,created_at,status) values('${property}','2026-10-19','checked_in'),('${foreign}','2026-10-19','confirmed');
 insert into car_rental_bookings(vehicle_id,created_at,status) values('${fleet}','2026-10-19','confirmed'),('${foreignFleet}','2026-10-19','confirmed');
 insert into accommodation_units(venue_id,active) values('${property}',true),('${property}',false),('${foreign}',true);
 insert into analytics_events(venue_id,occurred_at,action,profile_id) values('${venue}','2026-10-19','booking_click','${owner}'),('${foreign}','2026-10-19','venue_view','${other}');`);
});
after(() => db.close());
test("anonymous and foreign scopes are denied, not customer-readable RLS fallback", async () => {
  await actor("");
  await assert.rejects(report(), /Authentication/);
  await actor(other);
  for (const [kind, id] of [
    ["venue", venue],
    ["property", property],
    ["fleet", fleet],
    ["organisation", org],
  ])
    await assert.rejects(report(kind, id), /management required/);
});
test("exact adjacent half-open cohorts count each request once and never expose contacts", async () => {
  const r = await report();
  assert.deepEqual(r.bookings, [
    { source: "venue", period: "current", status: "confirmed", total: 1 },
    { source: "venue", period: "previous", status: "cancelled", total: 1 },
  ]);
  assert.equal(r.interactions[0].current, 1);
  assert(!JSON.stringify(r).includes("@"));
  assert.equal(r.revenue_available, false);
});
test("property reports require real accommodation venue and preserve statuses", async () => {
  await assert.rejects(report("property", venue), /management/);
  const r = await report("property", property);
  assert.equal(r.coverage.current_active_units, 1);
  assert.deepEqual(r.bookings, [
    {
      source: "accommodation",
      period: "current",
      status: "checked_in",
      total: 1,
    },
  ]);
});
test("independent fleet reports retain correct branch scope without venue inference", async () => {
  const r = await report("fleet", fleet);
  assert.equal(r.coverage.measured_venues, 0);
  assert.equal(r.coverage.current_active_units, null);
  assert.equal(r.coverage.current_active_vehicles, 1);
  assert.deepEqual(r.bookings, [
    { source: "fleet", period: "current", status: "confirmed", total: 1 },
  ]);
  assert.deepEqual(r.interactions, []);
});
test("organisation intersects direct location management and explicit source link", async () => {
  const r = await report("organisation", org);
  assert.equal(r.coverage.measured_venues, 2);
  assert.equal(r.coverage.excluded_locations, 2);
  assert.equal(
    r.bookings.reduce((s, r) => s + r.total, 0),
    3,
  );
  assert(!JSON.stringify(r).includes("Private"));
  assert.equal(r.coverage.current_active_vehicles, null);
});
test("role revocation and org deactivation take effect on the next RPC", async () => {
  await db.exec(
    `update venue_members set role='editor' where venue_id='${venue}';`,
  );
  await assert.rejects(report(), /management/);
  const r = await report("organisation", org);
  assert.equal(r.coverage.measured_venues, 1);
  assert.equal(r.coverage.excluded_locations, 3);
  await db.exec(`update operating_organisations set status='paused'`);
  await assert.rejects(report("organisation", org), /management/);
});
test("scope pagination is bounded and selects only managed resources", async () => {
  let r = await db.query("select * from akipulse_scopes('property',1,0)");
  assert.deepEqual(r.rows, [{ id: property, name: "Owned property" }]);
  for (const args of [
    [null, 1, 0],
    ["venue", 102, 0],
    ["fleet", 1, -1],
    ["organisation", 1, 10001],
  ])
    await assert.rejects(
      db.query("select * from akipulse_scopes($1,$2,$3)", args),
      /Invalid/,
    );
});
test("invalid periods, future ranges and fanout fail closed", async () => {
  await assert.rejects(report("venue", venue, 8), /Invalid/);
  await assert.rejects(report("venue", venue, 7, "2100-01-01Z"), /Invalid/);
  await db.exec(
    `insert into operating_organisation_locations select '${org}', 'unlinked' from generate_series(1,101)`,
  );
  await assert.rejects(report("organisation", org), /exceeds report scope/);
});
test("no scoped acquisition evidence never becomes a fabricated conversion funnel", async () => {
  const r = await report();
  assert.deepEqual(r.commercial_funnel, {
    available: false,
    reason: "no_scoped_verified_attribution_adapter",
  });
  assert.deepEqual(r.acquisition_sources, { available: false });
});
test("least grants allow guarded aggregate but not raw tables, anon cannot execute", async () => {
  await db.exec("set role anon");
  await assert.rejects(report(), /permission denied/);
  await db.exec("reset role;set role authenticated");
  assert.equal((await report()).coverage.measured_venues, 1);
  await assert.rejects(
    db.query("select * from booking_requests"),
    /permission denied/,
  );
  await db.exec("reset role");
});
test("UTC intervals remain exact across DST, leap day and month boundaries", async () => {
  for (const end of [
    "2026-03-30T00:00:00Z",
    "2025-10-27T00:00:00Z",
    "2024-03-01T00:00:00Z",
    "2026-02-01T00:00:00Z",
  ]) {
    const r = await report("venue", venue, 30, end);
    assert.equal(
      Date.parse(r.period.until) - Date.parse(r.period.current_from),
      30 * 86400000,
    );
    assert.equal(
      Date.parse(r.period.current_from) - Date.parse(r.period.previous_from),
      30 * 86400000,
    );
  }
});

test("aggregate counts remain complete above the REST row cap", async () => {
  await db.exec(
    `insert into booking_requests(venue_id,created_at,status) select '${venue}','2026-10-19','requested' from generate_series(1,10001)`,
  );
  const r = await report();
  assert.equal(
    r.bookings.find(
      (row) => row.period === "current" && row.status === "requested",
    ).total,
    10001,
  );
});
test("multiple explicit workspaces for one listing never duplicate its bookings", async () => {
  await db.exec(
    `insert into crm_workspaces values('same-source','${venue}','active');insert into operating_organisation_locations values('${org}','same-source');`,
  );
  const r = await report("organisation", org);
  assert.equal(r.coverage.measured_venues, 2);
  assert.equal(
    r.bookings.reduce((sum, row) => sum + row.total, 0),
    3,
  );
});

test("staged account completion restricts direct report and selector access", async () => {
  await db.query("select set_config('test.account_allowed','false',false)");
  await assert.rejects(report(), /Account completion required/);
  await assert.rejects(
    db.query("select * from akipulse_scopes('venue',51,0)"),
    /Account completion required/,
  );
});
test("absent onboarding rollout helper preserves existing authorised access", async () => {
  await db.exec("drop function public.account_features_allowed()");
  try {
    assert.equal((await report()).coverage.measured_venues, 1);
  } finally {
    await db.exec(
      "create function public.account_features_allowed() returns boolean language sql stable as $$ select current_setting('test.account_allowed',true) is distinct from 'false' $$;",
    );
  }
});

async function funnel(kind = "venue", id = venue, days = 7) {
  return (
    await db.query("select akipulse_business_funnel($1,$2,$3) r", [
      kind,
      id,
      days,
    ])
  ).rows[0].r;
}
test("funnel requires exact single mapping and live management, with honest unsupported scope coverage", async () => {
  await assert.rejects(funnel("venue", foreign), /management/);
  assert.equal(
    (await funnel("organisation", org)).reason,
    "scope_mapping_unsupported",
  );
  assert.equal((await funnel()).reason, "workspace_management_required");
  await db.exec(
    `insert into crm_workspace_members values('one','${owner}','active','manager')`,
  );
  assert.equal((await funnel()).reason, "stage_adapter_not_installed");
  await db.exec(
    `create function public.suite_business_funnel(w text,d integer) returns jsonb language sql stable as $$select jsonb_build_object('available',false,'reason','not_activated')$$`,
  );
  assert.deepEqual(await funnel(), {
    kind: "venue",
    id: venue,
    days: 7,
    funnel: { available: false, reason: "not_activated" },
  });
  await db.exec("set role anon");
  await assert.rejects(funnel(), /permission denied/);
  await db.exec("reset role;set role authenticated");
  assert.equal((await funnel()).funnel.reason, "not_activated");
  await db.exec(
    "reset role;update crm_workspace_members set status='inactive' where workspace_id='one'",
  );
  assert.equal((await funnel()).reason, "workspace_management_required");
  await db.exec(
    "update crm_workspace_members set status='active' where workspace_id='one'",
  );
  await db.exec(
    `insert into crm_workspaces values('duplicate','${venue}','active')`,
  );
  assert.equal((await funnel()).reason, "workspace_mapping_ambiguous");
  await db.exec(`delete from crm_workspaces where source_venue_id='${venue}'`);
  assert.equal((await funnel()).reason, "workspace_mapping_missing");
  await db.query("select set_config('test.account_allowed','false',false)");
  await assert.rejects(funnel(), /Account completion/);
});

test("nullable workspace access fails closed despite a stored manager membership", async () => {
  await db.exec(`insert into crm_workspace_members values('one','${owner}','active','manager');
    create or replace function public.crm_can_access_workspace(w text) returns boolean language sql stable as $$ select null::boolean $$;`);
  try {
    assert.equal((await funnel()).reason, "workspace_management_required");
  } finally {
    await db.exec(
      `create or replace function public.crm_can_access_workspace(w text) returns boolean language sql stable as $$ select exists(select 1 from public.crm_workspace_members where workspace_id=w and profile_id=auth.uid() and status='active') $$;`,
    );
  }
});

test("shared projection retains the real caller and selected scope instead of impersonating an owner", async () => {
  await db.exec(`insert into crm_workspace_members values('two','${owner}','active','admin');
    create or replace function public.suite_business_funnel(w text,d integer) returns jsonb language plpgsql stable as $$ begin
      if auth.uid() is distinct from '${owner}'::uuid or w <> 'two' or d <> 30 then raise exception 'Incorrect caller or scope'; end if;
      return jsonb_build_object('available',false,'reason','not_activated'); end $$;`);
  assert.deepEqual(await funnel("property", property, 30), {
    kind: "property",
    id: property,
    days: 30,
    funnel: { available: false, reason: "not_activated" },
  });
  await actor(other);
  await assert.rejects(funnel("property", property, 30), /management/);
});

async function nativeSetup() {
  await db.exec(`insert into crm_workspace_members values('unlinked','${owner}','active','manager');
 insert into accommodation_properties values('${property}','Native private property','unlinked','${owner}'),('${foreign}','Foreign native','foreign','${other}');
 insert into accommodation_property_units(property_id,active) values('${property}',true),('${property}',false),('${foreign}',true);
 insert into accommodation_property_reservations(property_id,created_at,status,contact_email) values('${property}','2026-10-19','confirmed','secret@example.invalid'),('${property}','2026-10-06','cancelled','secret@example.invalid'),('${property}','2026-10-20','requested','secret@example.invalid'),('${foreign}','2026-10-19','confirmed','foreign@example.invalid');`);
}
async function v2(
  kind = "native_property",
  id = property,
  days = 7,
  end = until,
) {
  return (
    await db.query("select akipulse_scope_analytics_v2($1,$2,$3,$4) r", [
      kind,
      id,
      days,
      end,
    ])
  ).rows[0].r;
}
test("native property scopes keep their UUID identity and report only authorized bounded cohorts", async () => {
  await nativeSetup();
  const scopes = (
    await db.query("select * from akipulse_scopes_v2('native_property',51,0)")
  ).rows;
  assert.deepEqual(scopes, [{ id: property, name: "Native private property" }]);
  const r = await v2();
  assert.equal(r.kind, "native_property");
  assert.equal(r.id, property);
  assert.equal(r.coverage.measured_venues, 0);
  assert.equal(r.coverage.measured_native_properties, 1);
  assert.equal(r.coverage.current_active_units, 1);
  assert.deepEqual(r.bookings, [
    {
      source: "native_accommodation",
      period: "current",
      status: "confirmed",
      total: 1,
    },
    {
      source: "native_accommodation",
      period: "previous",
      status: "cancelled",
      total: 1,
    },
  ]);
  assert.equal(JSON.stringify(r).includes("secret@example.invalid"), false);
  assert.equal(r.revenue_available, false);
  await assert.rejects(v2("native_property", foreign), /manager/);
  for (const days of [0, 6, 91, null])
    await assert.rejects(v2("native_property", property, days), /Invalid/);
  await db.exec("set role anon");
  await assert.rejects(v2(), /permission denied/);
  await db.exec("reset role;set role authenticated");
  assert.equal((await v2()).coverage.current_active_units, 1);
  await assert.rejects(
    db.query("select * from accommodation_property_reservations"),
    /permission denied/,
  );
});
test("native readiness, membership removal and index absence fail closed without fabricated zero activity", async () => {
  await nativeSetup();
  await db.query("select set_config('test.native_ready','false',false)");
  assert.deepEqual(
    (await db.query("select * from akipulse_scopes_v2('native_property',51,0)"))
      .rows,
    [],
  );
  await assert.rejects(v2(), /manager/);
  await db.query("select set_config('test.native_ready','true',false)");
  await db.exec(
    "update crm_workspace_members set status='inactive' where workspace_id='unlinked'",
  );
  await assert.rejects(v2(), /manager/);
  await db.exec(
    "update crm_workspace_members set status='active' where workspace_id='unlinked';drop index pulse_native_reservations_time",
  );
  try {
    await assert.rejects(v2(), /not installed/);
  } finally {
    await db.exec(
      "create index pulse_native_reservations_time on accommodation_property_reservations(property_id,created_at)",
    );
  }
});
test("organisation native cohorts use only explicit links and intersect both property and workspace permissions", async () => {
  await nativeSetup();
  let r = await v2("organisation", org);
  assert.equal(r.coverage.measured_native_properties, 1);
  assert.equal(r.coverage.excluded_locations, 1);
  assert.equal(r.coverage.current_active_units, 2);
  assert.equal(
    r.bookings
      .filter((x) => x.source === "native_accommodation")
      .reduce((n, x) => n + x.total, 0),
    2,
  );
  await db.exec(
    `insert into accommodation_properties values('90000000-0000-4000-8000-000000000001','Same owner unrelated',null,'${owner}');insert into accommodation_property_reservations(property_id,created_at,status) values('90000000-0000-4000-8000-000000000001','2026-10-19','confirmed')`,
  );
  assert.equal(
    (await v2("organisation", org)).coverage.measured_native_properties,
    1,
  );
  await db.exec(
    "update crm_workspace_members set role='staff' where workspace_id='unlinked'",
  );
  r = await v2("organisation", org);
  assert.equal(r.coverage.measured_native_properties, 0);
  assert.equal(r.coverage.excluded_native_properties, 2);
  assert.equal(r.coverage.excluded_locations, 2);
  await db.exec(
    `insert into accommodation_properties(id,name,workspace_id,owner_profile_id) select gen_random_uuid(),'Many','unlinked','${owner}' from generate_series(1,100)`,
  );
  await assert.rejects(
    v2("organisation", org),
    /exceeds native property report scope/,
  );
});
test("native cohorts remain complete beyond REST caps and exact at DST/leap/month UTC boundaries", async () => {
  await nativeSetup();
  await db.exec(
    `insert into accommodation_property_reservations(property_id,created_at,status) select '${property}','2026-10-19','requested' from generate_series(1,10001)`,
  );
  assert.equal(
    (await v2()).bookings.find(
      (x) => x.period === "current" && x.status === "requested",
    ).total,
    10001,
  );
  for (const end of [
    "2026-03-30T00:00:00Z",
    "2024-03-01T00:00:00Z",
    "2026-02-01T00:00:00Z",
  ]) {
    const r = await v2("native_property", property, 30, end);
    assert.equal(
      Date.parse(r.period.until) - Date.parse(r.period.current_from),
      30 * 86400000,
    );
  }
});
test("organisation commercial facts deduplicate shared venue claims and exclude inactive/foreign workspace facts", async () => {
  await db.exec(`insert into crm_workspace_members values('one','${owner}','active','manager'),('two','${owner}','active','admin');
 insert into crm_workspaces values('same-source','${venue}','active');insert into operating_organisation_locations values('${org}','same-source');insert into crm_workspace_members values('same-source','${owner}','active','manager');`);
  const query = () =>
    db
      .query("select akipulse_organisation_funnel($1,30) r", [org])
      .then((x) => x.rows[0].r);
  assert.equal((await query()).reason, "not_activated");
  await db.exec(`update suite_funnel_private.settings set enabled=true,enabled_since=now()-interval '10 days',retention_days=30;
 insert into suite_funnel_private.stages values('claim_completed','claim:1','${owner}',null,'${venue}',now()),('payment_verified','invoice:1','${owner}','one',null,now()),('payment_verified','invoice:2','${owner}','two',null,now()),('payment_verified','foreign:1','${other}','foreign',null,now()),('payment_verified','consent:1','${other}','one',null,now());`);
  let r = await query();
  assert.equal(r.scope, "organisation");
  assert.equal(r.stages.claim_completed, 1);
  assert.equal(r.stages.payment_verified, 2);
  assert.deepEqual(r.organisation_coverage, {
    included_workspaces: 3,
    excluded_workspaces: 2,
  });
  assert.equal(JSON.stringify(r).includes("invoice:"), false);
  await db.exec(
    "update crm_workspace_members set status='inactive' where workspace_id='two'",
  );
  r = await query();
  assert.equal(r.stages.payment_verified, 1);
  assert.equal(r.organisation_coverage.excluded_workspaces, 3);
  await actor(other);
  await assert.rejects(query(), /Organisation manager/);
  await actor();
  await db.query("select set_config('test.account_allowed','false',false)");
  await assert.rejects(query(), /Organisation manager/);
});
test("organisation funnel validates periods and location cap independently of browser selectors", async () => {
  await assert.rejects(
    db.query("select akipulse_organisation_funnel($1,91)", [org]),
    /Invalid period/,
  );
  await db.exec(
    `insert into operating_organisation_locations select '${org}','extra'||g from generate_series(1,100)g`,
  );
  await assert.rejects(
    db.query("select akipulse_organisation_funnel($1,30)", [org]),
    /exceeds report scope/,
  );
});
test("native and rental funnel adapters never infer unrelated owner workspaces or archived rental links", async () => {
  await nativeSetup();
  await db.exec(
    `create or replace function public.suite_business_funnel(w text,d integer) returns jsonb language sql stable as $$select jsonb_build_object('available',false,'reason','not_activated')$$;alter table car_rental_companies add column if not exists venue_id uuid;`,
  );
  const call = (kind, id) =>
    db
      .query("select akipulse_business_funnel_v2($1,$2,7) r", [kind, id])
      .then((x) => x.rows[0].r);
  assert.equal(
    (await call("native_property", property)).funnel.reason,
    "not_activated",
  );
  await db.exec("update accommodation_properties set workspace_id=null");
  assert.equal(
    (await call("native_property", property)).reason,
    "workspace_mapping_missing",
  );
  assert.equal(
    (await call("fleet", fleet)).reason,
    "workspace_mapping_missing",
  );
  await db.exec(
    `update car_rental_companies set venue_id='${venue}' where id='${fleet}';insert into crm_workspace_members values('one','${owner}','active','manager')`,
  );
  assert.equal((await call("fleet", fleet)).funnel.reason, "not_activated");
  await actor(other);
  await assert.rejects(call("fleet", fleet), /Branch manager/);
});

test("explicit rental mapping requires ownership of both resources and active owner membership", async () => {
  await db.exec(
    `insert into crm_workspace_members values('unlinked','${owner}','active','owner'),('one','${owner}','active','manager')`,
  );
  const opts = () =>
    db
      .query("select akipulse_rental_workspace_options($1,51,0) r", [fleet])
      .then((x) => x.rows[0].r);
  let o = await opts();
  assert.equal(o.can_link, true);
  assert.equal(o.has_link, false);
  assert.deepEqual(
    o.options.map((x) => x.id),
    ["unlinked"],
  );
  await assert.rejects(
    db.query("select set_akipulse_rental_workspace($1,$2)", [fleet, "foreign"]),
    /workspace owner/,
  );
  await assert.rejects(
    db.query("select set_akipulse_rental_workspace($1,$2)", [fleet, "one"]),
    /workspace owner/,
  );
  await db.query("select set_akipulse_rental_workspace($1,$2)", [
    fleet,
    "unlinked",
  ]);
  o = await opts();
  assert.equal(o.current.id, "unlinked");
  await db.query("select set_akipulse_rental_workspace($1,$2)", [
    fleet,
    "unlinked",
  ]);
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from akipulse_private.rental_link_audit",
      )
    ).rows[0].n,
    1,
  );
  await actor(other);
  await assert.rejects(opts(), /Branch manager/);
  await assert.rejects(
    db.query("select set_akipulse_rental_workspace($1,$2)", [fleet, "foreign"]),
    /Branch owner/,
  );
  await actor();
  await db.exec(
    "update crm_workspace_members set status='inactive' where workspace_id='unlinked'",
  );
  await assert.rejects(
    db.query("select set_akipulse_rental_workspace($1,$2)", [
      fleet,
      "unlinked",
    ]),
    /workspace owner/,
  );
  await db.query("select set_akipulse_rental_workspace($1,null)", [fleet]);
  assert.equal((await opts()).has_link, false);
  await db.exec("set role authenticated");
  await assert.rejects(
    db.query("select * from akipulse_rental_workspaces"),
    /permission denied/,
  );
  await assert.rejects(
    db.query("select * from akipulse_private.rental_link_audit"),
    /permission denied/,
  );
  await db.exec("reset role");
  await assert.rejects(
    db.query("delete from akipulse_private.rental_link_audit"),
    /Immutable/,
  );
});
test("explicit rental organisation cohorts preserve independent IDs and intersect every linked branch permission", async () => {
  await nativeSetup();
  await db.exec(
    "update crm_workspace_members set role='owner' where workspace_id='unlinked'",
  );
  await db.query("select set_akipulse_rental_workspace($1,$2)", [
    fleet,
    "unlinked",
  ]);
  let r = await v2("organisation", org);
  assert.equal(r.coverage.measured_rental_branches, 1);
  assert.equal(r.coverage.measured_native_properties, 1);
  assert.equal(r.coverage.excluded_locations, 1);
  assert.equal(r.coverage.current_active_vehicles, 1);
  assert.equal(r.bookings.find((x) => x.source === "fleet").total, 1);
  await db.exec("update accommodation_properties set workspace_id=null");
  r = await v2("organisation", org);
  assert.equal(r.coverage.excluded_locations, 1);
  await db.exec(
    "update crm_workspace_members set status='inactive' where workspace_id='unlinked'",
  );
  r = await v2("organisation", org);
  assert.equal(r.coverage.measured_rental_branches, 0);
  assert.equal(r.coverage.excluded_rental_branches, 1);
  assert.equal(r.coverage.excluded_locations, 2);
  assert.equal(
    r.bookings.some((x) => x.source === "fleet"),
    false,
  );
});

test("rental link audit permits only cascading identity anonymisation while retaining management evidence", async () => {
  await db.exec(
    `insert into crm_workspace_members values('unlinked','${owner}','active','owner')`,
  );
  await db.query("select set_akipulse_rental_workspace($1,$2)", [
    fleet,
    "unlinked",
  ]);
  await db.exec("begin");
  try {
    await db.query("delete from profiles where id=$1", [owner]);
    assert.equal(
      (await db.query("select actor from akipulse_private.rental_link_audit"))
        .rows[0].actor,
      null,
    );
    assert.equal(
      (await db.query("select linked_by from akipulse_rental_workspaces"))
        .rows[0].linked_by,
      null,
    );
  } finally {
    await db.exec("rollback");
  }
  await db.exec("set role authenticated");
  await assert.rejects(
    db.query("select akipulse_organisation_rental_report($1,now(),$2,$3)", [
      org,
      {},
      [],
    ]),
    /permission denied/,
  );
});

test("installed native schema with disabled database inventory is unavailable rather than zero activity", async () => {
  await nativeSetup();
  await db.exec(
    "update accommodation_property_private.launch_settings set inventory_enabled=false",
  );
  assert.deepEqual(
    (await db.query("select * from akipulse_scopes_v2('native_property',51,0)"))
      .rows,
    [],
  );
  await assert.rejects(v2(), /not active/);
  const r = await v2("organisation", org);
  assert.equal(r.coverage.native_reporting_available, false);
  assert.equal(r.coverage.measured_native_properties, undefined);
  assert.equal(
    r.bookings.some((x) => x.source === "native_accommodation"),
    false,
  );
});

test("organisation without explicit operating locations reports missing linkage, never inferred owner workspaces", async () => {
  await db.exec("delete from operating_organisation_locations");
  const r = (
    await db.query("select akipulse_organisation_funnel($1,30) r", [org])
  ).rows[0].r;
  assert.deepEqual(r, {
    available: false,
    reason: "organisation_mapping_missing",
  });
});

test("rental organisation fanout and owned-workspace pagination remain bounded", async () => {
  await db.exec(`insert into crm_workspace_members values('unlinked','${owner}','active','owner');
   insert into car_rental_companies(id,name,submitted_by) select gen_random_uuid(),'Owned branch','${owner}' from generate_series(1,101);
   insert into akipulse_rental_workspaces(company_id,workspace_id,linked_by) select id,'unlinked','${owner}' from car_rental_companies where name='Owned branch';`);
  await assert.rejects(
    v2("organisation", org),
    /exceeds rental branch report scope/,
  );
  await db.exec(`insert into crm_workspaces(id,name,status,owner_profile_id) select 'owned-'||g,'Owned workspace '||g,'active','${owner}' from generate_series(1,55)g;
   insert into crm_workspace_members select id,'${owner}','active','owner' from crm_workspaces where id like 'owned-%';`);
  const a = (
    await db.query("select akipulse_rental_workspace_options($1,51,0) r", [
      fleet,
    ])
  ).rows[0].r.options;
  const b = (
    await db.query("select akipulse_rental_workspace_options($1,51,50) r", [
      fleet,
    ])
  ).rows[0].r.options;
  assert.equal(a.length, 51);
  assert.equal(b.length, 6);
  assert.equal(new Set([...a.slice(0, 50), ...b].map((w) => w.id)).size, 56);
  await assert.rejects(
    db.query("select akipulse_rental_workspace_options($1,51,10001)", [fleet]),
    /Invalid page/,
  );
  await db.exec("set role anon");
  await assert.rejects(
    db.query("select akipulse_organisation_funnel($1,30)", [org]),
    /permission denied/,
  );
});

test("paused or restricted accounts can export only their own mapping activity without business access", async () => {
  await db.exec(
    `insert into crm_workspace_members values('unlinked','${owner}','active','owner');`,
  );
  await db.query("select set_akipulse_rental_workspace($1,$2)", [
    fleet,
    "unlinked",
  ]);
  await db.exec(
    `insert into akipulse_private.rental_link_audit(company_id,old_workspace,new_workspace,actor) values('${foreignFleet}',null,'foreign','${other}')`,
  );
  await db.query("select set_config('test.account_allowed','false',false)");
  await db.exec(
    "update crm_workspace_members set status='inactive';set role authenticated",
  );
  const query = (section, after = null, limit = 500) =>
    db
      .query("select my_pulse_management_export_page($1,$2,$3) r", [
        section,
        after,
        limit,
      ])
      .then((x) => x.rows[0].r);
  const links = await query("akipulse_rental_workspace_links");
  assert.equal(links.total, 1);
  assert.equal(links.rows[0].data.company_id, fleet);
  assert.equal(links.rows[0].data.linked_by_you, true);
  const audit = await query("akipulse_rental_link_audit");
  assert.equal(audit.total, 1);
  assert.equal(audit.rows[0].data.actor_is_you, true);
  assert.equal(JSON.stringify(audit).includes(foreignFleet), false);
  assert.equal(JSON.stringify(audit).includes(other), false);
  await actor(other);
  const own = await query("akipulse_rental_link_audit");
  assert.equal(own.total, 1);
  assert.equal(own.rows[0].data.company_id, foreignFleet);
  assert.equal((await query("akipulse_rental_workspace_links")).total, 0);
  await db.exec("reset role;set role anon");
  await assert.rejects(
    query("akipulse_rental_link_audit"),
    /permission denied/,
  );
  await db.exec("reset role;set role service_role");
  await assert.rejects(
    query("akipulse_rental_link_audit"),
    /permission denied/,
  );
});
test("own mapping audit export pages every retained row with strict cursors and no raw grant", async () => {
  await db.exec(
    `insert into akipulse_private.rental_link_audit(company_id,new_workspace,actor) select '${fleet}','unlinked','${owner}' from generate_series(1,1003)`,
  );
  let after = null,
    total = 0;
  const keys = new Set();
  for (let page = 0; page < 3; page++) {
    const r = (
      await db.query(
        "select my_pulse_management_export_page('akipulse_rental_link_audit',$1,500) r",
        [after],
      )
    ).rows[0].r;
    assert.equal(r.total, 1003);
    for (const row of r.rows) {
      assert.equal(keys.has(row.key), false);
      keys.add(row.key);
    }
    total += r.rows.length;
    after = r.next_cursor;
  }
  assert.equal(total, 1003);
  assert.equal(after, null);
  for (const limit of [0, 501, null])
    await assert.rejects(
      db.query(
        "select my_pulse_management_export_page('akipulse_rental_link_audit',null,$1)",
        [limit],
      ),
      /Invalid privacy/,
    );
  await assert.rejects(
    db.query(
      "select my_pulse_management_export_page('akipulse_rental_link_audit','unsafe''sql',500)",
    ),
    /Invalid privacy/,
  );
  await assert.rejects(
    db.query("select my_pulse_management_export_page('other_person')"),
    /Unknown privacy/,
  );
  await db.exec("set role authenticated");
  await assert.rejects(
    db.query("select * from akipulse_private.rental_link_audit"),
    /permission denied/,
  );
});
