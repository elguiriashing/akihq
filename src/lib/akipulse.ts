/** Derived only from tenant-authorised venue_analytics RPC aggregates. */
export type PulseRow = { action: string; total: number | string };
export type PulseMetric = { action: string; current: number; previous: number };
export function pulsePeriod(value?: string): 7 | 30 | 90 {
  return value === "7" ? 7 : value === "90" ? 90 : 30;
}
export function aggregatePulse(
  rows: Array<PulseMetric[] | null>,
): PulseMetric[] | null {
  if (rows.some((row) => row === null)) return null;
  const totals = new Map<string, PulseMetric>();
  for (const row of rows)
    for (const metric of row || []) {
      const total = totals.get(metric.action) || {
        action: metric.action,
        current: 0,
        previous: 0,
      };
      total.current += metric.current;
      total.previous += metric.previous;
      if (
        !Number.isSafeInteger(total.current) ||
        !Number.isSafeInteger(total.previous)
      )
        return null;
      totals.set(metric.action, total);
    }
  return [...totals.values()].sort((a, b) => b.current - a.current);
}
/** A fixed upper bound prevents late-arriving/future rows changing period identity. */
export function pulseFromEvents(
  events: Array<{ action: string; occurred_at: string }>,
  days: number,
  until: number,
): PulseMetric[] | null {
  const boundary = until - days * 86400000;
  const start = boundary - days * 86400000;
  const totals = new Map<string, PulseMetric>();
  for (const event of events) {
    const timestamp = Date.parse(event.occurred_at);
    if (!Number.isFinite(timestamp) || timestamp < start || timestamp >= until)
      return null;
    const value = totals.get(event.action) || {
      action: event.action,
      current: 0,
      previous: 0,
    };
    if (timestamp >= boundary) value.current++;
    else value.previous++;
    totals.set(event.action, value);
  }
  return [...totals.values()];
}

/** Transparent content readiness only; not a revenue or growth prediction. */
export function listingCompleteness(value: {
  name: string;
  status: string;
  address?: string | null;
  description_es?: string | null;
  description_en?: string | null;
  phone?: string | null;
  website_url?: string | null;
}) {
  const text = (input: unknown) =>
    typeof input === "string" && input.trim().length > 0;
  const checks = [
    { key: "name", complete: text(value.name) },
    {
      key: "address",
      complete: value.address === undefined ? null : text(value.address),
    },
    {
      key: "description",
      complete:
        value.description_es === undefined && value.description_en === undefined
          ? null
          : text(value.description_es) || text(value.description_en),
    },
    {
      key: "contact",
      complete:
        value.phone === undefined && value.website_url === undefined
          ? null
          : text(value.phone) || text(value.website_url),
    },
    { key: "published", complete: value.status === "published" },
  ];
  return {
    checks,
    score: checks.some((check) => check.complete === null)
      ? null
      : checks.filter((check) => check.complete).length * 20,
  };
}
