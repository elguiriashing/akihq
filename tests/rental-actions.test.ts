import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../src/lib/auth", () => ({ requireUser: mocks.requireUser }));
import {
  updateRentalVehicle,
  removeRentalBlock,
} from "../src/app/[locale]/business/mobility/actions";
const company = "11111111-1111-4111-8111-111111111111",
  vehicle = "22222222-2222-4222-8222-222222222222",
  block = "33333333-3333-4333-8333-333333333333";
function form(values: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}
beforeEach(() => vi.resetAllMocks());
describe("rental manager mutations", () => {
  it("rejects invalid specifications before database access", async () => {
    await expect(
      updateRentalVehicle(
        form({
          companyId: company,
          vehicleId: vehicle,
          dailyPrice: "110",
          deposit: "50",
          active: "true",
          seats: "1",
        }),
      ),
    ).rejects.toThrow("error=vehicle");
    expect(mocks.requireUser).not.toHaveBeenCalled();
  });
  it("persists validated details inside the selected company/vehicle scope", async () => {
    const query = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: (resolve: (r: unknown) => void) => resolve({ error: null }),
    };
    mocks.requireUser.mockResolvedValue({
      supabase: { from: vi.fn(() => query) },
      user: { id: "owner" },
    });
    await expect(
      updateRentalVehicle(
        form({
          companyId: company,
          vehicleId: vehicle,
          dailyPrice: "110",
          deposit: "50",
          active: "true",
          name: "Coast Runner",
          category: "compact",
          transmission: "automatic",
          fuel: "hybrid",
          seats: "5",
          luggage: "3",
        }),
      ),
    ).rejects.toThrow("updated=vehicle");
    expect(query.update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Coast Runner",
        seats: 5,
        luggage: 3,
        daily_price_cents: 11000,
      }),
    );
    expect(query.eq).toHaveBeenCalledWith("id", vehicle);
    expect(query.eq).toHaveBeenCalledWith("company_id", company);
  });
  it("cannot reopen a block without company ownership", async () => {
    const remove = vi.fn();
    const q = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    };
    mocks.requireUser.mockResolvedValue({
      supabase: {
        rpc: vi.fn().mockResolvedValue({ data: false }),
        from: vi.fn(() => ({ ...q, delete: remove })),
      },
      user: { id: "unrelated" },
    });
    await expect(
      removeRentalBlock(
        form({ companyId: company, vehicleId: vehicle, blockId: block }),
      ),
    ).rejects.toThrow("error=availability");
    expect(remove).not.toHaveBeenCalled();
    expect(q.eq).not.toHaveBeenCalled();
  });
  it("reopens only maintenance blocks for the owned vehicle", async () => {
    const eq = vi.fn().mockReturnThis();
    const q = {
      select: vi.fn().mockReturnThis(),
      eq,
      delete: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: { id: vehicle }, error: null }),
    };
    mocks.requireUser.mockResolvedValue({
      supabase: {
        rpc: vi.fn().mockResolvedValue({ data: true }),
        from: vi.fn(() => q),
      },
      user: { id: "owner" },
    });
    await expect(
      removeRentalBlock(
        form({ companyId: company, vehicleId: vehicle, blockId: block }),
      ),
    ).rejects.toThrow("updated=availability");
    expect(eq).toHaveBeenCalledWith("reason", "maintenance");
    expect(eq).toHaveBeenCalledWith("id", block);
    expect(eq).toHaveBeenCalledWith("vehicle_id", vehicle);
  });
});
