import { beforeEach, it, expect, vi } from "vitest";
const { client } = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("../src/lib/supabase/server", () => ({
  createSupabaseServerClient: client,
}));
import { POST } from "../src/app/api/business/rental-media/route";
import { GET } from "../src/app/api/business/rental-bookings/route";
import { rentalImageType } from "../src/lib/rental-media";
const company = "11111111-1111-4111-8111-111111111111";
beforeEach(() => vi.resetAllMocks());
it("rejects SVG/script and accepts only bounded supported image signatures", () => {
  expect(
    rentalImageType(new TextEncoder().encode('<svg onload="evil()"/>')),
  ).toBeNull();
  expect(
    rentalImageType(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))?.type,
  ).toBe("image/png");
});
it("refuses a media upload before Storage access for another branch", async () => {
  const storage = vi.fn();
  client.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: "other" } } }) },
    rpc: async () => ({ data: false, error: null }),
    storage: { from: storage },
  });
  const data = new FormData();
  data.set("companyId", company);
  data.set(
    "file",
    new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "car.png", {
      type: "image/png",
    }),
  );
  const response = await POST(
    new Request("https://akibusiness.com/api/business/rental-media", {
      method: "POST",
      headers: { origin: "https://akibusiness.com" },
      body: data,
    }),
  );
  expect(response.status).toBe(403);
  expect(storage).not.toHaveBeenCalled();
});
it("refuses cross-branch booking details before querying contact data", async () => {
  const from = vi.fn();
  client.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: "other" } } }) },
    rpc: async () => ({ data: false, error: null }),
    from,
  });
  expect(
    (
      await GET(
        new Request(
          "https://akibusiness.com/api/business/rental-bookings?company=" +
            company,
        ),
      )
    ).status,
  ).toBe(403);
  expect(from).not.toHaveBeenCalled();
});
it("scopes pages to the selected branch and returns complete contacts with private caching", async () => {
  const rows = [
    {
      id: "fixture",
      contact_email: "guest@example.test",
      contact_phone: "+34 600 123 456",
      note: "Child seat",
    },
  ];
  const q = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({ data: rows, count: 17, error: null }),
  };
  client.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
    rpc: async (name: string) => ({
      data: name === "can_manage_rental_company" ? true : { current: 1 },
      error: null,
    }),
    from: () => q,
  });
  const response = await GET(
    new Request(
      "https://akibusiness.com/api/business/rental-bookings?company=" +
        company +
        "&page=2",
    ),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(q.eq).toHaveBeenCalledWith("vehicle.company_id", company);
  expect(q.range).toHaveBeenCalledWith(8, 15);
  expect((await response.json()).rows).toEqual(rows);
});
