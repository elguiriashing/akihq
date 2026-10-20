// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BusinessPathway } from "../src/components/BusinessPathway";
import { trackSuiteConversion } from "../src/lib/suite-conversion";
afterEach(() => {
  cleanup();
  document.cookie = "ak_analytics=denied; Path=/";
  vi.unstubAllGlobals();
});
describe("contextual AkiSuite business pathway", () => {
  it.each(["en", "es"] as const)(
    "keeps %s management and operations distinct and language-safe",
    (locale) => {
      const { container } = render(
        <BusinessPathway locale={locale} category="accommodation" />,
      );
      expect(container.textContent).toContain("AkiHQ");
      expect(container.textContent).toContain("AkiBusiness");
      const links = container.querySelectorAll("a");
      expect(links[0].href).toBe(`https://akihq.app/${locale}/business`);
      expect(links[1].href).toBe(`https://akibusiness.com/?locale=${locale}`);
      expect(container.textContent).not.toMatch(
        /14.99|24.99|customers increased|clientes nuevos/,
      );
    },
  );
  it("offers the free claim only with an explicit bounded claim identifier", () => {
    const id = "12345678-1234-4234-8234-123456789abc";
    const { container } = render(
      <BusinessPathway locale="en" claimVenueId={id} />,
    );
    const href = new URL(container.querySelector("a")!.href);
    expect(href.searchParams.get("view")).toBe("claims");
    expect(href.searchParams.get("venueId")).toBe(id);
  });
  it("adapts the workflow example without fabricating performance", () => {
    render(<BusinessPathway locale="en" chooseCategory />);
    fireEvent.change(screen.getByLabelText("Business type"), {
      target: { value: "retail" },
    });
    expect(screen.getByText("Build a sale in PoS")).toBeTruthy();
  });
  it("never emits analytics without current explicit consent and respects revocation", () => {
    const gtag = vi.fn();
    Object.assign(window, { gtag });
    trackSuiteConversion("suite_cta_click", "en", "hq", "retail");
    expect(gtag).not.toHaveBeenCalled();
    document.cookie = "ak_analytics=granted; Path=/";
    trackSuiteConversion("suite_cta_click", "en", "hq", "retail");
    expect(gtag).toHaveBeenCalledTimes(1);
    document.cookie = "ak_analytics=denied; Path=/";
    trackSuiteConversion("suite_cta_click", "en", "hq", "retail");
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(gtag.mock.calls)).not.toMatch(
      /venueId|email|phone|user_id/,
    );
  });
});
