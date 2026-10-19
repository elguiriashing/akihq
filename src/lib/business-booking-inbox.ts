import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export const BOOKING_INBOX_PAGE_SIZE = 20;
export const bookingInboxStatuses = [
  "all",
  "requested",
  "confirmed",
  "completed",
  "declined",
  "cancelled",
] as const;
export type BookingInboxFilters = {
  search: string;
  status: (typeof bookingInboxStatuses)[number];
  sort: "newest" | "oldest";
  page: number;
};

const inboxSchema = z.object({
  bookingSearch: z.preprocess(
    (value) => (typeof value === "string" ? value.trim().slice(0, 80) : ""),
    z.string(),
  ),
  bookingStatus: z.enum(bookingInboxStatuses).catch("all"),
  bookingSort: z.enum(["newest", "oldest"]).catch("newest"),
  bookingPage: z.coerce.number().int().positive().finite().catch(1),
});

export function parseBookingInbox(
  query: Record<string, unknown>,
): BookingInboxFilters {
  const parsed = inboxSchema.parse(query);
  return {
    search: parsed.bookingSearch,
    status: parsed.bookingStatus,
    sort: parsed.bookingSort,
    page: Number.isSafeInteger(parsed.bookingPage)
      ? Math.min(parsed.bookingPage, 50000)
      : 1,
  };
}

export function bookingInboxHref(
  locale: string,
  venueId: string,
  filters: BookingInboxFilters,
) {
  const query = new URLSearchParams({
    section: "bookings",
    bookingTab: "inbox",
    bookingStatus: filters.status,
    bookingSort: filters.sort,
    bookingPage: String(filters.page),
  });
  if (filters.search) query.set("bookingSearch", filters.search);
  return `/${locale}/business/venue/${venueId}?${query}#booking-inbox`;
}

export function bookingInboxQuery(
  client: SupabaseClient,
  venueId: string,
  filters: BookingInboxFilters,
) {
  let query = client
    .from("booking_requests")
    .select(
      "id,slot_id,party_size,contact_name,contact_email,contact_phone,notes,status,created_at,venue_availability_slots(starts_at,ends_at,offering_id)",
      { count: "exact" },
    )
    .eq("venue_id", venueId);
  if (filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.search) {
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        filters.search,
      )
    ) {
      query = query.eq("id", filters.search);
    } else {
      // Escape LIKE literals before quoting the PostgREST grammar value.
      // Parentheses, commas and quotes remain searchable, never operators.
      const pattern = filters.search.replace(/[\\%_]/g, "\\$&");
      const literal = `"%${pattern.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}%"`;
      query = query.or(
        `contact_name.ilike.${literal},contact_email.ilike.${literal},contact_phone.ilike.${literal}`,
      );
    }
  }
  const start = (filters.page - 1) * BOOKING_INBOX_PAGE_SIZE;
  return query
    .order("created_at", { ascending: filters.sort === "oldest" })
    .order("id", { ascending: filters.sort === "oldest" })
    .range(start, start + BOOKING_INBOX_PAGE_SIZE - 1);
}

export async function loadBookingInbox(
  client: SupabaseClient,
  venueId: string,
  filters: BookingInboxFilters,
) {
  let result = await bookingInboxQuery(client, venueId, filters);
  const pages = Math.max(
    1,
    Math.ceil((result.count || 0) / BOOKING_INBOX_PAGE_SIZE),
  );
  const page = result.error ? filters.page : Math.min(filters.page, pages);
  if (page !== filters.page)
    result = await bookingInboxQuery(client, venueId, { ...filters, page });
  const ids = (result.data || []).map((row) => row.id as string);
  const notifications = ids.length
    ? await client
        .from("booking_confirmation_emails")
        .select("booking_id,audience,status,last_error")
        .eq("venue_id", venueId)
        .in("booking_id", ids)
    : { data: [], error: null };
  return {
    requests: (result.data || []).map((row) => ({
      ...row,
      venue_availability_slots: Array.isArray(row.venue_availability_slots)
        ? row.venue_availability_slots[0] || null
        : row.venue_availability_slots,
    })),
    notifications: notifications.data || [],
    total: result.count || 0,
    filters: { ...filters, page },
    error: Boolean(result.error),
    notificationError: Boolean(notifications.error),
  };
}
