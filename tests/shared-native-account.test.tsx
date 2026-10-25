// @vitest-environment jsdom
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { it, expect, vi, afterEach } from "vitest";
import {
  sharedProfileSchema,
  sharedProfileUpdate,
} from "../src/lib/shared-profile";
const state = vi.hoisted(() => ({
  failed: false,
  updates: [] as unknown[],
  identity: "verified-owner",
}));
vi.mock("@/lib/auth", () => ({
  requireUser: async () => ({
    user: { id: state.identity, email: "member@example.test" },
    supabase: {
      from: () => {
        const query = {
          select: () => query,
          eq: (_key: string, id: string) => {
            expect(id).toBe(state.identity);
            return query;
          },
          maybeSingle: async () => ({
            data: state.failed
              ? null
              : {
                  display_name: "Sample member",
                  username: "member",
                  bio: "Bio",
                  preferred_locale: "en",
                  profile_visibility: "private",
                  contact_visibility: "members",
                },
            error: state.failed ? { code: "failed" } : null,
          }),
        };
        return query;
      },
    },
  }),
}));
vi.mock("@/lib/shared-account-actions", () => ({
  saveSharedProfile: vi.fn(),
  uploadSharedProfileMedia: vi.fn(),
  changeSharedEmail: vi.fn(),
  resetSharedPassword: vi.fn(),
  openSharedBillingPortal: vi.fn(),
}));
vi.mock("next/link", () => ({
  default: ({ children, href }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/shared-membership", () => ({
  sharedAccountBilling: async () => ({ subscriptions: [], hasCustomer: false }),
}));
vi.mock("../src/components/SharedMembershipPanel", () => ({
  SharedMembershipPanel: () => null,
}));
import { SharedAccount } from "../src/components/SharedAccount";
import { ProductPrivacy } from "../src/components/ProductPrivacy";

it.each(["en", "es"] as const)(
  "exposes public deletion steps and scoped retention in %s",
  (locale) => {
    const { container } = render(<ProductPrivacy locale={locale} />);
    expect(container.textContent).toContain("AkiHQ");
    expect(container.textContent).toContain("support@akipasa.com");
    expect(container.textContent).toContain("48");
    expect(container.textContent).toContain("90");
    expect(container.textContent).toContain("12");
    expect(container.textContent).toContain("6");
    expect(
      container.querySelector(
        `a[href="https://akipasa.com/${locale}/account-deletion"]`,
      ),
    ).toBeTruthy();
    expect(
      container.querySelector(
        `a[href="https://akipasa.com/${locale}/account/privacy"]`,
      ),
    ).toBeTruthy();
    expect(container.textContent).toContain(
      locale === "es" ? "manualmente" : "manually",
    );
    expect(container.textContent).toContain(
      locale === "es" ? "Google Analytics" : "Google Analytics",
    );
  },
);
afterEach(() => {
  cleanup();
  state.failed = false;
});
const valid = {
  displayName: "Shared Name",
  username: "shared_user",
  bio: "Hello",
  phone: "+34 123",
  locality: "Fuengirola",
  province: "Málaga",
  preferredLocale: "en",
  profileVisibility: "private",
  contactVisibility: "members",
};
it("updates only explicitly editable shared profile fields", () => {
  const parsed = sharedProfileSchema.parse({
    ...valid,
    id: "foreign",
    app_role: "administrator",
    membership_tier: "premium",
    avatar_url: "https://evil.test",
  });
  expect(sharedProfileUpdate(parsed)).toEqual({
    display_name: "Shared Name",
    username: "shared_user",
    bio: "Hello",
    phone: "+34 123",
    locality: "Fuengirola",
    province: "Málaga",
    preferred_locale: "en",
    profile_visibility: "private",
    contact_visibility: "members",
  });
});
it.each([
  { username: "../escape" },
  { bio: "x".repeat(2001) },
  { profileVisibility: "everyone" },
  { preferredLocale: "fr" },
  { displayName: " " },
])("rejects invalid profile input %j", (patch) => {
  expect(sharedProfileSchema.safeParse({ ...valid, ...patch }).success).toBe(
    false,
  );
});
it.each(["en", "es"] as const)(
  "renders local account controls and real shared data in %s",
  async (locale) => {
    render(
      await SharedAccount({
        locale,
        product: "AkiHQ",
        home: "/account",
        membership: "/membership",
        path: "/settings",
      }),
    );
    expect(screen.getByDisplayValue("Sample member")).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: locale === "es" ? "Membresía" : "Membership",
      }),
    ).toHaveAttribute("href", "/membership");
    expect(
      screen.getByRole("button", {
        name:
          locale === "es" ? "Guardar perfil compartido" : "Save shared profile",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        locale === "es"
          ? "Tu correo y contraseña son comunes a AkiSuite."
          : "Your email and password are shared across AkiSuite.",
      ),
    ).toBeInTheDocument();
  },
);
it("does not expose a destructive blank profile after a failed read", async () => {
  state.failed = true;
  render(
    await SharedAccount({
      locale: "en",
      product: "AkiHQ",
      home: "/account",
      membership: "/membership",
      path: "/settings",
    }),
  );
  expect(
    screen.queryByRole("button", { name: "Save shared profile" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("alert")).toBeInTheDocument();
});
