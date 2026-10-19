import { z } from "zod";

export const rentalCategories = [
  "mini",
  "economy",
  "compact",
  "suv",
  "people_carrier",
  "premium",
  "electric",
  "van",
] as const;
export const rentalCategoryLabels: Record<
  (typeof rentalCategories)[number],
  { en: string; es: string }
> = {
  mini: { en: "Mini", es: "Mini" },
  economy: { en: "Economy", es: "Económico" },
  compact: { en: "Compact", es: "Compacto" },
  suv: { en: "SUV", es: "SUV" },
  people_carrier: { en: "People carrier", es: "Monovolumen" },
  premium: { en: "Premium", es: "Premium" },
  electric: { en: "Electric", es: "Eléctrico" },
  van: { en: "Van", es: "Furgoneta" },
};

export const validDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
    );
  });

export const rentalSearchSchema = z
  .object({
    q: z.string().trim().max(100).default(""),
    city: z.string().trim().max(100).default(""),
    category: z.enum(rentalCategories).or(z.literal("all")).default("all"),
    start: validDate.optional(),
    end: validDate.optional(),
    min: z.coerce.number().int().min(100).max(1_000_000).optional(),
    max: z.coerce.number().int().min(100).max(1_000_000).optional(),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    bounds: z.string().optional(),
  })
  .refine((value) => {
    if (!value.start && !value.end) return true;
    if (!value.start || !value.end || value.end <= value.start) return false;
    return (
      (Date.parse(`${value.end}T00:00:00Z`) -
        Date.parse(`${value.start}T00:00:00Z`)) /
        86_400_000 <=
      30
    );
  })
  .refine(
    (value) =>
      value.min === undefined ||
      value.max === undefined ||
      value.min <= value.max,
  );

export type RentalListing = {
  vehicle_id: string;
  vehicle_name: string;
  category: (typeof rentalCategories)[number];
  transmission: "manual" | "automatic";
  fuel: string;
  seats: number;
  luggage: number;
  daily_price_cents: number;
  deposit_cents: number;
  image_url: string | null;
  company_id: string;
  company_slug: string;
  company_name: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  total: number;
};

export function formatRentalPrice(cents: number, locale: "en" | "es") {
  return new Intl.NumberFormat(locale === "es" ? "es-ES" : "en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function rentalEurosToCents(euros: number) {
  return Math.round(euros * 100);
}

export function rentalDays(start: string, end: string) {
  return (
    (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) /
    86_400_000
  );
}

// Optional for compatibility with existing rate-only clients. Supplied fields
// are validated before either legacy-owner or venue-manager mutations.
export const rentalVehicleEditFields = {
  name: z.string().trim().min(2).max(120).optional(),
  category: z.enum(rentalCategories).optional(),
  transmission: z.enum(["manual", "automatic"]).optional(),
  fuel: z.enum(["petrol", "diesel", "hybrid", "electric", "other"]).optional(),
  seats: z.coerce.number().int().min(2).max(9).optional(),
  luggage: z.coerce.number().int().min(0).max(12).optional(),
};
export function rentalVehicleEditValues(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.keys(rentalVehicleEditFields).flatMap((key) =>
      input[key] === undefined ? [] : [[key, input[key]]],
    ),
  );
}
