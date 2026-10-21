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
  rpc: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: state.getUser },
    rpc: async (name: string, args?: unknown) =>
      name === "my_account_onboarding"
        ? { data: { status: state.status }, error: null }
        : state.rpc(name, args),
    from: state.from,
  }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("not-found");
  },
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
import { safeAuthDestination } from "../src/lib/auth-security";
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

it.each(["en", "es"] as const)(
  "retains actual legacy scope names through every %s completion envelope",
  (locale) => {
    const scope = {
      property: "00000000-0000-4000-8000-000000000011",
      company: "00000000-0000-4000-8000-000000000022",
      organisation: "00000000-0000-4000-8000-000000000033",
      ref: "AKI12345",
    };
    for (const product of [
      "pasa",
      "duermo",
      "coches",
      "hq",
      "business",
    ] as const) {
      const pathname =
        product === "pasa"
          ? "/referrals"
          : product === "hq"
            ? "/business/accommodations"
            : product === "business"
              ? "/"
              : "/account";
      const task = accountTaskFromSearch(product, locale, pathname, scope)!;
      const completion = new URL(
        suiteAccountCompletionUrl(product, locale, task),
      );
      const next = new URL(
        completion.searchParams.get("next")!,
        completion.origin,
      );
      const destination = new URL(
        accountTaskResume(
          next.searchParams.get("product"),
          locale,
          next.searchParams.get("path")!,
        )!.url,
      );
      for (const [key, value] of Object.entries(scope))
        expect(destination.searchParams.get(key)).toBe(value);
      expect(destination.searchParams.getAll("property")).toHaveLength(1);
      expect(destination.searchParams.getAll("company")).toHaveLength(1);
      expect(destination.searchParams.getAll("organisation")).toHaveLength(1);
      expect(next.pathname).toBe(`/${locale}/account-resume`);
    }
  },
);

it.each(["property", "company", "organisation"])(
  "rejects duplicate and malicious legacy %s scopes without dropping valid referral intent",
  (key) => {
    for (const locale of ["en", "es"] as const) {
      for (const value of [
        ["owned", "foreign"],
        "https://evil.invalid",
        "//evil.invalid",
        "../foreign",
        "x".repeat(129),
      ]) {
        const task = accountTaskFromSearch(
          "hq",
          locale,
          "/business/locations",
          { [key]: value, ref: "AKI12345" },
        )!;
        const destination = new URL(accountTaskResume("hq", locale, task)!.url);
        expect(destination.searchParams.has(key)).toBe(false);
        expect(destination.searchParams.get("ref")).toBe("AKI12345");
      }
      const direct = new URL(
        accountTaskResume(
          "hq",
          locale,
          `/business/locations?${key}=owned&${key}=foreign&ref=AKI12345`,
        )!.url,
      );
      expect(direct.searchParams.has(key)).toBe(false);
      expect(direct.searchParams.get("ref")).toBe("AKI12345");
    }
  },
);

