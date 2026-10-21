import { describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  notFound: () => {
    throw new Error("not-found");
  },
}));
vi.mock("@/lib/feature-flags", () => ({ loadFeatureFlags: async () => ({}) }));
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
import { AkiPulse } from "../src/components/AkiPulse";
import BusinessPage from "../src/app/[locale]/business/page";
import { BusinessHome } from "../src/components/BusinessHome";
function homeProps(node: ReactNode): Record<string, unknown> | undefined {
  if (Array.isArray(node)) return node.map(homeProps).find(Boolean);
  if (!isValidElement<{ children?: ReactNode }>(node)) return;
  if (node.type === BusinessHome) return node.props;
  return homeProps(node.props.children);
}
type InspectableElement = ReactElement<{
  children?: ReactNode;
  role?: string;
  href?: string;
}>;
function elements(node: ReactNode): InspectableElement[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (
    !isValidElement<{
      children?: ReactNode;
      role?: string;
      href?: string;
    }>(node)
  )
    return [];
  return [node, ...elements(node.props.children)];
}
function textContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textContent).join(" ");
  if (!isValidElement<{ children?: ReactNode }>(node)) return "";
  return textContent(node.props.children);
}
describe("team member's real business page loader", () => {
  it.each([
    ["en", "consumer"],
    ["es", "consumer"],
    ["en", "administrator"],
    ["es", "administrator"],
  ])(
    "loads both assigned property types in %s for %s",
    async (locale, appRole) => {
      const members = [
        {
          role: "manager",
          venues: {
            id: "venue",
            name: "Team venue",
            slug: "team-venue",
            status: "published",
            verified: true,
            discovery_vertical: "activities",
          },
        },
        {
          role: "editor",
          venues: {
            id: "stay",
            name: "Team stay",
            slug: "team-stay",
            status: "pending",
            verified: false,
            discovery_vertical: "accommodation",
          },
        },
      ];
      const reads: Array<[string, string, unknown]> = [];
      const selects: Array<[string, string | undefined]> = [];
      const supabase = {
        rpc: async (name: string) => ({
          data:
            name === "managed_rental_branches"
              ? [
                  {
                    id: "rental",
                    name: "AkiCoches",
                    slug: "akicoches",
                    status: "published",
                    submitted_by: "team-user",
                  },
                ]
              : [],
          error: null,
        }),
        from: (table: string) => {
          const query = {
            select: (columns?: string) => {
              selects.push([table, columns]);
              return query;
            },
            eq: (field: string, value: unknown) => {
              reads.push([table, field, value]);
              return query;
            },
            in: () => query,
            order: () => query,
            limit: () => query,
            maybeSingle: async () => ({
              data:
                table === "profiles"
                  ? { app_role: appRole }
                  : table === "venue_members"
                    ? { venue_id: "stay" }
                    : null,
              error: null,
            }),
            then: (resolve: (value: unknown) => unknown) =>
              Promise.resolve({
                data:
                  table === "venue_members"
                    ? members
                    : table === "car_rental_companies"
                      ? [
                          {
                            id: "rental",
                            name: "AkiCoches",
                            slug: "akicoches",
                            status: "published",
                            venue_id: null,
                          },
                        ]
                      : [],
                error: null,
              }).then(resolve),
          };
          return query;
        },
      };
      mocks.requireUser.mockResolvedValue({
        supabase,
        user: { id: "team-user" },
      });
      mocks.redirect.mockImplementation((path: string) => {
        throw new Error(`redirect:${path}`);
      });
      const result = await BusinessPage({
        params: Promise.resolve({ locale }),
        searchParams: Promise.resolve({}),
      });
      expect(homeProps(result)?.places).toEqual([
        {
          id: "venue",
          name: "Team venue",
          slug: "team-venue",
          status: "published",
          role: "manager",
          product: "venue",
        },
        {
          id: "stay",
          name: "Team stay",
          slug: "team-stay",
          status: "pending",
          role: "editor",
          product: "stay",
        },
        {
          id: "rental",
          name: "AkiCoches",
          slug: "akicoches",
          status: "published",
          role: "owner",
          product: "rental",
        },
      ]);
      expect(reads).toContainEqual([
        "venue_members",
        "profile_id",
        "team-user",
      ]);
      expect(selects).toContainEqual([
        "venue_members",
        "role,venues(id,name,slug,status,verified,discovery_vertical,address,description_es,description_en,phone:contact_phone,website_url)",
      ]);
      expect(reads).not.toContainEqual([
        "car_rental_companies",
        "submitted_by",
        "team-user",
      ]);
      expect(mocks.redirect).not.toHaveBeenCalled();
    },
  );

  it.each(["en", "es"] as const)(
    "keeps a failed %s venue analytics read distinct from no activity",
    async (locale) => {
      const venue = {
        id: "venue",
        name: "Team venue",
        slug: "team-venue",
        status: "published",
        verified: true,
        discovery_vertical: "activities",
      };
      const supabase = {
        from: (table: string) => {
          const result = {
            data:
              table === "profiles"
                ? { app_role: "consumer" }
                : table === "venue_members"
                  ? [{ role: "manager", venues: venue }]
                  : [],
            error: null,
          };
          const query = {
            select: () => query,
            eq: () => query,
            in: () => query,
            order: () => query,
            limit: () => query,
            maybeSingle: async () => result,
            then: (resolve: (value: unknown) => unknown) =>
              Promise.resolve(result).then(resolve),
          };
          return query;
        },
        rpc: vi.fn().mockResolvedValue({
          data: [{ action: "venue_view", total: 9 }],
          error: { message: "Private analytics failure" },
        }),
      };
      mocks.requireUser.mockResolvedValue({
        supabase,
        user: { id: "team-user" },
      });
      const result = await BusinessPage({
        params: Promise.resolve({ locale }),
        searchParams: Promise.resolve({ view: "analytics" }),
      });
      const allElements = elements(result);
      const alert = allElements.find(
        (element) => element.props.role === "alert",
      );

      expect(alert).toBeDefined();
      expect(textContent(alert)).toContain(
        locale === "es"
          ? "No se pudieron cargar las analíticas"
          : "Analytics for this venue could not be loaded",
      );
      expect(textContent(result)).not.toContain(
        locale === "es" ? "Aún no hay actividad" : "No activity or impressions",
      );
      expect(textContent(result)).not.toContain("Private analytics failure");
      expect(
        allElements.find(
          (element) =>
            element.props.href === `/${locale}/business?view=analytics`,
        ),
      ).toBeDefined();
    },
  );
  it("uses only a member location and rejects incomplete provider data when Pulse is enabled", async () => {
    vi.stubEnv("AKIPULSE_ENABLED", "true");
    const reads: unknown[] = [];
    const venue = {
      id: "owned",
      name: "Owned venue",
      slug: "owned",
      status: "published",
      verified: true,
      discovery_vertical: "activities",
    };
    const supabase = {
      from: (table: string) => {
        const result = {
          data:
            table === "profiles"
              ? { app_role: "consumer" }
              : table === "venue_members"
                ? [{ role: "owner", venues: venue }]
                : [],
          error: null,
          count: table === "analytics_events" ? 1001 : 0,
        };
        const query = {
          select: () => query,
          eq: (key: string, value: string) => {
            reads.push([table, key, value]);
            return query;
          },
          in: () => query,
          order: () => query,
          gte: () => query,
          lt: () => query,
          limit: () => query,
          maybeSingle: async () => result,
          then: (resolve: (value: unknown) => unknown) =>
            Promise.resolve(result).then(resolve),
        };
        return query;
      },
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    mocks.requireUser.mockResolvedValue({ supabase, user: { id: "owner" } });
    try {
      const result = await BusinessPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({
          view: "pulse",
          location: "other-owner",
          days: "365",
        }),
      });
      const pulse = elements(result).find(
        (element) => element.type === AkiPulse,
      );
      expect(pulse).toBeDefined();
      expect(pulse?.props).toMatchObject({
        days: 30,
        selectedLocation: "all",
        locations: [{ id: "owned", metrics: null }],
      });
      expect(reads).toContainEqual(["analytics_events", "venue_id", "owned"]);
      expect(reads).not.toContainEqual([
        "analytics_events",
        "venue_id",
        "other-owner",
      ]);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
