"use server";

import {
  rentalVehicleEditFields,
  rentalVehicleEditValues,
} from "@/lib/akiconduzco";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { isLocale } from "@/lib/config";
import { rentalEurosToCents } from "@/lib/akiconduzco";

function location(locale: "en" | "es", query: string, formData?: FormData) {
  const company = String(formData?.get("companyId") || "");
  return `/${locale}/business/mobility?${query}${/^[0-9a-f-]{36}$/i.test(company) ? "&company=" + company : ""}${formData?.get("tab") ? "&tab=" + encodeURIComponent(String(formData.get("tab"))) : ""}`;
}

export async function createRentalCompany(formData: FormData) {
  const localeValue = String(formData.get("locale"));
  const locale = isLocale(localeValue) ? localeValue : "es";
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(120),
      city: z.string().trim().min(2).max(100),
      address: z.string().trim().min(4).max(240),
      latitude: z.coerce.number().min(27).max(44),
      longitude: z.coerce.number().min(-19).max(5),
      website: z
        .union([
          z.literal(""),
          z
            .string()
            .url()
            .refine((url) => new URL(url).protocol === "https:"),
        ])
        .default(""),
      phone: z.string().trim().min(7).max(40),
      addressSelection: z.literal("selected"),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(location(locale, "error=company", formData));
  const { supabase, user } = await requireUser(
    locale,
    `/${locale}/business/mobility`,
  );
  const base =
    parsed.data.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "rental-company";
  const slug = `${base}-${crypto.randomUUID().slice(0, 8)}`;
  const { error } = await supabase.from("car_rental_companies").insert({
    slug,
    name: parsed.data.name,
    city: parsed.data.city,
    address: parsed.data.address,
    latitude: parsed.data.latitude,
    longitude: parsed.data.longitude,
    website_url: parsed.data.website || null,
    phone: parsed.data.phone || null,
    submitted_by: user.id,
    status: "pending_review",
  });
  if (error) redirect(location(locale, "error=company", formData));
  revalidatePath(`/${locale}/business/mobility`);
  redirect(location(locale, "created=company", formData));
}

