import { afterEach, beforeEach, expect, it, vi } from "vitest";
const terms = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/accommodation-api-terms", () => ({
  accommodationApiTerms: terms,
}));
const db = vi.hoisted(() => ({
  auth: { getUser: vi.fn() },
  from: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("../src/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => db,
}));
import { GET, POST } from "../src/app/api/business/accommodations/route";
const property = "11111111-1111-4111-8111-111111111111";
const id = "22222222-2222-4222-8222-222222222222";
const call = (body: unknown, origin = "https://akihq.app") =>
  POST(
    new Request("https://akihq.app/api/business/accommodations", {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
function query(data: unknown = [{ id }], error: unknown = null) {
  const value = { data, error };
  const q: Record<string, unknown> = {};
  for (const method of [
    "select",
    "insert",
    "update",
    "upsert",
    "delete",
    "eq",
    "order",
    "limit",
    "range",
  ])
    q[method] = vi.fn(() => q);
  q.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(value).then(resolve);
  q.maybeSingle = vi.fn(async () => ({
    data: Array.isArray(data) ? (data[0] ?? null) : data,
    error,
  }));
  return q;
}
afterEach(() => vi.unstubAllEnvs());
beforeEach(() => {
  vi.stubEnv("AKISUITE_ACCOMMODATION_READY", "true");
  vi.stubEnv("AKISUITE_ACCOMMODATION_INVENTORY_READY", "true");
  vi.clearAllMocks();
  terms.mockResolvedValue(null);
  db.auth.getUser.mockResolvedValue({ data: { user: { id: "owner" } } });
  db.rpc.mockResolvedValue({ data: true, error: null });
  db.from.mockReturnValue(query());
});
it("rejects external origins and oversized streamed payloads before authentication", async () => {
  expect(
    (
      await call(
        { action: "create", name: "Private stay" },
        "https://other.invalid",
      )
    ).status,
  ).toBe(403);
  expect(
    (await call({ action: "create", name: "x".repeat(21000) })).status,
  ).toBe(413);
  expect(db.auth.getUser).not.toHaveBeenCalled();
});
it("denies anonymous reads and writes", async () => {
  db.auth.getUser.mockResolvedValue({ data: { user: null } });
  expect(
    (await GET(new Request("https://akihq.app/api/business/accommodations")))
      .status,
  ).toBe(401);
  expect((await call({ action: "create", name: "Private stay" })).status).toBe(
    401,
  );
  expect(db.from).not.toHaveBeenCalled();
  expect(db.rpc).not.toHaveBeenCalled();
});
it("creates through authoritative RPC without client-supplied owner/publication", async () => {
  db.rpc.mockResolvedValue({ data: property, error: null });
  expect(
    (await call({ action: "create", name: "Private stay", workspace: null }))
      .status,
  ).toBe(201);
  expect(db.rpc).toHaveBeenCalledWith("create_accommodation_property", {
    p_name: "Private stay",
    p_workspace: null,
  });
  expect(
    (
      await call({
        action: "create",
        name: "Private stay",
        owner_profile_id: id,
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await call({
        action: "create",
        name: "Private stay",
        status: "published",
      })
    ).status,
  ).toBe(400);
});
it("denies unknown or revoked property membership before any inventory write", async () => {
  db.rpc.mockResolvedValue({ data: false, error: null });
  expect(
    (
      await call({
        action: "unit",
        property,
        roomType: id,
        name: "101",
        active: true,
      })
    ).status,
  ).toBe(403);
  expect(db.from).not.toHaveBeenCalled();
  db.rpc.mockResolvedValue({ data: null, error: { message: "offline" } });
  expect(
    (
      await GET(
        new Request(
          `https://akihq.app/api/business/accommodations?property=${property}`,
        ),
      )
    ).status,
  ).toBe(503);
});
it("inserts independent units with property identity and no dummy venue", async () => {
  const q = query();
  db.from.mockReturnValue(q);
  expect(
    (
      await call({
        action: "unit",
        property,
        roomType: id,
        name: "101",
        active: true,
      })
    ).status,
  ).toBe(200);
  expect(q.insert).toHaveBeenCalledWith({
    property_id: property,
    room_type_id: id,
    name: "101",
    active: true,
  });
});
it("scopes updates and deletes by property and resource ID", async () => {
  const q = query();
  db.from.mockReturnValue(q);
  expect(
    (
      await call({
        action: "room_type",
        property,
        id,
        name: "Double",
        maxGuests: 2,
        active: true,
      })
    ).status,
  ).toBe(200);
  expect(q.eq).toHaveBeenCalledWith("property_id", property);
  expect(q.eq).toHaveBeenCalledWith("id", id);
  const empty = query([]);
  db.from.mockReturnValue(empty);
  expect((await call({ action: "remove_rate", property, id })).status).toBe(
    404,
  );
});
it("checks reservation membership before invoking the status transaction", async () => {
  db.from.mockReturnValue(query([]));
  expect(
    (
      await call({
        action: "status",
        property,
        reservation: id,
        status: "confirmed",
      })
    ).status,
  ).toBe(403);
  expect(db.rpc).not.toHaveBeenCalledWith(
    "accommodation_property_change_status",
    expect.anything(),
  );
});
it("retains section-specific unavailable reads instead of inventing empty inventory", async () => {
  db.from.mockImplementation((table: string) =>
    query(
      [],
      table === "accommodation_property_units" ? { message: "offline" } : null,
    ),
  );
  const response = await GET(
    new Request(
      `https://akihq.app/api/business/accommodations?property=${property}`,
    ),
  );
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.json()).toMatchObject({
    units: { error: "unavailable" },
    room_types: { rows: [] },
  });
});

it("denies missing current terms before inventory or media access", async () => {
  terms.mockResolvedValue("terms_required");
  const response = await GET(
    new Request(
      "https://akihq.app/api/business/accommodations?property=" + property,
    ),
  );
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ error: "terms_required" });
});

it("keeps independent API unavailable until migration gate is ready", async () => {
  vi.stubEnv("AKISUITE_ACCOMMODATION_READY", "false");
  expect(
    (await GET(new Request("https://akihq.app/api/business/accommodations")))
      .status,
  ).toBe(503);
  expect(db.auth.getUser).not.toHaveBeenCalled();
});

it("delegates explicit member grants to owner-only RPC without broad manager bypass", async () => {
  const response = await call({
    action: "member",
    property,
    profile: id,
    role: "manager",
  });
  expect(response.status).toBe(200);
  expect(db.rpc).toHaveBeenCalledWith("set_accommodation_property_member", {
    p_property: property,
    p_profile: id,
    p_role: "manager",
  });
  expect(db.rpc).not.toHaveBeenCalledWith(
    "can_manage_accommodation_property",
    expect.anything(),
  );
  db.rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
  expect(
    (await call({ action: "member", property, profile: id, role: null }))
      .status,
  ).toBe(403);
  expect(
    (await call({ action: "member", property, profile: id, role: "owner" }))
      .status,
  ).toBe(400);
});
it("bounds pagination and rejects arbitrary section tables", async () => {
  expect(
    (
      await GET(
        new Request(
          `https://akihq.app/api/business/accommodations?property=${property}&section=profiles`,
        ),
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await GET(
        new Request(`https://akihq.app/api/business/accommodations?page=101`),
      )
    ).status,
  ).toBe(400);
  const q = query(Array.from({ length: 101 }, () => ({ id })));
  db.from.mockReturnValue(q);
  const result = await GET(
    new Request(
      `https://akihq.app/api/business/accommodations?property=${property}&section=units&page=2`,
    ),
  );
  expect(q.range).toHaveBeenCalledWith(200, 300);
  expect(q.order).toHaveBeenCalledWith("id");
  expect((await result.json()).units).toMatchObject({ page: 2, hasMore: true });
});

it("never falls back to legacy venue inventory while the native inventory schema gate is closed", async () => {
  vi.stubEnv("AKISUITE_ACCOMMODATION_INVENTORY_READY", "false");
  expect(
    (
      await call({
        action: "room_type",
        property,
        name: "Double",
        maxGuests: 2,
        active: true,
      })
    ).status,
  ).toBe(503);
  expect(db.from).not.toHaveBeenCalled();
  expect(
    (
      await GET(
        new Request(
          `https://akihq.app/api/business/accommodations?property=${property}&section=units`,
        ),
      )
    ).status,
  ).toBe(503);
  expect(db.from).not.toHaveBeenCalled();
});
it("maps paginated native reads to distinct property tables", async () => {
  await GET(
    new Request(
      `https://akihq.app/api/business/accommodations?property=${property}&section=units`,
    ),
  );
  expect(db.from).toHaveBeenCalledWith("accommodation_property_units");
  expect(db.from).not.toHaveBeenCalledWith("accommodation_units");
});
