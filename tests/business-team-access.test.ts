import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), redirect: vi.fn() }));
vi.mock("../src/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import {
  requireBusinessAccess,
  requireBusinessProAccess,
} from "../src/lib/entitlements";

function fixture(
  role = "consumer",
  teamRole: string | null = null,
  active = false,
  error = false,
) {
  const eq = vi.fn().mockReturnThis();
  const inRoles = vi.fn().mockReturnThis();
  const membership = {
    select: vi.fn().mockReturnThis(),
    eq,
    in: inRoles,
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: teamRole ? { venue_id: "venue" } : null,
      error: error ? { message: "unavailable" } : null,
    }),
  };
  const supabase = {
    from: vi.fn((table: string) =>
      table === "profiles"
        ? {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi
              .fn()
              .mockResolvedValue({ data: { app_role: role } }),
          }
        : membership,
    ),
    rpc: vi.fn().mockResolvedValue({ data: active, error: null }),
  };
  const context = { supabase, user: { id: "current-user" } };
  mocks.requireUser.mockResolvedValue(context);
  return { context, membership, supabase };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.redirect.mockImplementation((path: string) => {
    throw new Error(`redirect:${path}`);
  });
});
describe("AkiBusiness team access", () => {
  it.each(["es", "en"] as const)(
    "admits consumer editors, managers and owners without a personal plan in %s",
    async (locale) => {
      for (const role of ["editor", "manager", "owner"]) {
        const { context, membership, supabase } = fixture("consumer", role);
        expect(await requireBusinessAccess(locale)).toBe(context);
        expect(membership.eq).toHaveBeenCalledWith(
          "profile_id",
          "current-user",
        );
        expect(membership.in).toHaveBeenCalledWith("role", [
          "editor",
          "manager",
          "owner",
        ]);
        expect(supabase.rpc).not.toHaveBeenCalled();
      }
    },
  );
  it("requires sign-in and accepted terms through the existing user guard", async () => {
    fixture("consumer", "editor");
    mocks.requireUser.mockRejectedValueOnce(new Error("auth-required"));
    await expect(
      requireBusinessAccess("en", "/en/business/venue/venue"),
    ).rejects.toThrow("auth-required");
    expect(mocks.requireUser).toHaveBeenCalledWith(
      "en",
      "/en/business/venue/venue",
    );
  });
  it("denies removed or unrelated members and fails closed on membership read errors", async () => {
    for (const failedRead of [false, true]) {
      fixture("consumer", failedRead ? "editor" : null, false, failedRead);
      await expect(requireBusinessAccess("en")).rejects.toThrow(
        "business_required",
      );
    }
  });
  it("retains paid access for accounts without team membership", async () => {
    const { context, supabase } = fixture("organiser", null, true);
    expect(await requireBusinessAccess("es")).toBe(context);
    expect(supabase.rpc).toHaveBeenCalledWith("has_active_entitlement", {
      p_profile: "current-user",
      p_plan: "business",
    });
  });
  it("does not turn team access into a Pro entitlement", async () => {
    const { supabase } = fixture("consumer", "editor");
    await expect(requireBusinessProAccess("en")).rejects.toThrow(
      "business_pro_required",
    );
    expect(supabase.rpc).toHaveBeenCalledWith("has_active_entitlement", {
      p_profile: "current-user",
      p_plan: "business_pro",
    });
  });
  it.each(["moderator", "administrator"])(
    "preserves %s access",
    async (role) => {
      const { context, supabase } = fixture(role);
      expect(await requireBusinessAccess("en")).toBe(context);
      expect(supabase.from).toHaveBeenCalledTimes(1);
    },
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});
describe("free management home", () => {
  it("admits a signed-in private branch owner or new user without a paid entitlement", async () => {
    vi.stubEnv("NEXT_PUBLIC_AKISUITE_ROLE_SWAP", "true");
    vi.resetModules();
    const { context, supabase } = fixture("consumer");
    const {
      requireManagementHomeAccess,
      requireBusinessAccess: guardedMutation,
    } = await import("../src/lib/entitlements");
    expect(await requireManagementHomeAccess("en")).toBe(context);
    expect(supabase.from).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
    await expect(guardedMutation("en")).rejects.toThrow("business_required");
  });
  it("keeps legacy home access unchanged before cutover", async () => {
    vi.stubEnv("NEXT_PUBLIC_AKISUITE_ROLE_SWAP", "false");
    vi.resetModules();
    fixture("consumer");
    const { requireManagementHomeAccess } = await import(
      "../src/lib/entitlements"
    );
    await expect(requireManagementHomeAccess("es")).rejects.toThrow(
      "business_required",
    );
  });
});
