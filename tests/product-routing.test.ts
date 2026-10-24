import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  businessRoute,
  scrubBusinessHandoffQuery,
} from "../src/lib/business-routing";
import { publicRequestOrigin } from "../src/lib/public-request-origin";
import {
  safeAuthDestinationForOrigin,
  taskFromAuthCallback,
} from "../src/lib/auth-security";

describe("independent business boundary", () => {
  it.each(["en", "es"])(
    "keeps %s account routes and callbacks local",
    (locale) => {
      for (const path of [
        "account",
        "account/settings",
        "account/profile",
        "account/subscription",
      ])
        expect(businessRoute(`/${locale}/${path}`).kind).toBe("local");
      expect(
        safeAuthDestinationForOrigin(
          locale as "en" | "es",
          `/${locale}/account`,
          "https://akihq.app",
        ),
      ).toBe(`/${locale}/account`);
    },
  );

  it.each(["en", "es"])(
    "preserves same-origin %s PKCE callback fields for the exchange handler",
    async (locale) => {
      const { NextRequest } = await import("next/server");
      const { middleware } = await import("../src/middleware");
      const source = new NextRequest(
        `https://akihq.app/${locale}/auth/callback?code=qa-dummy&state=qa-state`,
        { headers: { host: "akihq.app" } },
      );
      const response = await middleware(source);
      expect(response.headers.get("location")).toBeNull();
      expect(source.nextUrl.searchParams.get("code")).toBe("qa-dummy");
      expect(source.nextUrl.searchParams.get("state")).toBe("qa-state");
    },
  );

  it("scrubs every case and duplicate credential while preserving safe handoff context", () => {
    const query = new URLSearchParams(
      "ACCESS_TOKEN=one&Access_Token=two&access_token=three&CODE=auth-code&client_secret=secret&PASSWORD=secret&state=provider-state&error_description=private&from=akibusiness&section=billing",
    );
    scrubBusinessHandoffQuery(query);
    expect([...query]).toEqual([
      ["from", "akibusiness"],
      ["section", "billing"],
    ]);
  });
  it("serves public landing and login locally while preserving business routes", () => {
    expect(businessRoute("/")).toEqual({ kind: "local", path: "/" });
    expect(businessRoute("/login")).toEqual({ kind: "local", path: "/login" });
    for (const locale of ["en", "es"]) {
      expect(businessRoute(`/${locale}`)).toEqual({
        kind: "redirect",
        path: `/${locale}/business`,
      });
      for (const path of [
        "business",
        "business/venue/123",
        "business/mobility",
        "auth/callback",
        "terms/accept",
      ])
        expect(businessRoute(`/${locale}/${path}`, "POST").kind).toBe("local");
    }
  });
  it("keeps the free HQ membership local while account settings remain local", () => {
    for (const locale of ["en", "es"]) {
      expect(businessRoute(`/${locale}/membership`).kind).toBe("local");
      expect(businessRoute(`/${locale}/business/memberships`).kind).toBe(
        "local",
      );
      expect(businessRoute(`/${locale}/account/subscription`).kind).toBe(
        "local",
      );
    }
    const page = readFileSync("src/app/[locale]/membership/page.tsx", "utf8");
    expect(page).toContain('premiumName("akipasa", "business", locale)');
    expect(page).toContain('premiumName("akiduermo", "business", locale)');
    expect(page).toContain('premiumName("akicoches", "business", locale)');
    expect(page).toMatch(/suiteHref\("business",\s*locale\)/);
    expect(page).not.toContain("startAkiSuiteCheckout");
  });
  it("retains management APIs without exposing billing or administrative endpoints", () => {
    for (const path of [
      "/api/business/venue-media",
      "/api/business/claim-search",
      "/api/locations/search",
      "/api/health",
    ])
      expect(businessRoute(path).kind).toBe("local");
    for (const path of [
      "/api/stripe/webhook",
      "/api/ai-team/chat",
      "/api/admin/users",
      "/api/stays/bookings",
    ])
      expect(businessRoute(path, "POST").kind).toBe("reject");
    expect(businessRoute("/es/account/subscription").kind).toBe("local");
    expect(businessRoute("/es/admin", "POST").kind).toBe("reject");
  });
  it("accepts exact configured previews, rejects spoofed forwarded hosts", () => {
    expect(
      publicRequestOrigin(
        new Headers({
          host: "akihq.app",
          "x-forwarded-host": "evil.test",
        }),
      ),
    ).toBe("https://akihq.app");
    expect(publicRequestOrigin(new Headers({ host: "localhost:3012" }))).toBe(
      "http://localhost:3012",
    );
    process.env.AKISUITE_ALLOWED_PREVIEW_ORIGINS =
      "https://business.example.workers.dev";
    expect(
      publicRequestOrigin(
        new Headers({ host: "business.example.workers.dev" }),
      ),
    ).toBe("https://business.example.workers.dev");
    expect(
      publicRequestOrigin(new Headers({ host: "evil.example.workers.dev" })),
    ).toBe("https://akihq.app");
    delete process.env.AKISUITE_ALLOWED_PREVIEW_ORIGINS;
  });
  it("preserves local tasks and recovery without cross-domain cookie transfer", () => {
    for (const locale of ["en", "es"] as const) {
      const next = `/${locale}/business/venue/123?section=bookings`;
      expect(
        safeAuthDestinationForOrigin(locale, next, "http://localhost:3012"),
      ).toBe(next);
      expect(
        taskFromAuthCallback(
          locale,
          `/${locale}/auth/recover?next=${encodeURIComponent(next)}`,
          "https://akihq.app",
        ),
      ).toBe(next);
      for (const bad of [
        "https://evil.test",
        "//evil.test",
        `/${locale}/%2f/evil`,
        `/${locale}/admin`,
        `/${locale}/business\\evil`,
      ])
        expect(
          safeAuthDestinationForOrigin(locale, bad, "https://akihq.app"),
        ).toBe(`/${locale}/business`);
    }
  });
  it("never reserializes an unsanitized auth destination into mode links", () => {
    const authPage = readFileSync("src/app/[locale]/auth/page.tsx", "utf8");
    expect(authPage).toContain('if (query.next) search.set("next", next);');
    expect(authPage).not.toContain(
      'if (query.next) search.set("next", query.next);',
    );
  });
});

