import React from "react";
import { createRoot } from "react-dom/client";
import { RentalPulseWorkspaceLink } from "../../src/components/RentalPulseWorkspaceLink";
import { AkiPulseScoped } from "../../src/components/AkiPulseScoped";
import type { PulseScopedReport } from "../../src/lib/akipulse-scoped";
const params = new URLSearchParams(location.search);
const locale = params.get("locale") === "es" ? "es" : "en";
const kind = (
  ["venue", "property", "native_property", "fleet", "organisation"].includes(
    params.get("kind") || "",
  )
    ? params.get("kind")
    : "venue"
) as PulseScopedReport["kind"];
document.documentElement.lang = locale;
document.documentElement.dataset.theme =
  params.get("theme") === "light" ? "light" : "dark";
const id = "10000000-0000-4000-8000-000000000001";
const data: PulseScopedReport = {
  version: 1,
  kind,
  id,
  name: "Synthetic authorised business",
  period: {
    days: 7,
    until: "2026-10-20T00:00:00Z",
    current_from: "2026-10-13T00:00:00Z",
    previous_from: "2026-10-06T00:00:00Z",
  },
  coverage: {
    measured_venues: kind === "fleet" || kind === "native_property" ? 0 : 2,
    measured_native_properties:
      kind === "native_property" || kind === "organisation" ? 1 : undefined,
    native_reporting_available: true,
    excluded_locations: kind === "organisation" ? 1 : 0,
    current_active_units: kind === "fleet" ? null : 3,
    current_active_vehicles: kind === "fleet" ? 4 : null,
  },
  bookings: [
    {
      source:
        kind === "fleet"
          ? "fleet"
          : kind === "native_property"
            ? "native_accommodation"
            : kind === "property"
              ? "accommodation"
              : "venue",
      period: "current",
      status: "confirmed",
      total: 4,
    },
    {
      source:
        kind === "fleet"
          ? "fleet"
          : kind === "native_property"
            ? "native_accommodation"
            : kind === "property"
              ? "accommodation"
              : "venue",
      period: "previous",
      status: "cancelled",
      total: 2,
    },
  ],
  interactions:
    kind === "fleet" || kind === "native_property"
      ? []
      : [{ action: "booking_click", current: 7, previous: 3 }],
  commercial_funnel: {
    available: false,
    reason: "no_scoped_verified_attribution_adapter",
  },
  acquisition_sources: { available: false },
  revenue_available: false,
};
createRoot(document.getElementById("fixture")!).render(
  <>
    <p>Synthetic QA fixture · no real customer records or provider calls</p>
    <div className="dashboard-grid" data-fixture-dashboard>
      <AkiPulseScoped
        funnel={
          kind !== "fleet"
            ? {
                available: true,
                scope: kind === "organisation" ? "organisation" : "workspace",
                organisation_coverage:
                  kind === "organisation"
                    ? { included_workspaces: 2, excluded_workspaces: 1 }
                    : undefined,
                days: 7,
                stages: {
                  claim_completed: 1,
                  checkout_started: 2,
                  payment_verified: 1,
                },
                coverage: "consented_verified_observations_only",
                retention_days: 90,
                collection_started_at: "2026-10-20T00:00:00Z",
                claim_stage_available: true,
                cta_attribution_available: false,
                conversion_rate_available: false,
                hq_activation_definition: "owner_created_management_workspace",
              }
            : { available: false, reason: "scope_mapping_unsupported" }
        }
        rentalLink={
          kind === "fleet" ? (
            <RentalPulseWorkspaceLink
              locale={locale}
              company={id}
              links={{
                can_link: true,
                options: [
                  {
                    id: "synthetic-owned",
                    name: "Synthetic owned operating workspace",
                  },
                ],
                current: null,
                has_link: false,
              }}
              page={0}
              days={7}
            />
          ) : undefined
        }
        nativeReady
        locale={locale}
        kind={kind}
        selected={id}
        scopes={[{ id, name: "Synthetic authorised business" }]}
        report={params.get("denied") ? null : data}
        unavailable={params.has("denied")}
        page={1}
        hasMore
        days={7}
      />
      <aside>Adjacent dashboard panel · synthetic fixture</aside>
    </div>
  </>,
);
document.addEventListener("submit", (event) => event.preventDefault());
