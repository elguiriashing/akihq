import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { AkiPulseScoped } from "../src/components/AkiPulseScoped";
import {
  pulseScopeQuery,
  readPulseScopedReport,
  type PulseScopedReport,
} from "../src/lib/akipulse-scoped";
const id = "10000000-0000-4000-8000-000000000001",
  until = "2026-10-20T00:00:00.000Z";
const data: PulseScopedReport = {
  version: 1,
  kind: "organisation",
  id,
  name: "Synthetic <venue>",
  period: {
    days: 7,
    until,
    current_from: "2026-10-13T00:00:00Z",
    previous_from: "2026-10-06T00:00:00Z",
  },
  coverage: {
    measured_venues: 2,
    excluded_locations: 1,
    current_active_units: 3,
    current_active_vehicles: null,
  },
  bookings: [
    {
      source: "accommodation",
      period: "current",
      status: "confirmed",
      total: 4,
    },
  ],
  interactions: [{ action: "booking_click", current: 7, previous: 3 }],
  commercial_funnel: {
    available: false,
    reason: "no_scoped_verified_attribution_adapter",
  },
  acquisition_sources: { available: false },
  revenue_available: false,
};
describe("scoped Pulse contracts", () => {
  it("bounds queries and ignores malformed or hostile resource identity", () => {
    expect(
      pulseScopeQuery.parse({
        pulseKind: "invalid",
        pulseResource: "https://evil.invalid",
        pulsePage: "999999",
      }),
    ).toEqual({ pulseKind: "venue", pulsePage: 0 });
    expect(
      pulseScopeQuery.parse({
        pulseKind: "fleet",
        pulseResource: id,
        pulsePage: "2",
      }).pulseResource,
    ).toBe(id);
  });
  it("rejects cross-kind, cross-resource, stale period and malformed aggregate responses", () => {
    expect(readPulseScopedReport(data, "organisation", id, 7, until)).toEqual(
      data,
    );
    for (const args of [
      ["fleet", id, 7, until],
      ["organisation", "20000000-0000-4000-8000-000000000001", 7, until],
      ["organisation", id, 30, until],
      ["organisation", id, 7, "2026-10-19T00:00:00Z"],
    ] as const)
      expect(
        readPulseScopedReport(data, args[0], args[1], args[2], args[3]),
      ).toBeNull();
    expect(
      readPulseScopedReport(
        { ...data, bookings: [{ ...data.bookings[0], total: -1 }] },
        "organisation",
        id,
        7,
        until,
      ),
    ).toBeNull();
    expect(
      readPulseScopedReport(
        { ...data, revenue_available: true },
        "organisation",
        id,
        7,
        until,
      ),
    ).toBeNull();
  });
  it.each(["en", "es"] as const)(
    "renders %s measured cohorts, explicit coverage, no invented attribution",
    (locale) => {
      const html = renderToStaticMarkup(
        <AkiPulseScoped
          locale={locale}
          kind="organisation"
          selected={id}
          scopes={[{ id, name: "Synthetic scope" }]}
          report={data}
          unavailable={false}
          page={1}
          hasMore={true}
          days={7}
        />,
      );
      expect(html).toContain('name="pulseKind"');
      expect(html).toContain('name="pulseResource"');
      expect(html).toContain('name="days"');
      expect(html).toContain('role="status"');
      expect(html).toContain("Synthetic &lt;venue&gt;");
      expect(html).toContain(
        locale === "en"
          ? "not the confirmation date"
          : "no la fecha de confirmación",
      );
      expect(html).toContain(
        locale === "en"
          ? "Funnel data is unavailable"
          : "Los datos del embudo no están disponibles",
      );
      expect(html).not.toContain("100%");
      expect(html).toContain(
        locale === "es" ? "Clics de reserva" : "Booking clicks",
      );
    },
  );
  it.each(["en", "es"] as const)(
    "shows %s failures without empty success or cached reports",
    (locale) => {
      const html = renderToStaticMarkup(
        <AkiPulseScoped
          locale={locale}
          kind="fleet"
          selected={id}
          scopes={[{ id, name: "Scope" }]}
          report={null}
          unavailable={true}
          page={0}
          hasMore={false}
          days={30}
        />,
      );
      expect(html).toContain('role="alert"');
      expect(html).not.toContain("<table");
      expect(html).not.toContain(
        locale === "en"
          ? "No requests recorded"
          : "No se registraron solicitudes",
      );
    },
  );
});