describe("existing identity security contracts", () => {
  it("requires strong passwords and rejects unsafe public action URLs", async () => {
    const { passwordSchema, safeExternalUrlSchema } = await import(
      "../src/lib/auth-security"
    );
    expect(passwordSchema.safeParse("Short1A").success).toBe(false);
    expect(passwordSchema.safeParse("alllowercase123").success).toBe(false);
    expect(passwordSchema.safeParse("SecureAccount42").success).toBe(true);
    for (const value of [
      "http://example.com",
      "javascript:alert(1)",
      "data:text/html,unsafe",
    ])
      expect(safeExternalUrlSchema.safeParse(value).success).toBe(false);
    expect(
      safeExternalUrlSchema.safeParse("https://tickets.example/event").success,
    ).toBe(true);
  });
  it("recognizes only Supabase auth cookies and rejects unknown hostnames", async () => {
    const { hasSupabaseAuthCookie } = await import(
      "../src/lib/supabase/auth-cookie"
    );
    const { isTrustedBusinessHost } = await import(
      "../src/lib/public-request-origin"
    );
    expect(hasSupabaseAuthCookie([{ name: "sb-project-auth-token.0" }])).toBe(
      true,
    );
    expect(hasSupabaseAuthCookie([{ name: "sb-project-unrelated" }])).toBe(
      false,
    );
    expect(isTrustedBusinessHost("akihq.app")).toBe(true);
    expect(isTrustedBusinessHost("akibusiness.com")).toBe(false);
    expect(isTrustedBusinessHost("attacker.test")).toBe(false);
  });
});

describe("public AkiHQ product-link identity", () => {
  it("renders the three discovery brands with existing PortalLogo assets and accessible destinations", () => {
    const page = readFileSync("src/app/page.tsx", "utf8");
    const logo = readFileSync("src/components/PortalLogo.tsx", "utf8");
    const styles = readFileSync("src/app/landing.css", "utf8");
    for (const [product, domain, source] of [
      ["pasa", "akipasa.com", "/pwa/akipasa-512.png"],
      ["duermo", "akiduermo.com", "/brand/duermo-icon.png"],
      ["coches", "akicoches.com", "/brand/conduzco-icon.svg"],
    ]) {
      expect(page).toContain(`<PortalLogo product="${product}" />`);
      expect(page).toContain(`href="https://${domain}/"`);
      expect(logo).toContain(source);
    }
    expect(page).toContain("usedForTitle");
    expect(page).toContain("PARA GESTIONAR");
    expect(styles).toContain(".hq-used-for-logos");
  });
});
