import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
let db: PGlite;
const owner = "10000000-0000-4000-8000-000000000001",
  other = "10000000-0000-4000-8000-000000000002",
  admin = "10000000-0000-4000-8000-000000000003";
const venue = "20000000-0000-4000-8000-000000000001",
  foreign = "20000000-0000-4000-8000-000000000002";
const migration =
  "supabase/migrations/20261020173020_analytics_events_least_privilege.sql";
async function role(value: string, id = "") {
  await db.exec("reset role");
  await db.query("select set_config('test.uid',$1,false)", [id]);
  await db.exec(`set role ${value}`);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;grant usage on schema auth to anon,authenticated,service_role;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create type app_role as enum('consumer','administrator');
 create type analytics_action as enum('venue_view','event_view','directions_click','booking_click','share');
 create table profiles(id uuid primary key,app_role app_role);
 create table venues(id uuid primary key);
 create table events(id uuid primary key);
 create table venue_members(venue_id uuid,profile_id uuid);
 create function is_venue_member(p_venue uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.venue_members where venue_id=p_venue and profile_id=auth.uid())$$;
 create function has_platform_role(p_roles app_role[]) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.profiles where id=auth.uid() and app_role=any(p_roles))$$;
 insert into profiles values('${owner}','consumer'),('${other}','consumer'),('${admin}','administrator');
 insert into venues values('${venue}'),('${foreign}');
 insert into venue_members values('${venue}','${owner}'),('${foreign}','${other}');
 `);
  const source = readFileSync(
    "database/migrations/0007_promotions_analytics.sql",
    "utf8",
  );
  const table = source.match(
    /create table analytics_events \([\s\S]*?\n\);/,
  )?.[0];
  const policy = source.match(
    /create policy analytics_operator_read[\s\S]*?;/,
  )?.[0];
  const recorder = source.match(
    /create or replace function record_analytics\([\s\S]*?\$\$;/,
  )?.[0];
  if (!table || !policy || !recorder)
    throw Error("Actual analytics source contract missing");
  await db.exec(
    table +
      "\nalter table analytics_events enable row level security;\n" +
      policy +
      "\n" +
      recorder,
  );
  await db.exec(
    readFileSync(
      "database/migrations/0079_rate_limit_public_analytics.sql",
      "utf8",
    ),
  );
  await db.exec(`grant all privileges on analytics_events to public,anon,authenticated,service_role;
 insert into analytics_events(action,venue_id) values('venue_view','${venue}'),('venue_view','${foreign}');`);
  // Execute the reproduced capability locally: RLS cannot stop an existing TRUNCATE grant.
  await db.exec("begin;set role anon;truncate analytics_events;reset role;");
  expect(
    (await db.query("select count(*)::int as n from analytics_events")).rows[0],
  ).toEqual({ n: 0 });
  await db.exec("rollback;");
  await db.exec(readFileSync(migration, "utf8"));
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe("actual analytics grants and roles", () => {
  it("denies anonymous table access and every direct mutation capability", async () => {
    for (const r of ["anon", "authenticated"])
      for (const privilege of [
        "INSERT",
        "UPDATE",
        "DELETE",
        "TRUNCATE",
        "REFERENCES",
        "TRIGGER",
      ])
        expect(
          (
            await db.query("select has_table_privilege($1,$2,$3) as allowed", [
              r,
              "public.analytics_events",
              privilege,
            ])
          ).rows[0],
        ).toEqual({ allowed: false });
    await role("anon");
    await expect(db.exec("select * from analytics_events")).rejects.toThrow(
      "permission denied",
    );
    await db.exec("reset role");
  });
  it("retains only authenticated RLS-scoped owner reads", async () => {
    await role("authenticated", owner);
    expect(
      (await db.query("select distinct venue_id from analytics_events")).rows,
    ).toEqual([{ venue_id: venue }]);
    await role("authenticated", other);
    expect(
      (await db.query("select distinct venue_id from analytics_events")).rows,
    ).toEqual([{ venue_id: foreign }]);
    await role("authenticated", "10000000-0000-4000-8000-000000000004");
    expect((await db.query("select * from analytics_events")).rows).toEqual([]);
    await role("authenticated", admin);
    expect(
      (await db.query("select * from analytics_events")).rows,
    ).toHaveLength(2);
    await db.exec("reset role");
  });
  it("cannot update, delete or truncate even as a permitted venue reader", async () => {
    await role("authenticated", owner);
    for (const sql of [
      "update analytics_events set metadata='{}'",
      "delete from analytics_events",
      "truncate analytics_events",
    ])
      await expect(db.exec(sql)).rejects.toThrow("permission denied");
    await db.exec("reset role");
    expect(
      (await db.query("select * from analytics_events")).rows,
    ).toHaveLength(2);
  });
  it("preserves checked service ingestion and authenticated definer recording", async () => {
    await role("service_role");
    await db.query(
      "select public.record_analytics_limited($1,$2,null,$3,null,$4,$5)",
      [
        "venue_view",
        venue,
        {},
        "30000000-0000-4000-8000-000000000001",
        "a".repeat(64),
      ],
    );
    await expect(
      db.query(
        "select public.record_analytics_limited($1,$2,null,$3,null,$4,$5)",
        [
          "venue_view",
          venue,
          {},
          "30000000-0000-4000-8000-000000000001",
          "bad",
        ],
      ),
    ).rejects.toThrow("analytics source required");
    await role("authenticated", owner);
    await db.query("select public.record_analytics($1,$2)", [
      "venue_view",
      venue,
    ]);
    await role("anon");
    await expect(
      db.query("select public.record_analytics($1,$2)", ["venue_view", venue]),
    ).rejects.toThrow("permission denied");
    await db.exec("reset role");
    expect(
      (await db.query("select * from analytics_events")).rows,
    ).toHaveLength(4);
  });
});
