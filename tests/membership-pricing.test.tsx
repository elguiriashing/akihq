// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import Page from "../src/app/[locale]/membership/page";
afterEach(cleanup);

describe("approved AkiHQ product-specific Premium upgrades", () => {
  it.each(["en", "es"] as const)(
    "keeps free management and shows the correct upgrade per product in %s",
    async (locale) => {
      const { container } = render(
        await Page({ params: Promise.resolve({ locale }) }),
      );
      const cards = [...container.querySelectorAll("article")];
      expect(cards).toHaveLength(3);
      for (const [index, product, cents] of [
        [0, "AkiPasa", 1199],
        [1, "AkiDuermo", 2499],
        [2, "AkiCoches", 1999],
      ] as const) {
        expect(cards[index].textContent).toContain(
          `${product} Premium (${locale === "es" ? "para empresas" : "for businesses"})`,
        );
        expect(cards[index].textContent).toContain(
          new Intl.NumberFormat(locale === "es" ? "es-ES" : "en-IE", {
            style: "currency",
            currency: "EUR",
          }).format(cents / 100),
        );
        expect(cards[index].querySelector("a")?.href).toContain("/membership");
      }
      expect(container.textContent).toContain(
        locale === "es" ? "AkiHQ siempre es gratis" : "AkiHQ stays free",
      );
      expect(container.textContent).toContain("Basic, Standard");
      expect(container.querySelector("form")).toBeNull();
    },
  );
});

it.each(["en", "es"])(
  "uses the current Pasa app icon beside the other product icons in %s",
  async (locale) => {
    const { container } = render(
      await Page({ params: Promise.resolve({ locale }) }),
    );
    const html = container.innerHTML;
    expect(html).toContain("/brand/v3/pasa.svg");
    expect(html).not.toContain("/brand/logo-stacked-light.svg");
  },
);
