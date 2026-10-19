import { beforeEach, describe, expect, it, vi } from "vitest";
import { businessRoute } from "../src/lib/business-routing";

const fixture = vi.hoisted(() => ({
  row: {
    id: "11111111-1111-4111-8111-111111111111",
    slug: "test-stay",
    name: "Test stay",
    address: "Málaga, EspaÒ±a",
    discovery_vertical: "accommodation",
  },
  result: {} as { data: unknown; error: unknown },
  ownership: {} as { data: unknown; error: unknown },
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("../src/lib/supabase/public", () => ({
  createSupabasePublicClient: () => ({
    from: fixture.from,
    rpc: fixture.rpc,
  }),
}));

import { GET } from "../src/app/api/business/claim-venue/[id]/route";

async function lookup(id = fixture.row.id) {
  return GET(
    new Request(`https://akibusiness.com/api/business/claim-venue/${id}`),
    {
      params: Promise.resolve({ id }),
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  fixture.result = { data: fixture.row, error: null };
  fixture.ownership = { data: false, error: null };
  const query = {
    select: fixture.select,
    eq: fixture.eq,
    maybeSingle: () => Promise.resolve(fixture.result),
  };
  fixture.from.mockReturnValue(query);
  fixture.select.mockReturnValue(query);
  fixture.eq.mockReturnValue(query);
  fixture.rpc.mockImplementation(() => Promise.resolve(fixture.ownership));
});

describe("independent claim deep-link lookup", () => {
  it("keeps the lookup inside the management API boundary", () => {
    expect(
      businessRoute(`/api/business/claim-venue/${fixture.row.id}`).kind,
    ).toBe("local");
    expect(businessRoute(`/api/map/venue/${fixture.row.id}`).kind).toBe(
      "reject",
    );
  });

  it("restores the published accommodation name and vertical without owner details", async () => {
    const response = await lookup();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      id: fixture.row.id,
      slug: "test-stay",
      name: "Test stay",
      address: "Málaga, España",
      discoveryVertical: "accommodation",
      claimStatus: "unclaimed",
    });
    expect(fixture.eq).toHaveBeenCalledWith("status", "published");
    expect(fixture.rpc).toHaveBeenCalledWith("public_venue_is_claimed", {
      p_venue: fixture.row.id,
    });
  });

  it("uses actual claim ownership rather than editable venue accessibility", async () => {
    fixture.ownership = { data: true, error: null };
    expect(await (await lookup()).json()).toMatchObject({
      claimStatus: "claimed",
    });
  });

  it("rejects malformed identifiers before any catalogue read", async () => {
    expect((await lookup("not-an-id")).status).toBe(400);
    expect(fixture.from).not.toHaveBeenCalled();
  });

  it("withholds unpublished/missing venues and read failures", async () => {
    fixture.result = { data: null, error: null };
    expect((await lookup()).status).toBe(404);
    fixture.result = { data: null, error: { message: "unavailable" } };
    expect((await lookup()).status).toBe(503);
    expect(fixture.rpc).not.toHaveBeenCalled();
  });

  it.each([
    { data: null, error: null },
    { data: false, error: { message: "unavailable" } },
  ])("fails closed when claimability is unknown: %j", async (ownership) => {
    fixture.ownership = ownership;
    const response = await lookup();
    expect(response.status).toBe(503);
    expect(await response.json()).not.toHaveProperty("claimStatus");
  });
});
