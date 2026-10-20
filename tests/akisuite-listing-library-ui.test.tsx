import { it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ListingTemplateLibrary } from "../src/components/ListingTemplateLibrary";
vi.mock("../src/app/[locale]/business/venue/[id]/premium-actions", () => ({
  saveEventTemplate: vi.fn(),
  useEventTemplate: vi.fn(),
}));
it.each(["en", "es"] as const)(
  "shows %s listing-specific upgrade and preserves existing event data on free plan",
  (locale) => {
    const html = renderToStaticMarkup(
      <ListingTemplateLibrary
        locale={locale}
        venueId="venue"
        premium={false}
        accommodation
        templates={[]}
        events={[{ id: "event", title: "Retained event" }]}
      />,
    );
    expect(html).toContain(
      `https://akipasa.com/${locale}/account/subscription?app=akiduermo`,
    );
    expect(html).toContain(
      locale === "es"
        ? "eventos actuales se conservan"
        : "Existing events are retained",
    );
    expect(html).not.toContain('name="templateId"');
  },
);
it.each(["en", "es"] as const)(
  "offers only draft creation with explicit source/template in %s",
  (locale) => {
    const html = renderToStaticMarkup(
      <ListingTemplateLibrary
        locale={locale}
        venueId="venue"
        premium
        accommodation={false}
        templates={[{ id: "template", name: "Reusable" }]}
        events={[{ id: "event", title: "Source event" }]}
      />,
    );
    expect(html).toContain('name="eventId"');
    expect(html).toContain("Source event");
    expect(html).toContain("Reusable");
    expect(html).toContain(
      locale === "es" ? "No se copian fechas" : "Dates are not copied",
    );
    expect(html).toContain('name="slug"');
  },
);
it("withholds dependent actions on failed template reads instead of pretending the library is empty", () => {
  const html = renderToStaticMarkup(
    <ListingTemplateLibrary
      locale="en"
      venueId="venue"
      premium
      accommodation={false}
      templates={null}
      events={[]}
    />,
  );
  expect(html).toContain("Templates could not be loaded");
  expect(html).not.toContain("Create draft");
});
