import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";
const migration = readFileSync(
  "supabase/migrations/20261020184245_spatial_reference_read_only.sql",
  "utf8",
);
let db: PGlite;
async function asRole(role: string) {
  await db.exec(`reset role;set role ${role}`);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role supabase_admin;create role anon;create role authenticated;create role service_role;create role maintenance;create role alternate;
 create table public.spatial_ref_sys(srid integer primary key,auth_name text,auth_srid integer,srtext text,proj4text text);
 insert into public.spatial_ref_sys values(4326,'EPSG',4326,'WGS 84 fixture','+proj=longlat +datum=WGS84 +no_defs');
 alter table public.spatial_ref_sys owner to supabase_admin;
 grant all privileges on public.spatial_ref_sys to public,anon,authenticated,service_role,maintenance;
 grant update(srtext) on public.spatial_ref_sys to anon,authenticated;`);
  // Reproduce the destructive capability only in this disposable database.
  await db.exec(
    "begin;set role anon;update public.spatial_ref_sys set srtext='corrupted';reset role;",
  );
  expect(
    (
      await db.query<{ srtext: string }>(
        "select srtext from public.spatial_ref_sys",
      )
    ).rows[0].srtext,
  ).toBe("corrupted");
  await db.exec(
    "rollback;begin;set role authenticated;truncate only public.spatial_ref_sys;reset role;",
  );
  expect(
    (
      await db.query<{ count: number }>(
        "select count(*)::int count from public.spatial_ref_sys",
      )
    ).rows[0].count,
  ).toBe(0);
  await db.exec("rollback");
  // A non-owner without grant options can issue warnings instead of revocations.
  await asRole("maintenance");
  await expect(db.exec(migration)).rejects.toThrow(
    /read-only repair did not take effect/,
  );
  await db.exec("rollback;reset role");
  // An unexpected inherited grant also fails the repair atomically, not silently.
  await db.exec(
    "grant update on public.spatial_ref_sys to alternate;grant alternate to anon",
  );
  await expect(db.exec(migration)).rejects.toThrow(
    /read-only repair did not take effect/,
  );
  await db.exec("rollback;reset role;revoke alternate from anon");
  await db.exec(migration);
}, 30000);
afterAll(async () => db?.close());
it("keeps the SQL copies identical and changes no extension/RLS/default role policy", () => {
  expect(migration).toBe(
    readFileSync(
      "database/migrations/20261020184245_spatial_reference_read_only.sql",
      "utf8",
    ),
  );
  expect(migration).not.toMatch(
    /alter\s+(?:extension|default\s+privileges)|enable\s+row\s+level|owner\s+to|set\s+schema/i,
  );
});
it.each(["anon", "authenticated"])(
  "retains geography lookup for %s with no effective mutation privilege",
  async (role) => {
    await asRole(role);
    expect(
      (
        await db.query(
          "select srid,auth_name,auth_srid,srtext from public.spatial_ref_sys where srid=4326",
        )
      ).rows,
    ).toEqual([
      {
        srid: 4326,
        auth_name: "EPSG",
        auth_srid: 4326,
        srtext: "WGS 84 fixture",
      },
    ]);
    for (const capability of [
      "INSERT",
      "UPDATE",
      "DELETE",
      "TRUNCATE",
      "REFERENCES",
      "TRIGGER",
    ])
      expect(
        (
          await db.query<{ allowed: boolean }>(
            "select has_table_privilege($1,$2,$3) allowed",
            [role, "public.spatial_ref_sys", capability],
          )
        ).rows[0].allowed,
      ).toBe(false);
    for (const capability of ["INSERT", "UPDATE", "REFERENCES"])
      expect(
        (
          await db.query<{ allowed: boolean }>(
            "select has_any_column_privilege($1,$2,$3) allowed",
            [role, "public.spatial_ref_sys", capability],
          )
        ).rows[0].allowed,
      ).toBe(false);
  },
);
it.each(["anon", "authenticated"])(
  "denies qualified, aliased, upsert and truncate mutations by %s",
  async (role) => {
    await asRole(role);
    for (const sql of [
      "insert into public.spatial_ref_sys values(9999,'TEST',9999,'injected','injected')",
      "insert into public.spatial_ref_sys(srid,srtext)values(4326,'changed')on conflict(srid)do update set srtext=excluded.srtext",
      "update public.spatial_ref_sys as ref set srtext='changed' where ref.srid=4326",
      "delete from public.spatial_ref_sys where srid=4326",
      "truncate only public.spatial_ref_sys restart identity cascade",
    ])
      await expect(db.exec(sql)).rejects.toThrow(/permission denied/);
  },
);
it("preserves service privileges, owner, existing lookup rows and disabled RLS", async () => {
  await asRole("service_role");
  for (const capability of [
    "SELECT",
    "INSERT",
    "UPDATE",
    "DELETE",
    "TRUNCATE",
    "REFERENCES",
    "TRIGGER",
  ])
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select has_table_privilege($1,$2,$3)allowed",
          ["service_role", "public.spatial_ref_sys", capability],
        )
      ).rows[0].allowed,
    ).toBe(true);
  await db.exec(
    "insert into public.spatial_ref_sys values(9999,'SERVICE',9999,'temporary','temporary');delete from public.spatial_ref_sys where srid=9999",
  );
  await db.exec("reset role");
  expect(
    (
      await db.query(
        "select pg_get_userbyid(relowner) owner,relrowsecurity from pg_class where oid='public.spatial_ref_sys'::regclass",
      )
    ).rows,
  ).toEqual([{ owner: "supabase_admin", relrowsecurity: false }]);
  expect(
    (await db.query("select srid from public.spatial_ref_sys")).rows,
  ).toEqual([{ srid: 4326 }]);
  expect(
    (
      await db.query(
        "select count(*)::int public_grants from pg_class c, lateral aclexplode(c.relacl) a where c.oid='public.spatial_ref_sys'::regclass and a.grantee=0",
      )
    ).rows,
  ).toEqual([{ public_grants: 0 }]);
});