it.each(["en", "es"] as const)(
  "resumes %s actual property, company and organisation selection through pending gate and completed destination",
  async (locale) => {
    vi.stubEnv("AKISUITE_ONBOARDING_SCHEMA_READY", "true");
    vi.stubEnv("AKISUITE_ORGANISATIONS_READY", "true");
    vi.stubEnv("AKISUITE_ACCOMMODATION_READY", "true");
    vi.stubEnv("AKISUITE_PRIVATE_LOCATIONS_READY", "true");
    state.getUser.mockResolvedValue({ data: { user: { id: "fixture" } } });
    const selected = "00000000-0000-4000-8000-000000000022";
    const other = "00000000-0000-4000-8000-000000000011";
    const branches = [
      { id: other, name: "First owned branch" },
      { id: selected, name: "Selected owned branch" },
    ];
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      order: vi.fn(() => query),
      limit: vi.fn(async () => ({ data: [], error: null, count: 0 })),
      maybeSingle: vi.fn(async () => ({
        data: { terms_version: "2026-07-23" },
        error: null,
      })),
    };
    state.from.mockImplementation(() => query);
    state.rpc.mockImplementation(async (name: string) => ({
      data: name === "managed_rental_branches" ? branches : [],
      error: null,
      count: 0,
    }));
    const cases = [
      {
        key: "property",
        path: "accommodations",
        page: (await import("../src/app/[locale]/business/accommodations/page"))
          .default,
      },
      {
        key: "company",
        path: "mobility",
        page: (await import("../src/app/[locale]/business/mobility/page"))
          .default,
      },
      {
        key: "organisation",
        path: "locations",
        page: (await import("../src/app/[locale]/business/locations/page"))
          .default,
      },
    ];
    function elementProps(node: unknown): Record<string, unknown>[] {
      if (Array.isArray(node)) return node.flatMap(elementProps);
      if (node && typeof node === "object" && "props" in node) {
        const props = (node as { props: Record<string, unknown> }).props;
        return [props, ...elementProps(props.children)];
      }
      return [];
    }
    for (const status of ["pending", "underage"])
      for (const item of cases) {
        state.status = status;
        // Auth must retain the same localized destination before onboarding starts.
        state.getUser.mockResolvedValueOnce({ data: { user: null } });
        let authRedirect = "";
        try {
          await item.page({
            params: Promise.resolve({ locale }),
            searchParams: Promise.resolve({
              [item.key]: selected,
              ref: "AKI12345",
              page: "2",
            }),
          });
        } catch (error) {
          authRedirect = (error as Error).message.replace(/^redirect:/, "");
        }
        const auth = new URL(authRedirect, "https://akihq.app");
        expect(auth.pathname).toBe(`/${locale}/auth`);
        const validatedAuthTask = new URL(
          safeAuthDestination(locale, auth.searchParams.get("next")!),
          auth.origin,
        );
        expect(validatedAuthTask.pathname).toBe(
          `/${locale}/business/${item.path}`,
        );
        expect(validatedAuthTask.searchParams.get(item.key)).toBe(selected);
        expect(validatedAuthTask.searchParams.get("ref")).toBe("AKI12345");
        let redirect = "";
        try {
          await item.page({
            params: Promise.resolve({ locale }),
            searchParams: Promise.resolve(
              Object.fromEntries(validatedAuthTask.searchParams),
            ),
          });
        } catch (error) {
          redirect = (error as Error).message.replace(/^redirect:/, "");
        }
        const completion = new URL(redirect);
        const next = new URL(
          completion.searchParams.get("next")!,
          completion.origin,
        );
        const resumed = accountTaskResume(
          next.searchParams.get("product"),
          locale,
          next.searchParams.get("path")!,
        )!;
        const destination = new URL(resumed.url);
        expect(destination.origin).toBe("https://akihq.app");
        expect(destination.pathname).toBe(`/${locale}/business/${item.path}`);
        expect(destination.searchParams.get(item.key)).toBe(selected);
        expect(destination.searchParams.get("ref")).toBe("AKI12345");
        // Continue as a server-approved complete-account fixture.
        state.status = "complete";
        state.rpc.mockClear();
        query.eq.mockClear();
        const rendered = await item.page({
          params: Promise.resolve({ locale }),
          searchParams: Promise.resolve(
            Object.fromEntries(destination.searchParams),
          ),
        });
        if (item.key === "property")
          expect(
            elementProps(rendered).find((props) => props.initialProperty)
              ?.initialProperty,
          ).toBe(selected);
        if (item.key === "company") {
          expect((elementProps(rendered)[0].company as { id: string }).id).toBe(
            selected,
          );
          expect(query.eq).toHaveBeenCalledWith("company_id", selected);
          expect(query.eq).not.toHaveBeenCalledWith("company_id", other);
        }
        if (item.key === "organisation") {
          expect(state.rpc).toHaveBeenCalledWith(
            "list_operating_organisation_locations",
            { p_organisation: selected, p_limit: 50, p_offset: 0 },
          );
          expect(
            elementProps(rendered).some(
              (props) =>
                (props.query as { organisation?: string } | undefined)
                  ?.organisation === selected,
            ),
          ).toBe(true);
        }
      }
    state.status = "complete";
    const mobility = cases.find((item) => item.key === "company")!;
    await expect(
      mobility.page({
        params: Promise.resolve({ locale }),
        searchParams: Promise.resolve({
          company: "00000000-0000-4000-8000-000000000099",
        }),
      }),
    ).rejects.toThrow("not-found");
    state.from.mockReset();
    state.rpc.mockReset();
  },
);
