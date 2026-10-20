import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PortalHeaderTools } from "../src/components/PortalHeaderTools";
vi.mock("../src/components/LanguageLink", () => ({ LanguageLink: () => null }));
vi.mock("../src/components/ThemeModeControls", () => ({
  ThemeToggle: () => null,
}));
vi.mock("../src/components/PortalLogo", () => ({ PortalLogo: () => null }));
describe("actual desktop/mobile suite selector destinations", () => {
  for (const locale of ["en", "es"] as const) {
    it(`renders all five canonical ${locale} destinations`, () => {
      const html = renderToStaticMarkup(
        <PortalHeaderTools locale={locale} product="business" />,
      );
      for (const expected of [
        `https://akipasa.com/${locale}`,
        `https://akiduermo.com/?lang=${locale}`,
        `https://akicoches.com/?lang=${locale}`,
        `https://akihq.app/${locale}/business`,
        `https://akibusiness.com/?locale=${locale}`,
      ])
        expect(html).toContain(`href="${expected}"`);
    });
  }
});