export async function createRentalVehicle(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const parsed = z
    .object({
      companyId: z.string().uuid(),
      name: z.string().trim().min(2).max(120),
      coverMediaId: z.union([z.string().uuid(), z.literal("")]).optional(),
      category: z.enum([
        "mini",
        "economy",
        "compact",
        "suv",
        "people_carrier",
        "premium",
        "electric",
        "van",
      ]),
      transmission: z.enum(["manual", "automatic"]),
      fuel: z.enum(["petrol", "diesel", "hybrid", "electric", "other"]),
      seats: z.coerce.number().int().min(2).max(9),
      luggage: z.coerce.number().int().min(0).max(12),
      dailyPrice: z.coerce.number().int().min(1).max(10000),
      deposit: z.coerce.number().int().min(0).max(50000),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(location(locale, "error=vehicle", formData));
  const { supabase } = await requireUser(
    locale,
    `/${locale}/business/mobility`,
  );
  const { error } = await supabase.from("car_rental_vehicles").insert({
    company_id: parsed.data.companyId,
    rental_media_id: parsed.data.coverMediaId || null,
    name: parsed.data.name,
    category: parsed.data.category,
    transmission: parsed.data.transmission,
    fuel: parsed.data.fuel,
    seats: parsed.data.seats,
    luggage: parsed.data.luggage,
    daily_price_cents: rentalEurosToCents(parsed.data.dailyPrice),
    deposit_cents: rentalEurosToCents(parsed.data.deposit),
    active: true,
  });
  if (error) redirect(location(locale, "error=vehicle", formData));
  revalidatePath(`/${locale}/business/mobility`);
  redirect(location(locale, "created=vehicle", formData));
}

export async function updateRentalVehicle(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const parsed = z
    .object({
      ...rentalVehicleEditFields,
      companyId: z.string().uuid(),
      vehicleId: z.string().uuid(),
      dailyPrice: z.coerce.number().int().min(1).max(10000),
      deposit: z.coerce.number().int().min(0).max(50000),
      active: z.enum(["true", "false"]),
      coverMediaId: z.union([z.string().uuid(), z.literal("")]).optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(location(locale, "error=vehicle", formData));
  const { supabase } = await requireUser(
    locale,
    `/${locale}/business/mobility`,
  );
  const { error } = await supabase
    .from("car_rental_vehicles")
    .update({
      ...rentalVehicleEditValues(parsed.data),
      daily_price_cents: rentalEurosToCents(parsed.data.dailyPrice),
      deposit_cents: rentalEurosToCents(parsed.data.deposit),
      active: parsed.data.active === "true",
      ...(parsed.data.coverMediaId !== undefined
        ? { rental_media_id: parsed.data.coverMediaId || null }
        : {}),
    })
    .eq("id", parsed.data.vehicleId)
    .eq("company_id", parsed.data.companyId);
  if (error) redirect(location(locale, "error=vehicle", formData));
  revalidatePath(`/${locale}/business/mobility`);
  redirect(location(locale, "updated=vehicle", formData));
}

export async function createRentalBlock(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const parsed = z
    .object({
      companyId: z.string().uuid(),
      vehicleId: z.string().uuid(),
      start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .refine(
      (value) =>
        value.end > value.start &&
        value.start >= new Date().toISOString().slice(0, 10),
    )
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect(location(locale, "error=availability", formData));
  const { supabase } = await requireUser(
    locale,
    `/${locale}/business/mobility`,
  );
  const { error } = await supabase.from("car_rental_calendar_blocks").insert({
    vehicle_id: parsed.data.vehicleId,
    start_date: parsed.data.start,
    end_date: parsed.data.end,
    reason: "maintenance",
  });
  if (error)
    redirect(
      location(
        locale,
        error.code === "PT409" ? "error=overlap" : "error=availability",
        formData,
      ),
    );
  revalidatePath(`/${locale}/business/mobility`);
  redirect(location(locale, "created=availability", formData));
}

export async function updateRentalBookingStatus(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const parsed = z
    .object({
      bookingId: z.string().uuid(),
      status: z.enum(["confirmed", "declined", "cancelled", "completed"]),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(location(locale, "error=booking", formData));
  const { supabase } = await requireUser(
    locale,
    `/${locale}/business/mobility`,
  );
  const { error } = await supabase.rpc("set_car_rental_booking_status", {
    p_booking: parsed.data.bookingId,
    p_status: parsed.data.status,
  });
  if (error)
    redirect(
      location(
        locale,
        error.code === "PT409" ? "error=overlap" : "error=booking",
        formData,
      ),
    );
  revalidatePath(`/${locale}/business/mobility`);
  redirect(location(locale, "updated=booking", formData));
}

export async function removeRentalBlock(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const parsed = z
    .object({
      companyId: z.string().uuid(),
      vehicleId: z.string().uuid(),
      blockId: z.string().uuid(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect(location(locale, "error=availability", formData));
  const { supabase } = await requireUser(
    locale,
    `/${locale}/business/mobility`,
  );
  const { data: allowed } = await supabase.rpc("can_manage_rental_company", {
    p_company: parsed.data.companyId,
  });
  if (!allowed) redirect(location(locale, "error=availability", formData));
  const { data: company } = await supabase
    .from("car_rental_companies")
    .select("id")
    .eq("id", parsed.data.companyId)
    .maybeSingle();
  if (!company) redirect(location(locale, "error=availability", formData));
  const { data: vehicle } = await supabase
    .from("car_rental_vehicles")
    .select("id")
    .eq("id", parsed.data.vehicleId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!vehicle) redirect(location(locale, "error=availability", formData));
  const { data: removed, error } = await supabase
    .from("car_rental_calendar_blocks")
    .delete()
    .eq("id", parsed.data.blockId)
    .eq("vehicle_id", vehicle.id)
    .eq("reason", "maintenance")
    .select("id")
    .maybeSingle();
  if (error || !removed)
    redirect(location(locale, "error=availability", formData));
  revalidatePath(`/${locale}/business/mobility`);
  redirect(location(locale, "updated=availability", formData));
}

export async function updateRentalCompany(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const parsed = z
    .object({
      companyId: z.string().uuid(),
      name: z.string().trim().min(2).max(120),
      city: z.string().trim().min(2).max(100),
      address: z.string().trim().min(4).max(240),
      latitude: z.coerce.number().min(27).max(44),
      longitude: z.coerce.number().min(-19).max(5),
      phone: z.string().trim().min(7).max(40),
      website: z.union([
        z.literal(""),
        z
          .string()
          .url()
          .refine((v) => new URL(v).protocol === "https:"),
      ]),
      description_es: z.string().trim().max(2000),
      description_en: z.string().trim().max(2000),
      logo_media_id: z.union([z.literal(""), z.string().uuid()]),
      hero_media_id: z.union([z.literal(""), z.string().uuid()]),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect(location(locale, "error=profile&tab=company", formData));
  const { supabase } = await requireUser(
    locale,
    `/${locale}/business/mobility`,
  );
  const { data: allowed } = await supabase.rpc("can_manage_rental_company", {
    p_company: parsed.data.companyId,
  });
  if (!allowed)
    redirect(location(locale, "error=profile&tab=company", formData));
  const { companyId, website, ...values } = parsed.data;
  const { data, error } = await supabase
    .from("car_rental_companies")
    .update({
      ...values,
      website_url: website || null,
      logo_media_id: values.logo_media_id || null,
      hero_media_id: values.hero_media_id || null,
    })
    .eq("id", companyId)
    .select("id")
    .maybeSingle();
  if (error || !data)
    redirect(location(locale, "error=profile&tab=company", formData));
  revalidatePath(`/${locale}/business`);
  revalidatePath(`/${locale}/business/mobility`);
  redirect(location(locale, "updated=profile&tab=company", formData));
}
export async function deleteRentalMedia(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const parsed = z
    .object({ companyId: z.string().uuid(), mediaId: z.string().uuid() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect(location(locale, "error=media&tab=media", formData));
  const { supabase } = await requireUser(
    locale,
    `/${locale}/business/mobility`,
  );
  const { data: allowed } = await supabase.rpc("can_manage_rental_company", {
    p_company: parsed.data.companyId,
  });
  if (!allowed) redirect(location(locale, "error=media&tab=media", formData));
  const { data: item } = await supabase
    .from("car_rental_media")
    .select("id,storage_path,storage_bucket")
    .eq("id", parsed.data.mediaId)
    .eq("company_id", parsed.data.companyId)
    .maybeSingle();
  if (!item) redirect(location(locale, "error=media&tab=media", formData));
  // Legacy originals remain with their original owner; only copied branch files are removed.
  if (item.storage_bucket === "rental-media") {
    const { error } = await supabase.storage
      .from("rental-media")
      .remove([item.storage_path]);
    if (error) redirect(location(locale, "error=media&tab=media", formData));
  }
  const { error } = await supabase
    .from("car_rental_media")
    .delete()
    .eq("id", item.id)
    .eq("company_id", parsed.data.companyId);
  if (error) redirect(location(locale, "error=media&tab=media", formData));
  revalidatePath(`/${locale}/business/mobility`);
  redirect(location(locale, "updated=media&tab=media", formData));
}
