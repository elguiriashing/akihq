import { z } from "zod";
export const bookingRequestSchema = z.object({
  locale: z.enum(["es", "en"]),
  slug: z.string().min(1).max(180),
  venueId: z.string().uuid(),
  slotId: z.string().uuid(),
  requestKey: z.string().uuid(),
  partySize: z.coerce.number().int().min(1).max(100),
  contactName: z.string().trim().min(2).max(120),
  contactEmail: z.string().trim().email().max(254),
  contactPhone: z.string().trim().max(40).default(""),
  notes: z.string().trim().max(1000).default(""),
});
export type BookingSubmissionResult = { error: string; remaining?: number };
export function bookingGuestLimit(
  slot: { capacity: number; remaining?: number } | undefined,
) {
  if (
    !slot ||
    !Number.isFinite(slot.capacity) ||
    !Number.isFinite(slot.remaining ?? slot.capacity)
  )
    return 0;
  return Math.max(
    0,
    Math.floor(Math.min(100, slot.capacity, slot.remaining ?? slot.capacity)),
  );
}
export type BookingTab =
  | "inbox"
  | "calendar"
  | "offerings"
  | "setup"
  | "resources";
export function bookingTab(value?: string | null): BookingTab {
  return value === "calendar" ||
    value === "offerings" ||
    value === "setup" ||
    value === "resources"
    ? value
    : "inbox";
}