import { readBusinessFunnel } from "../src/lib/akipulse-funnel";
import { BusinessFunnel } from "../src/components/BusinessFunnel";
const verified = {
  available: true,
  scope: "workspace",
  days: 7,
  stages: { payment_verified: 2 },
  coverage: "consented_verified_observations_only",
  retention_days: 90,
  collection_started_at: until,
  claim_stage_available: false,
  cta_attribution_available: false,
  conversion_rate_available: false,
  hq_activation_definition: "owner_created_management_workspace",
};
it("binds verified counts to exact scope and period, rejects fabricated rates", () => {
  expect(
    readBusinessFunnel(
      { kind: "venue", id, days: 7, funnel: verified },
      "venue",
      id,
      7,
    )?.available,
  ).toBe(true);
  expect(
    readBusinessFunnel(
      { kind: "venue", id, days: 7, funnel: verified },
      "fleet",
      id,
      7,
    ),
  ).toBeNull();
  expect(
    readBusinessFunnel(
      { ...verified, conversion_rate_available: true },
      "venue",
      id,
      7,
    ),
  ).toBeNull();
  expect(
    readBusinessFunnel(
      { kind: "venue", id, days: 30, funnel: verified },
      "venue",
      id,
      7,
    ),
  ).toBeNull();
});
it.each(["en", "es"] as const)(
  "renders honest %s verified-stage coverage",
  (locale) => {
    const parsed = readBusinessFunnel(
      { kind: "venue", id, days: 7, funnel: verified },
      "venue",
      id,
      7,
    );
    const html = renderToStaticMarkup(
      <BusinessFunnel locale={locale} report={parsed} />,
    );
    expect(html).toContain(
      locale === "en" ? "not unique customers" : "No son clientes únicos",
    );
    expect(html).toContain(
      locale === "en" ? "No observations" : "Sin observaciones",
    );
    expect(html).toContain(
      locale === "en" ? "No authorized mapping" : "Sin vínculo autorizado",
    );
    expect(html).not.toContain("100%");
    expect(html).toContain("<summary>");
  },
);

it.each(["en", "es"] as const)(
  "uses plain %s unavailable reporting copy",
  (locale) => {
    const html = renderToStaticMarkup(
      <BusinessFunnel
        locale={locale}
        report={{ available: false, reason: "stage_adapter_not_installed" }}
      />,
    );
    expect(html).toContain(
      locale === "en"
        ? "Verified funnel reporting is not available yet."
        : "Los informes del embudo verificado todavía no están disponibles.",
    );
    expect(html).not.toContain("adapter");
    expect(html).not.toContain("adaptador");
  },
);

it("installed read-only funnel readiness does not activate collection or financial gates", () => {
  const config = JSON.parse(
    readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8").replace(
      /,\s*([}\]])/g,
      "$1",
    ),
  );
  expect(config.vars.AKISUITE_FUNNEL_READY).toBe("true");
  for (const gate of [
    "AKISUITE_CHECKOUT_ENABLED",
    "AKISUITE_TAX_READY",
    "AKISUITE_SUBSCRIPTIONS_READY",
    "AKISUITE_BILLING_VERIFIED",
  ]) {
    expect(config.vars[gate]).toBe("false");
  }
  expect(
    Object.keys(config.vars).filter((key) => /COLLECTION|RETENTION/.test(key)),
  ).toEqual([]);
  expect(
    readBusinessFunnel(
      {
        kind: "venue",
        id,
        days: 7,
        funnel: { available: false, reason: "not_activated" },
      },
      "venue",
      id,
      7,
    ),
  ).toEqual({ available: false, reason: "not_activated" });
});
