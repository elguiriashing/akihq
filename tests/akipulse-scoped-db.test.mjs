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
  await db.exec(`create role anon; create role authenticated;create schema auth;create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
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
});
beforeEach(async () => {
  await db.exec(
    "reset role; truncate venues,venue_members,car_rental_companies,car_rental_vehicles,operating_organisations,operating_organisation_locations,crm_workspaces,booking_requests,accommodation_reservations,car_rental_bookings,accommodation_units,analytics_events restart identity;",
  );
  await actor();
  await db.query("select set_config('test.account_allowed','true',false)");
  await db.exec(`insert into venues values('${venue}','Owned venue','activities'),('${foreign}','Private foreign','activities'),('${property}','Owned property','accommodation');
 insert into venue_members values('${venue}','${owner}','owner'),('${property}','${owner}','manager'),('${foreign}','${other}','owner');
 insert into car_rental_companies values('${fleet}','Owned rental','${owner}'),('${foreignFleet}','Private rental','${other}');
 insert into car_rental_vehicles values('${fleet}','${fleet}',true),('${foreignFleet}','${foreignFleet}',true);
 insert into operating_organisations values('${org}','Owned organisation','active','${owner}');
 insert into crm_workspaces values('one','${venue}','active'),('two','${property}','active'),('foreign','${foreign}','active'),('unlinked',null,'active');
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
