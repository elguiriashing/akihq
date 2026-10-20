import { z } from "zod";
export const pulseScopeKind = z.enum([
  "venue",
  "property",
  "fleet",
  "organisation",
]);
export const pulseScopeQuery = z.object({
  pulseKind: pulseScopeKind.catch("venue"),
  pulseResource: z.string().uuid().optional().catch(undefined),
  pulsePage: z.coerce.number().int().min(0).max(200).catch(0),
});
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const row = z.object({
  source: z.enum(["venue", "accommodation", "fleet"]),
  period: z.enum(["current", "previous"]),
  status: z.string().max(32),
  total: count,
});
export const pulseScopedReport = z.object({
  version: z.literal(1),
  kind: pulseScopeKind,
  id: z.string().uuid(),
  name: z.string().max(200),
  period: z.object({
    days: z.union([z.literal(7), z.literal(30), z.literal(90)]),
    until: z.string().datetime({ offset: true }),
    current_from: z.string().datetime({ offset: true }),
    previous_from: z.string().datetime({ offset: true }),
  }),
  coverage: z.object({
    measured_venues: count,
    excluded_locations: count,
    current_active_units: count.nullable(),
    current_active_vehicles: count.nullable(),
  }),
  bookings: z.array(row).max(128),
  interactions: z
    .array(
      z.object({ action: z.string().max(64), current: count, previous: count }),
    )
    .max(32),
  commercial_funnel: z.object({
    available: z.literal(false),
    reason: z.literal("no_scoped_verified_attribution_adapter"),
  }),
  acquisition_sources: z.object({ available: z.literal(false) }),
  revenue_available: z.literal(false),
});
export type PulseScopedReport = z.infer<typeof pulseScopedReport>;
export type PulseScope = { id: string; name: string };
/** Never accept a report for another tenant, resource, period or scope kind. */
export function readPulseScopedReport(
  value: unknown,
  kind: z.infer<typeof pulseScopeKind>,
  id: string,
  days: number,
  until: string,
) {
  const parsed = pulseScopedReport.safeParse(value);
  return parsed.success &&
    parsed.data.kind === kind &&
    parsed.data.id === id &&
    parsed.data.period.days === days &&
    Date.parse(parsed.data.period.until) === Date.parse(until) &&
    Date.parse(parsed.data.period.current_from) ===
      Date.parse(until) - days * 86400000 &&
    Date.parse(parsed.data.period.previous_from) ===
      Date.parse(until) - days * 2 * 86400000
    ? parsed.data
    : null;
}
