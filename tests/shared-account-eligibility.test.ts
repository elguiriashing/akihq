import {
  accountTaskResume,
  accountTaskFromSearch,
  suiteAccountCompletionUrl,
} from "../src/lib/account-task-resume";
const state = vi.hoisted(() => ({
  status: "pending",
  locale: "en",
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
  headers: async () => new Headers({ "x-akipasa-locale": state.locale }),
}));
vi.mock("../src/app/[locale]/business/actions", () => ({
  confirmRedemption: vi.fn(),
  createOfficialEvent: vi.fn(),
  createVenue: vi.fn(),
  deleteManagedVenue: vi.fn(),
  requestPromotion: vi.fn(),
  reuseEvent: vi.fn(),
  saveLoyaltyProgram: vi.fn(),
  submitVenueClaim: vi.fn(),
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

it("retains the exact allowlisted task in the fixed central completion envelope", () => {
  const completion = new URL(
    accountCompletionUrl("en", "/account?next=https://evil.test&token=secret"),
  );
  const next = completion.searchParams.get("next")!;
  expect(completion.origin).toBe("https://akipasa.com");
  expect(next).toContain("/en/account-resume?");
  expect(next).not.toContain("evil");
  expect(next).not.toContain("secret");
});

it.each(["en", "es"] as const)(
  "resumes the canonical %s passports route and rejects the old singular path",
  (locale) => {
    expect(accountTaskResume("pasa", locale, `/${locale}/passports`)?.url).toBe(
      `https://akipasa.com/${locale}/passports`,
    );
    expect(accountTaskResume("pasa", locale, `/${locale}/passport`)?.url).toBe(
      `https://akipasa.com/${locale}/account`,
    );
  },
);

it.each(["en", "es"] as const)(
  "retains actual %s rental vehicle/date and booking-page task keys",
  (locale) => {
    const result = accountTaskResume(
      "coches",
      locale,
      `/${locale}/rentals/sol?vehicle=car-123&start=2026-10-21&end=2026-10-23&page=2&next=https://evil.invalid`,
    )!;
    const url = new URL(result.url);
    expect(url.searchParams.get("vehicle")).toBe("car-123");
    expect(url.searchParams.get("start")).toBe("2026-10-21");
    expect(url.searchParams.get("end")).toBe("2026-10-23");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.has("next")).toBe(false);
  },
);

it.each(["en", "es"] as const)(
  "preserves validated %s referral tasks across all five fixed products",
  (locale) => {
    const code = "AKI12345";
    for (const [product, path, origin] of [
      ["pasa", "/referrals", "https://akipasa.com"],
      ["duermo", "/bookings", "https://akiduermo.com"],
      ["coches", "/account", "https://akicoches.com"],
      ["hq", "/business", "https://akihq.app"],
      ["business", "/", "https://akibusiness.com"],
    ] as const) {
      const task = accountTaskResume(
        product,
        locale,
        `${path}?ref=${code}&next=https://evil.invalid&token=secret`,
      )!;
      const target = new URL(task.url);
      expect(target.origin).toBe(origin);
      expect(target.searchParams.get("ref")).toBe(code);
      expect(
        product === "pasa" || product === "hq"
          ? target.pathname.startsWith(`/${locale}/`)
          : target.searchParams.get(
              product === "business" ? "locale" : "lang",
            ) === locale,
      ).toBe(true);
      expect(target.searchParams.has("next")).toBe(false);
      expect(target.searchParams.has("token")).toBe(false);
    }
  },
);
it.each([
  "ref=AKI12345&ref=AKI12345",
  "ref=AKI12345&ref=OTHER123",
  "ref=aki12345",
  "ref=SHORT",
  "ref=" + "A".repeat(25),
  "ref=https://evil.invalid",
  "ref=//evil.invalid",
])("rejects malformed or repeated public referral task %s", (query) => {
  for (const product of [
    "pasa",
    "duermo",
    "coches",
    "hq",
    "business",
  ] as const) {
    const path =
      product === "pasa"
        ? "/referrals"
        : product === "hq"
          ? "/business"
          : product === "business"
            ? "/"
            : "/account";
    const url = new URL(
      accountTaskResume(product, "en", `${path}?${query}`)!.url,
    );
    expect(url.searchParams.has("ref")).toBe(false);
    if (product === "pasa") expect(url.pathname).toBe("/en/account");
  }
});

it.each(["en", "es"] as const)(
  "round-trips the maximum-length %s referral code in the local completion envelope",
  (locale) => {
    const code = "A".repeat(24),
      requested = `/${locale}/referrals?ref=${code}`;
    const completion = new URL(
      suiteAccountCompletionUrl("pasa", locale, requested),
    );
    const next = new URL(
      completion.searchParams.get("next")!,
      completion.origin,
    );
    expect(completion.pathname).toBe(`/${locale}/onboarding`);
    expect(next.pathname).toBe(`/${locale}/account-resume`);
    expect(next.searchParams.get("product")).toBe("pasa");
    expect(
      accountTaskResume(
        next.searchParams.get("product"),
        locale,
        next.searchParams.get("path")!,
      )?.url,
    ).toBe(`https://akipasa.com/${locale}/referrals?ref=${code}`);
  },
);

it.each(["en", "es"] as const)(
  "actual management home preserves %s referral for claims and ordinary owner entry",
  async (locale) => {
    vi.stubEnv("AKISUITE_ONBOARDING_SCHEMA_READY", "true");
    state.locale = locale;
    state.getUser.mockResolvedValue({ data: { user: { id: "fixture" } } });
    const page = (await import("../src/app/[locale]/business/page")).default;
    for (const status of ["pending", "underage"]) {
      state.status = status;
      for (const view of ["claims", "venues"]) {
        let destination = "";
        try {
          await page({
            params: Promise.resolve({ locale }),
            searchParams: Promise.resolve({
              view,
              venueId: "venue_1",
              ref: "AKI12345",
              next: "https://evil.invalid",
              token: "secret",
            }),
          });
        } catch (error) {
          destination = (error as Error).message.replace(/^redirect:/, "");
        }
        const completion = new URL(destination);
        expect(completion.pathname).toBe(`/${locale}/onboarding`);
        const next = new URL(
          completion.searchParams.get("next")!,
          completion.origin,
        );
        const task = new URL(
          next.searchParams.get("path")!,
          "https://akihq.app",
        );
        expect(task.pathname).toBe("/business");
        expect(task.searchParams.get("ref")).toBe("AKI12345");
        expect(task.searchParams.get("view")).toBe(view);
        expect(task.searchParams.get("venueId")).toBe("venue_1");
        expect(task.searchParams.has("next")).toBe(false);
        expect(destination).not.toContain("secret");
      }
    }
  },
);

it("filters actual server search records without picking a repeated referral or exporting arbitrary URLs", () => {
  expect(
    accountTaskFromSearch("duermo", "en", "/bookings", {
      ref: ["AKI12345", "OTHER123"],
      tab: "past",
      page: "2",
      next: "https://evil.invalid",
      token: "secret",
    }),
  ).toBe("/bookings?tab=past&page=2");
  expect(
    accountTaskFromSearch("business", "es", "/", {
      workspace: "workspace_1",
      ref: "AKI12345",
    }),
  ).toBe("/?ref=AKI12345&workspace=workspace_1");
});

it.each(["en", "es"] as const)(
  "actual scoped management loaders preserve %s referral before their server gate",
  async (locale) => {
    vi.stubEnv("AKISUITE_ONBOARDING_SCHEMA_READY", "true");
    state.getUser.mockResolvedValue({ data: { user: { id: "fixture" } } });
    const pages = [
      [
        "locations",
        (await import("../src/app/[locale]/business/locations/page")).default,
      ],
      [
        "mobility",
        (await import("../src/app/[locale]/business/mobility/page")).default,
      ],
      [
        "accommodations",
        (await import("../src/app/[locale]/business/accommodations/page"))
          .default,
      ],
      [
        "apply",
        (await import("../src/app/[locale]/business/apply/page")).default,
      ],
    ] as const;
    for (const status of ["pending", "underage"]) {
      state.status = status;
      for (const [name, page] of pages) {
        let destination = "";
        try {
          await page({
            params: Promise.resolve({ locale }),
            searchParams: Promise.resolve({
              ref: "AKI12345",
              page: "2",
              next: "https://evil.invalid",
              token: "secret",
            }),
          });
        } catch (error) {
          destination = (error as Error).message.replace(/^redirect:/, "");
        }
        const completion = new URL(destination);
        expect(completion.pathname).toBe(`/${locale}/onboarding`);
        const next = new URL(
          completion.searchParams.get("next")!,
          completion.origin,
        );
        const task = new URL(
          next.searchParams.get("path")!,
          "https://akihq.app",
        );
        expect(task.pathname).toBe(`/business/${name}`);
        expect(task.searchParams.get("ref")).toBe("AKI12345");
        expect(task.searchParams.get("page")).toBe("2");
        expect(task.searchParams.has("next")).toBe(false);
        expect(destination).not.toContain("secret");
      }
    }
  },
);
