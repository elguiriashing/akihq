import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AkiPulse } from "../src/components/AkiPulse";
import {
  aggregatePulse,
  pulseFromEvents,
  pulsePeriod,
  listingCompleteness,
} from "../src/lib/akipulse";

const until = Date.parse("2026-03-01T00:00:00Z");
describe("AkiPulse authorised analytics presentation", () => {
  it("scores only measured listing fields with transparent equal weights", () => {
    const full = {
      name: "Venue",
      status: "published",
      address: "Street",
      description_es: "Descripción",
      description_en: null,
      phone: null,
      website_url: "https://example.com",
    };
    expect(listingCompleteness(full).score).toBe(100);
    expect(
      listingCompleteness({ ...full, address: null, website_url: null }).score,
    ).toBe(60);
    expect(
      listingCompleteness({ name: "Venue", status: "published" }).score,
    ).toBeNull();
  });
  it("bounds period inputs", () => {
    expect([
      pulsePeriod("7"),
      pulsePeriod("90"),
      pulsePeriod("365"),
      pulsePeriod("-7"),
    ]).toEqual([7, 90, 30, 30]);
  });
  it("uses exact adjacent UTC boundaries without double counting", () => {
    const events = [
      {
        action: "venue_view",
        occurred_at: new Date(until - 14 * 86400000).toISOString(),
      },
      {
        action: "venue_view",
        occurred_at: new Date(until - 7 * 86400000).toISOString(),
      },
      {
        action: "booking_click",
        occurred_at: new Date(until - 1).toISOString(),
      },
    ];
    expect(pulseFromEvents(events, 7, until)).toEqual([
      { action: "venue_view", current: 1, previous: 1 },
      { action: "booking_click", current: 1, previous: 0 },
    ]);
    expect(
      pulseFromEvents(
        [{ action: "venue_view", occurred_at: new Date(until).toISOString() }],
        7,
        until,
      ),
    ).toBeNull();
    expect(
      pulseFromEvents([{ action: "venue_view", occurred_at: "bad" }], 7, until),
    ).toBeNull();
  });
  it("never turns a missing location into a zero or publishes partial totals", () => {
    expect(aggregatePulse([[], null])).toBeNull();
    expect(
      aggregatePulse([
        [{ action: "share", current: 2, previous: 1 }],
        [{ action: "share", current: 3, previous: 4 }],
      ]),
    ).toEqual([{ action: "share", current: 5, previous: 5 }]);
  });
  it.each(["en", "es"] as const)(
    "renders usable %s controls and accurate scope disclosures",
    (locale) => {
      const html = renderToStaticMarkup(
        <AkiPulse
          locale={locale}
          locations={[
            {
              id: "one",
              name: "My venue",
              status: "published",
              events: 2,
              metrics: null,
            },
          ]}
          availableLocations={[{ id: "one", name: "My venue" }]}
          days={30}
          selectedLocation="all"
        />,
      );
      expect(html).toContain('name="location"');
      expect(html).toContain('name="days"');
      expect(html).toContain('role="alert"');
      expect(html).toContain(`https://akibusiness.com/?locale=${locale}`);
      expect(html).not.toContain("14.99");
      expect(html).toContain(
        locale === "en"
          ? "not confirmed bookings"
          : "no son reservas confirmadas",
      );
      expect(html).toContain(
        locale === "en"
          ? "Excludes Google impressions"
          : "No incluye impresiones de Google",
      );
    },
  );
});
