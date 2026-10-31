// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import { createElement } from "react";
import { render } from "@testing-library/react";
import { LanguageLink } from "../src/components/LanguageLink";
vi.mock("next/navigation", () => ({
  usePathname: () => "/login",
  useSearchParams: () => new URLSearchParams("lang=en&next=%2Fen%2Fbusiness"),
}));
import { managementLocale } from "../src/lib/management-locale";
describe("management page and chrome language", () => {
  it("switches the non-localized login language while retaining the return destination", () => {
    const { container } = render(createElement(LanguageLink, { locale: "es" }));
    const target = new URL(
      container.querySelector("a")!.getAttribute("href")!,
      "https://akihq.com",
    );
    expect(target.pathname).toBe("/login");
    expect(target.searchParams.get("lang")).toBe("es");
    expect(target.searchParams.get("next")).toBe("/es/business");
  });
  it("uses English for the same default marketing and login entry", () => {
    expect(managementLocale("/", {})).toBe("en");
    expect(managementLocale("/login", {})).toBe("en");
  });
  it("keeps localized routes authoritative over conflicting query values", () => {
    expect(managementLocale("/es/auth", { lang: "en" })).toBe("es");
    expect(managementLocale("/en/account", { locale: "es" })).toBe("en");
  });
  it("uses one explicit language precedence on root and login", () => {
    for (const path of ["/", "/login"]) {
      expect(managementLocale(path, { lang: "en", locale: "es" })).toBe("en");
      expect(managementLocale(path, { locale: "es" })).toBe("es");
      expect(managementLocale(path, { lang: ["en", "es"] })).toBe("en");
    }
  });
});
