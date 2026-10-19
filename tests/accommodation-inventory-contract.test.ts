import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20261009220000_accommodation_inventory_foundation.sql",
  "utf8",
);

describe("accommodation room-night inventory contract", () => {
  it("uses exclusive checkout dates and excludes overlapping active reservations", () => {
    expect(sql).toContain("daterange(check_in,check_out,'[)')");
    expect(sql).toContain(
      "where (status in ('requested','confirmed','checked_in'))",
    );
    expect(sql).toContain("unique (venue_id,idempotency_key)");
  });
  it("checks maintenance blocks against bookings with a shared lock", () => {
    expect(sql).toContain("for update;");
    expect(sql).toContain("accommodation_booking_guard");
    expect(sql).toContain("accommodation_block_guard");
    expect(sql).toContain("Unit unavailable for selected nights");
  });
  it("denies public and consumer reservation insertion until verified RPC exists", () => {
    expect(sql).toContain("revoke all on public.%I from anon,authenticated");
    expect(sql).toContain(
      "grant select on public.accommodation_reservations to authenticated",
    );
    expect(sql).not.toContain(
      "grant insert on public.accommodation_reservations",
    );
    expect(sql).not.toContain(
      "create policy accommodation_reservations_public",
    );
  });
});
