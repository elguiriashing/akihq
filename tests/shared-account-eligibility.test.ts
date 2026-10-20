const state = vi.hoisted(() => ({
  status: "pending",
  from: vi.fn(),
  getUser: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: state.getUser },
    rpc: async () => ({ data: { status: state.status }, error: null }),
    from: state.from,
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [] }),
}));
import { requireUser } from "../src/lib/auth";
import { afterEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  accountFeaturesAllowed,
  accountTrackingAllowed,
  accountCompletionUrl,
} from "../src/lib/account-eligibility";
afterEach(() => vi.unstubAllEnvs());
it("retains existing access before coordinated schema rollout", async () => {
  vi.stubEnv("AKISUITE_ONBOARDING_SCHEMA_READY", "false");
  const rpc = vi.fn();
  expect(
    await accountFeaturesAllowed({ rpc } as unknown as SupabaseClient),
  ).toBe(true);
  expect(rpc).not.toHaveBeenCalled();
});
it.each(["pending", "underage"])(
  "blocks %s independently of client cookies",
  async (status) => {
    vi.stubEnv("AKISUITE_ONBOARDING_SCHEMA_READY", "true");
    expect(
      await accountFeaturesAllowed({
        rpc: async () => ({ data: { status }, error: null }),
      } as unknown as SupabaseClient),
    ).toBe(false);
  },
);
it.each(["complete", "exempt"])("preserves %s accounts", async (status) => {
  vi.stubEnv("AKISUITE_ONBOARDING_SCHEMA_READY", "true");
  expect(
    await accountFeaturesAllowed({
      rpc: async () => ({ data: { status }, error: null }),
    } as unknown as SupabaseClient),
  ).toBe(true);
});
it("fails closed on provider failures and never exports credentials in the handoff", async () => {
  vi.stubEnv("AKISUITE_ONBOARDING_SCHEMA_READY", "true");
  await expect(
    accountFeaturesAllowed({
      rpc: async () => ({ data: null, error: { message: "down" } }),
    } as unknown as SupabaseClient),
  ).rejects.toThrow(/unavailable/);
  expect(accountCompletionUrl("en")).toBe("https://akipasa.com/en/onboarding");
  expect(accountCompletionUrl("es")).toBe("https://akipasa.com/es/onboarding");
});

it("guards direct member page URLs without relying on a frontend toggle", async () => {
  vi.stubEnv("AKISUITE_ONBOARDING_SCHEMA_READY", "true");
  state.status = "pending";
  state.getUser.mockResolvedValue({ data: { user: { id: "user" } } });
  await expect(requireUser("en", "/account")).rejects.toThrow(
    "redirect:https://akipasa.com/en/onboarding",
  );
  expect(state.from).not.toHaveBeenCalled();
});
it("keeps negative declarations restricted in the other product", async () => {
  vi.stubEnv("AKISUITE_ONBOARDING_SCHEMA_READY", "true");
  state.status = "underage";
  state.getUser.mockResolvedValue({ data: { user: { id: "user" } } });
  await expect(requireUser("es", "/account")).rejects.toThrow(
    "redirect:https://akipasa.com/es/onboarding",
  );
});

it("does not confuse an existing underage demographic with loss of account access", async () => {
  vi.stubEnv("AKISUITE_ONBOARDING_SCHEMA_READY", "false");
  const db = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { birth_year: new Date().getUTCFullYear() - 12 },
            error: null,
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
  expect(await accountFeaturesAllowed(db)).toBe(true);
  expect(await accountTrackingAllowed(db, "self")).toBe(false);
});
