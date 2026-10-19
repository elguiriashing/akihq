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
    "removes nested credentials at the actual %s external handoff",
    async (locale) => {
      const { NextRequest } = await import("next/server");
      const { middleware } = await import("../src/middleware");
      const source = new URL(
        `https://akihq.app/${locale}/account/subscription?lang=${locale}&q=Malaga&start=2027-01-01&end=2027-01-04&utm_source=instagram`,
      );
      source.searchParams.set("next", "/en/auth/callback?code=qa-dummy");
      source.searchParams.set("context", '{"\\u0063ode":"qa-dummy"}');
      const response = await middleware(
        new NextRequest(source, { headers: { host: "akihq.app" } }),
      );
      expect(response.status).toBe(307);
      const target = new URL(response.headers.get("location")!);
      expect(target.origin).toBe("https://akipasa.com");
      expect(target.pathname).toBe(`/${locale}/account/subscription`);
      expect([...target.searchParams]).toEqual([
        ["lang", locale],
        ["q", "Malaga"],
        ["start", "2027-01-01"],
        ["end", "2027-01-04"],
        ["utm_source", "instagram"],
        ["from", "akibusiness"],
      ]);
      expect(target.hash).toBe("#redirected");
      expect(target.href).not.toContain("qa-dummy");
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
  it("uses its business homepage on every deployment host", () => {
    expect(businessRoute("/")).toEqual({
      kind: "redirect",
      path: "/es/business",
    });
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
    expect(businessRoute("/es/account/subscription").kind).toBe("primary");
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
