import { afterEach, describe, expect, it, vi } from "vitest";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});
describe("coordinated management role release", () => {
  it.each([undefined, "false", "TRUE", "true"])(
    "resolves explicit mode %s",
    async (flag) => {
      vi.stubEnv("NEXT_PUBLIC_AKISUITE_ROLE_SWAP", flag);
      vi.resetModules();
      const { managementProduct, operationsProduct, roleOrigin } = await import(
        "../src/lib/product-roles"
      );
      const swapped = flag === "true";
      expect(managementProduct.name).toBe(swapped ? "AkiHQ" : "AkiBusiness");
      expect(managementProduct.origin).toBe(
        swapped ? "https://akihq.app" : "https://akibusiness.com",
      );
      expect(operationsProduct.origin).toBe(
        swapped ? "https://akibusiness.com" : "https://akihq.app",
      );
      expect(
        roleOrigin(
          "https://akibusiness.com",
          "https://akibusiness.com",
          managementProduct.origin,
        ),
      ).toBe(managementProduct.origin);
      expect(
        roleOrigin(
          "https://preview.example.workers.dev",
          "https://akibusiness.com",
          managementProduct.origin,
        ),
      ).toBe("https://preview.example.workers.dev");
      expect(
        roleOrigin(
          "https://user:pass@evil.test",
          "https://akibusiness.com",
          managementProduct.origin,
        ),
      ).toBe(managementProduct.origin);
      const { publicRequestOrigin, isTrustedBusinessHost } = await import(
        "../src/lib/public-request-origin"
      );
      expect(
        isTrustedBusinessHost(new URL(managementProduct.origin).host),
      ).toBe(true);
      expect(
        isTrustedBusinessHost(new URL(operationsProduct.origin).host),
      ).toBe(false);
      expect(
        publicRequestOrigin(
          new Headers({
            host: "evil.test",
            "x-forwarded-host": new URL(managementProduct.origin).host,
          }),
        ),
      ).toBe(managementProduct.origin);
      vi.stubEnv(
        "AKISUITE_ALLOWED_PREVIEW_ORIGINS",
        "https://preview.example.workers.dev",
      );
      expect(
        publicRequestOrigin(
          new Headers({ host: "preview.example.workers.dev" }),
        ),
      ).toBe("https://preview.example.workers.dev");
      const { suiteEmailCopy } = await import(
        "../src/lib/suite-email-templates"
      );
      for (const locale of ["en", "es"] as const) {
        const managementMail = suiteEmailCopy(
          "welcome_akibusiness",
          locale,
          {},
        );
        expect(managementMail.subject).toContain(managementProduct.name);
        expect(managementMail.href).toBe(
          `${managementProduct.origin}/${locale}/business`,
        );
        const operationsMail = suiteEmailCopy("welcome_akihq", locale, {});
        expect(operationsMail.subject).toContain(operationsProduct.name);
        expect(operationsMail.href).toBe(`${operationsProduct.origin}/`);
      }
      const manifest = (await import("../src/app/manifest")).default;
      expect(await manifest()).toMatchObject({
        name: managementProduct.name,
        id: "/akibusiness",
        start_url: "/es/business",
      });
      const { safeAuthDestinationForOrigin } = await import(
        "../src/lib/auth-security"
      );
      expect(
        safeAuthDestinationForOrigin(
          "en",
          "/en/business/venue/existing?section=bookings",
          managementProduct.origin,
        ),
      ).toBe("/en/business/venue/existing?section=bookings");
      expect(
        safeAuthDestinationForOrigin(
          "en",
          operationsProduct.origin,
          managementProduct.origin,
        ),
      ).toBe("/en/business");
    },
  );
});
