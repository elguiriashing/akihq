// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { SuiteMarketingHeader } from "../src/components/SuiteMarketingHeader";
vi.stubGlobal("React", React);
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
afterEach(cleanup);

describe("shared business marketing header", () => {
  for (const locale of ["en", "es"] as const) {
    it(`keeps brand, links, controls and sign-in in the shared ${locale} order`, () => {
      const { container } = render(<SuiteMarketingHeader locale={locale} />);
      const header = container.querySelector("header")!;
      expect(Array.from(header.children).map((el) => el.className)).toEqual([
        "suite-marketing-brand",
        "suite-marketing-links",
        "portal-header-tools",
        "suite-marketing-signin",
      ]);
      const brand = header.querySelector(".suite-marketing-brand img")!;
      expect(brand.getAttribute("width")).toBe("40");
      expect(brand.getAttribute("height")).toBe("40");
      expect(
        header.querySelector(".suite-marketing-signin")!.getAttribute("href"),
      ).toBe(`/login?lang=${locale}`);
      expect(
        header.querySelector(".suite-marketing-peer")!.getAttribute("href"),
      ).toBe(`https://akibusiness.com/?locale=${locale}`);
      const controls = header.querySelector(".portal-header-tools")!;
      expect(controls.children[0].getAttribute("href")).toBe(
        `/?lang=${locale === "en" ? "es" : "en"}`,
      );
      expect(controls.children[1].tagName).toBe("BUTTON");
      expect(controls.children[2].tagName).toBe("DETAILS");
      expect(
        header.querySelector(".suite-marketing-links")!.textContent,
      ).toContain(locale === "es" ? "Herramientas" : "Tools");
    });
  }
});
