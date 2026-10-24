"use server";

import {
  rentalVehicleEditFields,
  rentalVehicleEditValues,
} from "@/lib/akiconduzco";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { dispatchBookingConfirmations } from "@/lib/booking-mail-delivery";
import {
  bookingInboxHref,
  parseBookingInbox,
} from "@/lib/business-booking-inbox";
import {
  storeListingUpload,
  discardListingUpload,
  ListingUploadError,
  type StoredListingUpload,
} from "@/lib/listing-upload";
import { authorizedSuiteMedia } from "@/lib/akisuite-media";
import { requireBusinessAccess } from "@/lib/entitlements";
import { safeExternalUrlSchema } from "@/lib/auth-security";
import { madridLocalDateTimeSchema } from "@/lib/time";
import { reviewPendingCatalogueItem } from "@/lib/automatic-moderation";
import {
  translateLocalizedFields,
  translateSubmittedLocalizedFields,
  translateVenueCatalogueDocument,
} from "@/lib/localized-copy";
import type { VenueCatalogueDocument } from "@/lib/venue-catalogue";

const context = z.object({
  locale: z.enum(["es", "en"]),
  venueId: z.string().uuid(),
});
function destination(locale: string, venueId: string, result: string) {
  return `/${locale}/business/venue/${venueId}?${result}`;
}

function fleetDestination(locale: string, venueId: string, result: string) {
  return destination(locale, venueId, `section=fleet&${result}`);
}

async function requireFleetManager(locale: "en" | "es", venueId: string) {
  const access = await requireBusinessAccess(locale);
  const { data, error } = await access.supabase.rpc("is_venue_member", {
    target_venue: venueId,
    allowed_roles: ["owner", "manager"],
  });
  if (error || !data)
    redirect(fleetDestination(locale, venueId, "error=fleet-permission"));
  return access;
}

export async function createVenueRentalCompany(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "es";
  redirect(`/${locale}/business/mobility?new=1`);
}

export async function createVenueRentalVehicle(formData: FormData) {
  const parsed = z
    .object({
      locale: z.enum(["en", "es"]),
      venueId: z.string().uuid(),
      companyId: z.string().uuid(),
      name: z.string().trim().min(2).max(120),
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
      mediaId: z.union([z.string().uuid(), z.literal("")]).default(""),
    })
    .safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  if (!parsed.success)
    redirect(fleetDestination(locale, venueId, "error=fleet"));
  const { supabase } = await requireFleetManager(
    parsed.data.locale,
    parsed.data.venueId,
  );
  const { data: company } = await supabase
    .from("car_rental_companies")
    .select("id")
    .eq("id", parsed.data.companyId)
    .eq("venue_id", parsed.data.venueId)
    .maybeSingle();
  if (!company) redirect(fleetDestination(locale, venueId, "error=fleet"));
  if (parsed.data.mediaId) {
    const { data: media } = await supabase
      .from("venue_media")
      .select("id")
      .eq("id", parsed.data.mediaId)
      .eq("venue_id", parsed.data.venueId)
      .maybeSingle();
    if (!media) redirect(fleetDestination(locale, venueId, "error=fleet"));
  }
  const { error } = await supabase.from("car_rental_vehicles").insert({
    company_id: parsed.data.companyId,
    name: parsed.data.name,
    category: parsed.data.category,
    transmission: parsed.data.transmission,
    fuel: parsed.data.fuel,
    seats: parsed.data.seats,
    luggage: parsed.data.luggage,
    daily_price_cents: parsed.data.dailyPrice * 100,
    deposit_cents: parsed.data.deposit * 100,
    cover_media_id: parsed.data.mediaId || null,
    active: true,
  });
  revalidatePath(`/${locale}/business/venue/${venueId}`);
  redirect(
    fleetDestination(locale, venueId, error ? "error=fleet" : "updated=fleet"),
  );
}

export async function updateVenueRentalVehicle(formData: FormData) {
  const parsed = z
    .object({
      ...rentalVehicleEditFields,
      locale: z.enum(["en", "es"]),
      venueId: z.string().uuid(),
      companyId: z.string().uuid(),
      vehicleId: z.string().uuid(),
      active: z.enum(["true", "false"]),
      dailyPrice: z.coerce.number().int().min(1).max(10000),
      deposit: z.coerce.number().int().min(0).max(50000),
      mediaId: z.union([z.string().uuid(), z.literal("")]).default(""),
    })
    .safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  if (!parsed.success)
    redirect(fleetDestination(locale, venueId, "error=fleet"));
  const { supabase } = await requireFleetManager(
    parsed.data.locale,
    parsed.data.venueId,
  );
  const { data: company } = await supabase
    .from("car_rental_companies")
    .select("id")
    .eq("id", parsed.data.companyId)
    .eq("venue_id", parsed.data.venueId)
    .maybeSingle();
  if (!company) redirect(fleetDestination(locale, venueId, "error=fleet"));
  if (parsed.data.mediaId) {
    const { data: media } = await supabase
      .from("venue_media")
      .select("id")
      .eq("id", parsed.data.mediaId)
      .eq("venue_id", parsed.data.venueId)
      .maybeSingle();
    if (!media) redirect(fleetDestination(locale, venueId, "error=fleet"));
  }
  const { error } = await supabase
    .from("car_rental_vehicles")
    .update({
      ...rentalVehicleEditValues(parsed.data),
      active: parsed.data.active === "true",
      daily_price_cents: parsed.data.dailyPrice * 100,
      deposit_cents: parsed.data.deposit * 100,
      cover_media_id: parsed.data.mediaId || null,
    })
    .eq("id", parsed.data.vehicleId)
    .eq("company_id", parsed.data.companyId);
  revalidatePath(`/${locale}/business/venue/${venueId}`);
  redirect(
    fleetDestination(locale, venueId, error ? "error=fleet" : "updated=fleet"),
  );
}

export async function createVenueRentalBlock(formData: FormData) {
  const parsed = z
    .object({
      locale: z.enum(["en", "es"]),
      venueId: z.string().uuid(),
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
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  if (!parsed.success)
    redirect(fleetDestination(locale, venueId, "error=availability"));
  const { supabase } = await requireFleetManager(
    parsed.data.locale,
    parsed.data.venueId,
  );
  const { data: company } = await supabase
    .from("car_rental_companies")
    .select("id")
    .eq("id", parsed.data.companyId)
    .eq("venue_id", parsed.data.venueId)
    .maybeSingle();
  const { data: vehicle } = company
    ? await supabase
        .from("car_rental_vehicles")
        .select("id")
        .eq("id", parsed.data.vehicleId)
        .eq("company_id", company.id)
        .maybeSingle()
    : { data: null };
  if (!vehicle)
    redirect(fleetDestination(locale, venueId, "error=availability"));
  const { error } = await supabase.from("car_rental_calendar_blocks").insert({
    vehicle_id: vehicle.id,
    start_date: parsed.data.start,
    end_date: parsed.data.end,
    reason: "maintenance",
  });
  revalidatePath(`/${locale}/business/venue/${venueId}`);
  redirect(
    fleetDestination(
      locale,
      venueId,
      error ? "error=availability" : "updated=fleet",
    ),
  );
}

export async function updateVenueRentalBookingStatus(formData: FormData) {
  const parsed = z
    .object({
      locale: z.enum(["en", "es"]),
      venueId: z.string().uuid(),
      companyId: z.string().uuid(),
      bookingId: z.string().uuid(),
      status: z.enum(["confirmed", "declined", "cancelled", "completed"]),
    })
    .safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  if (!parsed.success)
    redirect(fleetDestination(locale, venueId, "error=booking"));
  const { supabase } = await requireFleetManager(
    parsed.data.locale,
    parsed.data.venueId,
  );
  const { data: booking } = await supabase
    .from("car_rental_bookings")
    .select("id,vehicle:car_rental_vehicles!inner(company_id)")
    .eq("id", parsed.data.bookingId)
    .eq("vehicle.company_id", parsed.data.companyId)
    .maybeSingle();
  const { data: company } = await supabase
    .from("car_rental_companies")
    .select("id")
    .eq("id", parsed.data.companyId)
    .eq("venue_id", parsed.data.venueId)
    .maybeSingle();
  if (!company || !booking)
    redirect(fleetDestination(locale, venueId, "error=booking"));
  const { error } = await supabase.rpc("set_car_rental_booking_status", {
    p_booking: parsed.data.bookingId,
    p_status: parsed.data.status,
  });
  revalidatePath(`/${locale}/business/venue/${venueId}`);
  redirect(
    fleetDestination(
      locale,
      venueId,
      error ? "error=booking" : "updated=fleet",
    ),
  );
}

export async function updateVenue(formData: FormData) {
  const parsed = context
    .extend({
      name: z.string().trim().min(2).max(120),
      description: z.string().trim().min(20).max(2000),
      address: z.string().trim().min(5).max(300),
      addressSelection: z.enum(["selected", "unchanged"]),
      locality: z.string().trim().max(120),
      province: z.string().trim().max(120),
      latitude: z.union([z.literal(""), z.coerce.number().min(27).max(44.5)]),
      longitude: z.union([z.literal(""), z.coerce.number().min(-19).max(5)]),
      accessible: z.string().optional(),
      contactPhone: z.union([
        z.literal(""),
        z.string().regex(/^\+[1-9][0-9]{7,14}$/),
      ]),
      whatsappPhone: z.union([
        z.literal(""),
        z.string().regex(/^\+[1-9][0-9]{7,14}$/),
      ]),
      websiteUrl: safeExternalUrlSchema,
    })
    .safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  if (!parsed.success) redirect(destination(locale, venueId, "error=venue"));
  const { supabase, user } = await requireBusinessAccess(locale);
  const { data: currentVenue } = await supabase
    .from("venues")
    .select("description_es,description_en,verified")
    .eq("id", parsed.data.venueId)
    .maybeSingle();
  if (!currentVenue) redirect(destination(locale, venueId, "error=venue"));

  let localizedDescription;
  try {
    localizedDescription = (
      await translateSubmittedLocalizedFields(
        locale,
        { description: parsed.data.description },
        user.id,
        {
          description: {
            es: currentVenue.description_es || "",
            en: currentVenue.description_en || "",
          },
        },
      )
    ).description;
  } catch {
    redirect(destination(locale, venueId, "error=translation"));
  }
  if (parsed.data.addressSelection === "selected") {
    if (
      !parsed.data.locality ||
      !parsed.data.province ||
      parsed.data.latitude === "" ||
      parsed.data.longitude === ""
    ) {
      redirect(destination(locale, venueId, "error=venue"));
    }
    const { error: locationError } = await supabase.rpc(
      "update_venue_location_in_spain",
      {
        p_venue: parsed.data.venueId,
        p_locality_name: parsed.data.locality,
        p_province_name: parsed.data.province,
        p_address: parsed.data.address,
        p_latitude: parsed.data.latitude,
        p_longitude: parsed.data.longitude,
      },
    );
    if (locationError) redirect(destination(locale, venueId, "error=venue"));
  }
  const { error } = await supabase
    .from("venues")
    .update({
      name: parsed.data.name,
      description_es: localizedDescription.es,
      description_en: localizedDescription.en,
      accessibility: { step_free: parsed.data.accessible === "on" },
      contact_phone: parsed.data.contactPhone || null,
      whatsapp_phone: parsed.data.whatsappPhone || null,
      website_url: parsed.data.websiteUrl || null,
      status: currentVenue.verified ? "published" : "pending",
    })
    .eq("id", parsed.data.venueId);
  if (error) redirect(destination(locale, venueId, "error=venue"));
  if (!currentVenue.verified) {
    await reviewPendingCatalogueItem({
      targetType: "venue",
      targetId: parsed.data.venueId,
      requesterId: user.id,
    });
  }
  revalidatePath(destination(locale, venueId, ""));
  redirect(destination(locale, venueId, "updated=venue"));
}

export async function updateEvent(formData: FormData) {
  const inline = formData.get("inline") === "1";
  const parsed = context
    .extend({
      eventId: z.string().uuid(),
      catalogueSectionIds: z.string().max(8000).default("[]"),
      title: z.string().trim().min(3).max(160),
      description: z.string().trim().min(20).max(4000),
      priceEuros: z.coerce.number().min(0).max(10000),
      priceDisplayMode: z.enum(["show", "hide"]).default("show"),
      bannerMediaId: z.union([z.string().uuid(), z.literal("")]).default(""),
      exploreMediaId: z.union([z.string().uuid(), z.literal("")]).default(""),
      profileMediaId: z.union([z.string().uuid(), z.literal("")]).default(""),
      backgroundMediaId: z
        .union([z.string().uuid(), z.literal("")])
        .default(""),
      mapMediaId: z.union([z.string().uuid(), z.literal("")]).default(""),
      bookingUrl: safeExternalUrlSchema,
      minimumAge: z.union([
        z.literal(""),
        z.coerce.number().int().min(0).max(99),
      ]),
      accessibilityNotes: z.string().trim().max(1000),
    })
    .safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  if (!parsed.success) {
    if (inline) return { ok: false as const, error: "event" };
    redirect(destination(locale, venueId, "error=event"));
  }
  const { supabase, user } = await requireBusinessAccess(locale);
  const v = parsed.data;
  const [{ data: currentEvent }, { data: trustedVenue }] = await Promise.all([
    supabase
      .from("events")
      .select(
        "title_es,title_en,description_es,description_en,accessibility_notes_es,accessibility_notes_en",
      )
      .eq("id", v.eventId)
      .eq("venue_id", v.venueId)
      .maybeSingle(),
    supabase
      .from("venues")
      .select("verified")
      .eq("id", v.venueId)
      .maybeSingle(),
  ]);
  if (!currentEvent || !trustedVenue) {
    if (inline) return { ok: false as const, error: "event" };
    redirect(destination(locale, venueId, "error=event"));
  }

  // Menu selections must belong to this venue's catalogue, not another venue.
  let selectedCatalogueSections: string[];
  try {
    const selected = JSON.parse(v.catalogueSectionIds) as unknown;
    if (
      !Array.isArray(selected) ||
      selected.length > 50 ||
      !selected.every((id) => typeof id === "string" && id.length <= 120)
    ) {
      throw new Error("Invalid catalogue section IDs");
    }
    selectedCatalogueSections = [...new Set(selected as string[])];
  } catch {
    if (inline) return { ok: false as const, error: "event" };
    redirect(destination(locale, venueId, "error=event"));
  }
  const { data: venueCatalogue } = await supabase
    .from("venue_catalogues")
    .select("draft_document")
    .eq("venue_id", v.venueId)
    .maybeSingle();
  const availableSections = new Set(
    (venueCatalogue?.draft_document &&
    typeof venueCatalogue.draft_document === "object" &&
    "sections" in venueCatalogue.draft_document &&
    Array.isArray(venueCatalogue.draft_document.sections)
      ? venueCatalogue.draft_document.sections
      : []
    ).flatMap((section: unknown) =>
      section &&
      typeof section === "object" &&
      "id" in section &&
      typeof section.id === "string"
        ? [section.id]
        : [],
    ),
  );
  if (selectedCatalogueSections.some((id) => !availableSections.has(id))) {
    if (inline) return { ok: false as const, error: "event" };
    redirect(destination(locale, venueId, "error=event"));
  }

  let localized;
  try {
    localized = await translateSubmittedLocalizedFields(
      locale,
      {
        title: v.title,
        description: v.description,
        accessibilityNotes: v.accessibilityNotes,
      },
      user.id,
      {
        title: {
          es: currentEvent.title_es || "",
          en: currentEvent.title_en || "",
        },
        description: {
          es: currentEvent.description_es || "",
          en: currentEvent.description_en || "",
        },
        accessibilityNotes: {
          es: currentEvent.accessibility_notes_es || "",
          en: currentEvent.accessibility_notes_en || "",
        },
      },
    );
  } catch {
    if (inline) return { ok: false as const, error: "translation" };
    redirect(destination(locale, venueId, "error=translation"));
  }
  const { error } = await supabase
    .from("events")
    .update({
      title_es: localized.title.es,
      title_en: localized.title.en,
      description_es: localized.description.es,
      description_en: localized.description.en,
      price_cents: Math.round(v.priceEuros * 100),
      price_display_mode: v.priceDisplayMode,
      catalogue_section_ids: selectedCatalogueSections,
      booking_url: v.bookingUrl || null,
      minimum_age: v.minimumAge === "" ? null : v.minimumAge,
      accessibility_notes_es: localized.accessibilityNotes.es || null,
      accessibility_notes_en: localized.accessibilityNotes.en || null,
      status: trustedVenue.verified ? "published" : "pending",
    })
    .eq("id", v.eventId)
    .eq("venue_id", v.venueId);
  if (error) {
    if (inline) return { ok: false as const, error: "event" };
    redirect(destination(locale, venueId, "error=event"));
  }

  const requestedSlots = [
    ["event_banner", v.bannerMediaId],
    ["event_explore", v.exploreMediaId],
    ["event_profile", v.profileMediaId],
    ["event_background", v.backgroundMediaId],
    ["event_map_vertical", v.mapMediaId],
  ] as const;
  const selectedMediaIds = requestedSlots.flatMap(([, mediaId]) =>
    mediaId ? [mediaId] : [],
  );
  const allowedRows =
    process.env.AKISUITE_LISTING_LIBRARY_READY === "true" ||
    (process.env.AKISUITE_FEATURES_READY === "true" &&
      process.env.AKISUITE_SUBSCRIPTIONS_READY === "true")
      ? (
          await Promise.all(
            selectedMediaIds.map((mediaId) =>
              authorizedSuiteMedia(supabase, v.venueId, mediaId),
            ),
          )
        ).filter((row): row is { id: string } => Boolean(row))
      : (
          await supabase
            .from("venue_media")
            .select("id")
            .eq("venue_id", v.venueId)
            .in("id", selectedMediaIds)
        ).data || [];
  if (
    new Set(allowedRows.map((row) => row.id)).size !==
    new Set(selectedMediaIds).size
  ) {
    if (inline) return { ok: false as const, error: "media" };
    redirect(destination(locale, venueId, "error=media"));
  }
  const allowed = new Set((allowedRows || []).map((item) => item.id));

  await supabase
    .from("venue_media_placements")
    .delete()
    .eq("venue_id", v.venueId)
    .eq("target_key", v.eventId)
    .in("placement", [
      "event_banner",
      "event_explore",
      "event_profile",
      "event_background",
      "event_map_vertical",
    ]);

  const slotRows = requestedSlots.flatMap(([placement, mediaId], index) =>
    mediaId && allowed.has(mediaId)
      ? [
          {
            venue_id: v.venueId,
            media_id: mediaId,
            placement,
            target_key: v.eventId,
            sort_order: index,
            created_by: user.id,
          },
        ]
      : [],
  );
  if (slotRows.length) {
    await supabase.from("venue_media_placements").insert(slotRows);
  }

  if (!trustedVenue.verified) {
    await reviewPendingCatalogueItem({
      targetType: "event",
      targetId: v.eventId,
      requesterId: user.id,
    });
  }
  if (formData.get("inline") === "1") {
    revalidatePath(`/${locale}/events`, "layout");
    return {
      ok: true as const,
      status: trustedVenue.verified ? "published" : "pending",
    };
  }
  redirect(destination(locale, venueId, "section=events&updated=event"));
}

export async function publishEvent(formData: FormData) {
  const parsed = context
    .extend({
      eventId: z.string().uuid(),
    })
    .safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  if (!parsed.success)
    redirect(destination(locale, venueId, "error=publish-event"));

  const { supabase, user } = await requireBusinessAccess(locale);
  const [{ data: event, error: eventError }, { data: trustedVenue }] =
    await Promise.all([
      supabase
        .from("events")
        .select("id,status")
        .eq("id", parsed.data.eventId)
        .eq("venue_id", parsed.data.venueId)
        .maybeSingle(),
      supabase
        .from("venues")
        .select("verified")
        .eq("id", parsed.data.venueId)
        .maybeSingle(),
    ]);

  if (eventError || !event || !trustedVenue)
    redirect(destination(locale, venueId, "error=publish-event"));

  if (event.status !== "published") {
    const nextStatus = trustedVenue.verified ? "published" : "pending";
    const { error } = await supabase
      .from("events")
      .update({ status: nextStatus })
      .eq("id", parsed.data.eventId)
      .eq("venue_id", parsed.data.venueId);
    if (error) redirect(destination(locale, venueId, "error=publish-event"));

    if (!trustedVenue.verified) {
      await reviewPendingCatalogueItem({
        targetType: "event",
        targetId: parsed.data.eventId,
        requesterId: user.id,
      });
    }
  }

  redirect(destination(locale, venueId, "updated=publish-event"));
}

export async function updateOccurrenceStatus(formData: FormData) {
  const parsed = context
    .extend({
      eventId: z.string().uuid(),
      occurrenceId: z.string().uuid(),
      status: z.enum(["scheduled", "cancelled", "postponed", "sold_out"]),
    })
    .safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  if (!parsed.success)
    redirect(destination(locale, venueId, "error=occurrence-status"));
  const { supabase } = await requireBusinessAccess(locale);
  const { error } = await supabase
    .from("event_occurrences")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.occurrenceId)
    .eq("event_id", parsed.data.eventId);
  if (error) redirect(destination(locale, venueId, "error=occurrence-status"));
  redirect(destination(locale, venueId, "updated=occurrence-status"));
}

export async function updateOccurrence(formData: FormData) {
  const parsed = context
    .extend({
      eventId: z.string().uuid(),
      occurrenceId: z.string().uuid(),
      startsAt: madridLocalDateTimeSchema,
      endsAt: madridLocalDateTimeSchema,
      status: z.enum(["scheduled", "cancelled", "postponed", "sold_out"]),
      bookingUrl: safeExternalUrlSchema,
    })
    .safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  if (!parsed.success || parsed.data.endsAt <= parsed.data.startsAt)
    redirect(destination(locale, venueId, "error=occurrence"));
  const { supabase } = await requireBusinessAccess(locale);
  const { error } = await supabase
    .from("event_occurrences")
    .update({
      starts_at: parsed.data.startsAt.toISOString(),
      ends_at: parsed.data.endsAt.toISOString(),
      status: parsed.data.status,
      booking_url: parsed.data.bookingUrl || null,
    })
    .eq("id", parsed.data.occurrenceId)
    .eq("event_id", parsed.data.eventId);
  if (error) redirect(destination(locale, venueId, "error=occurrence"));
  redirect(destination(locale, venueId, "updated=occurrence"));
}

export async function addOccurrence(formData: FormData) {
  const parsed = context
    .extend({
      eventId: z.string().uuid(),
      startsAt: madridLocalDateTimeSchema,
      endsAt: madridLocalDateTimeSchema,
    })
    .safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  if (!parsed.success)
    redirect(destination(locale, venueId, "error=occurrence"));
  const { supabase } = await requireBusinessAccess(locale);
  const { error } = await supabase.rpc("add_owned_event_occurrence", {
    p_event: parsed.data.eventId,
    p_starts: parsed.data.startsAt.toISOString(),
    p_ends: parsed.data.endsAt.toISOString(),
  });
  if (error) redirect(destination(locale, venueId, "error=occurrence"));
  redirect(destination(locale, venueId, "updated=occurrence"));
}

export async function setRecurrence(formData: FormData) {
  const parsed = context
    .extend({
      eventId: z.string().uuid(),
      startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
      endsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
      frequency: z.enum(["daily", "weekly"]),
      interval: z.coerce.number().int().min(1).max(12),
      occurrences: z.coerce.number().int().min(2).max(52),
      timezone: z.string().trim().min(3).max(100).default("Europe/Madrid"),
      exceptions: z.string().max(800).default(""),
    })
    .safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  if (!parsed.success || parsed.data.endsAt <= parsed.data.startsAt)
    redirect(destination(locale, venueId, "error=recurrence"));
  const { supabase } = await requireBusinessAccess(locale);
  const value = parsed.data;
  const exceptions = value.exceptions.split(/[\s,]+/).filter(Boolean);
  if (exceptions.some((date) => !/^\d{4}-\d{2}-\d{2}$/.test(date)))
    redirect(destination(locale, venueId, "error=recurrence"));
  const ready = process.env.AKISUITE_FEATURES_READY === "true";
  const { error } = await supabase.rpc(
    ready ? "set_owned_event_recurrence_v2" : "set_owned_event_recurrence",
    ready
      ? {
          p_event: value.eventId,
          p_local_starts: String(formData.get("startsAt")),
          p_local_ends: String(formData.get("endsAt")),
          p_frequency: value.frequency,
          p_interval: value.interval,
          p_occurrences: value.occurrences,
          p_timezone: value.timezone,
          p_exceptions: exceptions,
        }
      : {
          p_event: value.eventId,
          p_starts: madridLocalDateTimeSchema
            .parse(value.startsAt)
            .toISOString(),
          p_ends: madridLocalDateTimeSchema.parse(value.endsAt).toISOString(),
          p_frequency: value.frequency,
          p_interval: value.interval,
          p_occurrences: value.occurrences,
        },
  );
  if (error) redirect(destination(locale, venueId, "error=recurrence"));
  redirect(destination(locale, venueId, "updated=recurrence"));
}

export async function duplicateEvent(formData: FormData) {
  const parsed = context
    .extend({
      eventId: z.string().uuid(),
      slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    })
    .safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  if (!parsed.success)
    redirect(destination(locale, venueId, "error=duplicate"));
  const { supabase } = await requireBusinessAccess(locale);
  const { error } = await supabase.rpc("duplicate_owned_event", {
    p_event: parsed.data.eventId,
    p_slug: parsed.data.slug,
  });
  if (error) redirect(destination(locale, venueId, "error=duplicate"));
  redirect(destination(locale, venueId, "updated=duplicate"));
}

export async function saveOffer(formData: FormData) {
  const parsed = context
    .extend({
      title: z.string().trim().min(3).max(160),
      terms: z.string().trim().min(10).max(2000),
      audience: z.enum(["public", "premium"]),
      startsAt: madridLocalDateTimeSchema,
      endsAt: madridLocalDateTimeSchema,
    })
    .safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  if (!parsed.success || parsed.data.endsAt <= parsed.data.startsAt)
    redirect(destination(locale, venueId, "error=offer"));
  const { supabase, user } = await requireBusinessAccess(locale);
  const v = parsed.data;
  let localized;
  try {
    localized = await translateLocalizedFields(
      locale,
      { title: v.title, terms: v.terms },
      user.id,
    );
  } catch {
    redirect(destination(locale, venueId, "error=translation"));
  }
  const { error } = await supabase.from("offers").insert({
    id: crypto.randomUUID(),
    venue_id: v.venueId,
    title_es: localized.title.es,
    title_en: localized.title.en,
    terms_es: localized.terms.es,
    terms_en: localized.terms.en,
    audience: v.audience,
    starts_at: v.startsAt.toISOString(),
    ends_at: v.endsAt.toISOString(),
    status: "pending",
  });
  if (error) redirect(destination(locale, venueId, "error=offer"));
  redirect(destination(locale, venueId, "updated=offer"));
}

export async function addTeamMember(formData: FormData) {
  const parsed = context
    .extend({
      email: z.string().trim().email().max(254),
      role: z.enum(["editor", "manager"]),
    })
    .safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  if (!parsed.success) redirect(destination(locale, venueId, "error=member"));
  const { supabase } = await requireBusinessAccess(locale);
  const { error } = await supabase.rpc("add_venue_member_by_email", {
    p_venue: parsed.data.venueId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });
  if (error) redirect(destination(locale, venueId, "error=member"));
  revalidatePath("/en/business", "page");
  revalidatePath("/es/business", "page");
  redirect(destination(locale, venueId, "updated=member"));
}

export async function uploadVenueImage(formData: FormData) {
  const inline = formData.get("inline") === "1";
  const parsed = context
    .extend({
      alt: z.string().trim().min(3).max(300),
      sortOrder: z.coerce.number().int().min(0).max(10000),
    })
    .safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  const file = formData.get("image");
  if (
    !parsed.success ||
    !(file instanceof File) ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size < 1 ||
    file.size > 10 * 1024 * 1024
  ) {
    if (inline) return { ok: false as const, error: "invalid-file" };
    redirect(destination(locale, venueId, "error=media"));
  }
  const { supabase, user } = await requireBusinessAccess(locale);
  let localizedAlt;
  try {
    localizedAlt = (
      await translateLocalizedFields(locale, { alt: parsed.data.alt }, user.id)
    ).alt;
  } catch {
    if (inline) return { ok: false as const, error: "translation" };
    redirect(destination(locale, venueId, "error=translation"));
  }
  let stored: StoredListingUpload;
  try {
    stored = await storeListingUpload(supabase, parsed.data.venueId, file);
  } catch (error) {
    if (inline)
      return {
        ok: false as const,
        error: error instanceof ListingUploadError ? error.code : "unavailable",
      };
    redirect(destination(locale, venueId, "error=media"));
  }
  const path = stored.path;
  const mediaId = crypto.randomUUID();
  const { error } = await supabase.from("venue_media").insert({
    id: mediaId,
    venue_id: parsed.data.venueId,
    storage_path: path,
    alt_es: localizedAlt.es,
    alt_en: localizedAlt.en,
    sort_order: parsed.data.sortOrder,
    mime_type: file.type,
    size_bytes: file.size,
    created_by: user.id,
  });
  if (error) {
    await discardListingUpload(supabase, stored);
    if (inline)
      return {
        ok: false as const,
        error: error.code === "PT402" ? "quota" : "database",
      };
    redirect(destination(locale, venueId, "error=media"));
  }
  if (inline) {
    const { data: signed } = await supabase.storage
      .from("event-media")
      .createSignedUrl(path, 3600);
    return {
      ok: true as const,
      media: {
        id: mediaId,
        url: signed?.signedUrl || "",
        alt:
          localizedAlt[locale] ||
          localizedAlt.es ||
          localizedAlt.en ||
          parsed.data.alt,
        sizeBytes: file.size,
      },
    };
  }
  redirect(destination(locale, venueId, "updated=media"));
}

export async function updateVenueImageMetadata(formData: FormData) {
  const parsed = context
    .extend({
      mediaId: z.string().uuid(),
      alt: z.string().trim().min(3).max(300),
      sortOrder: z.coerce.number().int().min(0).max(10000),
    })
    .safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  if (!parsed.success) redirect(destination(locale, venueId, "error=media"));
  const { supabase, user } = await requireBusinessAccess(locale);
  const { data: currentMedia } = await supabase
    .from("venue_media")
    .select("alt_es,alt_en")
    .eq("id", parsed.data.mediaId)
    .eq("venue_id", parsed.data.venueId)
    .maybeSingle();
  if (!currentMedia) redirect(destination(locale, venueId, "error=media"));

  let localizedAlt;
  try {
    localizedAlt = (
      await translateSubmittedLocalizedFields(
        locale,
        { alt: parsed.data.alt },
        user.id,
        {
          alt: {
            es: currentMedia.alt_es || "",
            en: currentMedia.alt_en || "",
          },
        },
      )
    ).alt;
  } catch {
    redirect(destination(locale, venueId, "error=translation"));
  }
  const { error } = await supabase
    .from("venue_media")
    .update({
      alt_es: localizedAlt.es,
      alt_en: localizedAlt.en,
      sort_order: parsed.data.sortOrder,
    })
    .eq("id", parsed.data.mediaId)
    .eq("venue_id", parsed.data.venueId);
  if (error) redirect(destination(locale, venueId, "error=media"));
  redirect(destination(locale, venueId, "updated=media-metadata"));
}

export async function removeVenueImage(formData: FormData) {
  const inline = formData.get("inline") === "1";
  const parsed = context
    .extend({ mediaId: z.string().uuid() })
    .safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  if (!parsed.success) {
    if (inline) return { ok: false as const, error: "media" };
    redirect(destination(locale, venueId, "error=media"));
  }
  const { supabase } = await requireBusinessAccess(locale);
  const { data: media } = await supabase
    .from("venue_media")
    .select("storage_path")
    .eq("id", parsed.data.mediaId)
    .eq("venue_id", parsed.data.venueId)
    .maybeSingle();
  if (!media) {
    if (inline) return { ok: false as const, error: "media" };
    redirect(destination(locale, venueId, "error=media"));
  }
  // The shared bin may feed multiple public venue/event surfaces. Never
  // remove a file that is still referenced by a placement.
  const sharedReady =
    process.env.AKISUITE_LISTING_LIBRARY_READY === "true" ||
    (process.env.AKISUITE_FEATURES_READY === "true" &&
      process.env.AKISUITE_SUBSCRIPTIONS_READY === "true");
  const usage = sharedReady
    ? await supabase.rpc("akisuite_media_in_use", {
        p_media: parsed.data.mediaId,
      })
    : null;
  const localUsage = !sharedReady
    ? await supabase
        .from("venue_media_placements")
        .select("id", { count: "exact", head: true })
        .eq("venue_id", parsed.data.venueId)
        .eq("media_id", parsed.data.mediaId)
    : null;
  const placementCount = usage ? (usage.data ? 1 : 0) : localUsage?.count;
  const placementError = usage?.error || localUsage?.error;
  if (placementError || (placementCount ?? 0) > 0) {
    if (inline) return { ok: false as const, error: "media-in-use" };
    redirect(destination(locale, venueId, "error=media-in-use"));
  }
  const { error: storageError } = await supabase.storage
    .from("event-media")
    .remove([media.storage_path]);
  if (storageError) {
    if (inline) return { ok: false as const, error: "media" };
    redirect(destination(locale, venueId, "error=media"));
  }
  const { error: rowError } = await supabase
    .from("venue_media")
    .delete()
    .eq("id", parsed.data.mediaId)
    .eq("venue_id", parsed.data.venueId);
  if (rowError) {
    if (inline) return { ok: false as const, error: "media" };
    redirect(destination(locale, venueId, "error=media"));
  }
  if (inline) return { ok: true as const, mediaId: parsed.data.mediaId };
  redirect(destination(locale, venueId, "updated=media-removed"));
}

const deletionSchema = context.extend({
  confirmation: z.literal("DELETE"),
  reason: z.string().trim().min(10).max(2000),
});

const unclaimSchema = context.extend({
  confirmation: z.literal("UNCLAIM"),
  reason: z.string().trim().min(10).max(2000),
});

export async function unclaimVenue(formData: FormData) {
  const parsed = unclaimSchema.safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  if (!parsed.success) redirect(destination(locale, venueId, "error=unclaim"));
  const { supabase } = await requireBusinessAccess(locale);
  const { error } = await supabase.rpc("unclaim_owned_venue", {
    p_venue: parsed.data.venueId,
    p_confirmation: parsed.data.confirmation,
    p_reason: parsed.data.reason,
  });
  if (error) redirect(destination(locale, venueId, "error=unclaim"));
  revalidatePath(`/${locale}/business`);
  redirect(`/${locale}/business?updated=venue-unclaimed`);
}

export async function deleteEvent(formData: FormData) {
  const parsed = deletionSchema
    .extend({ eventId: z.string().uuid() })
    .safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  if (!parsed.success)
    redirect(destination(locale, venueId, "error=event-delete"));
  const { supabase } = await requireBusinessAccess(locale);
  const { error } = await supabase.rpc("delete_owned_event", {
    p_event: parsed.data.eventId,
    p_confirmation: parsed.data.confirmation,
    p_reason: parsed.data.reason,
  });
  if (error) redirect(destination(locale, venueId, "error=event-delete"));
  redirect(destination(locale, venueId, "updated=event-deleted"));
}

export async function deleteVenue(formData: FormData) {
  const parsed = deletionSchema.safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  if (!parsed.success)
    redirect(destination(locale, venueId, "error=venue-delete"));
  const { supabase } = await requireBusinessAccess(locale);
  const { error } = await supabase.rpc("delete_owned_venue", {
    p_venue: parsed.data.venueId,
    p_confirmation: parsed.data.confirmation,
    p_reason: parsed.data.reason,
  });
  if (error) redirect(destination(locale, venueId, "error=venue-delete"));
  redirect(`/${locale}/business?updated=venue-deleted`);
}

// All stamp-card mutations are scoped to a specific managed AkiPasa venue.
// RLS is the second line of defence; do not rely on the UI or a submitted venue ID.
async function requireStampManager(locale: "en" | "es", venueId: string) {
  const { supabase, user } = await requireBusinessAccess(locale);
  const [{ data: canEdit, error: accessError }, { data: venue }] =
    await Promise.all([
      supabase.rpc("is_venue_member", {
        target_venue: venueId,
        allowed_roles: ["owner", "manager"],
      }),
      supabase
        .from("venues")
        .select("id,discovery_vertical")
        .eq("id", venueId)
        .maybeSingle(),
    ]);
  if (
    accessError ||
    !canEdit ||
    !venue ||
    venue.discovery_vertical === "accommodation"
  ) {
    redirect(
      destination(locale, venueId, "section=rewards&error=stamp-permission"),
    );
  }
  return { supabase, user };
}

// The legacy reward_* text remains in loyalty_programs for old check-in clients.
// The prize must ALSO be linked via loyalty_program_rewards to be claimable.
export async function createStampCard(formData: FormData) {
  const schema = context.extend({
    programId: z
      .union([z.string().uuid(), z.literal("")])
      .optional()
      .default(""),
    title: z.string().trim().min(3).max(160),
    reward: z
      .string()
      .trim()
      .max(500)
      .refine((value) => !value || value.length >= 3),
    stampsRequired: z.coerce.number().int().min(2).max(50),
    claimWindowDays: z.coerce.number().int().min(1).max(365),
  });
  const parsed = schema.safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  if (!parsed.success)
    redirect(destination(locale, venueId, "section=rewards&error=stamp"));
  const value = parsed.data;
  const { supabase, user } = await requireStampManager(locale, venueId);
  const editing = Boolean(value.programId);
  const { data: existing, error: readError } = editing
    ? await supabase
        .from("loyalty_programs")
        .select("id,active")
        .eq("id", value.programId)
        .eq("venue_id", venueId)
        .maybeSingle()
    : { data: null, error: null };
  if (readError || (editing && !existing))
    redirect(destination(locale, venueId, "section=rewards&error=stamp"));

  const pendingText =
    locale === "en" ? "Reward not configured" : "Premio sin configurar";
  let localized;
  try {
    localized = await translateLocalizedFields(
      locale,
      { title: value.title, reward: value.reward || pendingText },
      user.id,
    );
  } catch {
    redirect(destination(locale, venueId, "section=rewards&error=translation"));
  }
  const rewardEs = value.reward ? localized.reward.es : "Premio sin configurar";
  const rewardEn = value.reward ? localized.reward.en : "Reward not configured";
  let programId = value.programId;
  if (!editing) {
    const { data: inserted, error } = await supabase
      .from("loyalty_programs")
      .insert({
        venue_id: venueId,
        title_es: localized.title.es,
        title_en: localized.title.en,
        reward_es: rewardEs,
        reward_en: rewardEn,
        stamps_required: value.stampsRequired,
        active: false,
      })
      .select("id")
      .single();
    if (error || !inserted)
      redirect(destination(locale, venueId, "section=rewards&error=stamp"));
    programId = inserted.id;
  }

  if (value.reward) {
    // A dedicated reward avoids altering a prize that old Passport or other cards reuse.
    // Historical reward_claims still point to their original reward IDs.
    const { data: reward, error: rewardError } = await supabase
      .from("business_rewards")
      .insert({
        venue_id: venueId,
        title_es: rewardEs.slice(0, 160),
        title_en: rewardEn.slice(0, 160),
        description_es: rewardEs,
        description_en: rewardEn,
        claim_window_days: value.claimWindowDays,
        active: true,
      })
      .select("id")
      .single();
    if (rewardError || !reward)
      redirect(destination(locale, venueId, "section=rewards&error=stamp"));
    const { error: linkError } = await supabase
      .from("loyalty_program_rewards")
      .insert({ program_id: programId, reward_id: reward.id });
    if (linkError) {
      await supabase
        .from("business_rewards")
        .delete()
        .eq("id", reward.id)
        .eq("venue_id", venueId);
      redirect(destination(locale, venueId, "section=rewards&error=stamp"));
    }
    // Retire old associations only after a new prize is attached.
    const { error: unlinkError } = await supabase
      .from("loyalty_program_rewards")
      .delete()
      .eq("program_id", programId)
      .neq("reward_id", reward.id);
    if (unlinkError)
      redirect(destination(locale, venueId, "section=rewards&error=stamp"));
  } else {
    // A no-prize card is a draft and can never award stamps while unconfigured.
    const { error } = await supabase
      .from("loyalty_program_rewards")
      .delete()
      .eq("program_id", programId);
    if (error)
      redirect(destination(locale, venueId, "section=rewards&error=stamp"));
  }
  const { error: updateError } = await supabase
    .from("loyalty_programs")
    .update({
      title_es: localized.title.es,
      title_en: localized.title.en,
      reward_es: rewardEs,
      reward_en: rewardEn,
      stamps_required: value.stampsRequired,
      active: Boolean(value.reward) && (existing ? existing.active : true),
    })
    .eq("venue_id", venueId)
    .eq("id", programId);
  redirect(
    destination(
      locale,
      venueId,
      updateError
        ? "section=rewards&error=stamp"
        : "section=rewards&updated=stamp",
    ),
  );
}

export async function setStampCardActive(formData: FormData) {
  const parsed = context
    .extend({
      programId: z.string().uuid(),
      active: z.enum(["true", "false"]),
    })
    .safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  if (!parsed.success)
    redirect(destination(locale, venueId, "section=rewards&error=stamp"));
  const { supabase } = await requireStampManager(locale, venueId);
  if (parsed.data.active === "true") {
    const { data: linked, error } = await supabase
      .from("loyalty_program_rewards")
      .select("reward_id,business_rewards!inner(venue_id,active)")
      .eq("program_id", parsed.data.programId)
      .eq("business_rewards.venue_id", venueId)
      .eq("business_rewards.active", true)
      .limit(1);
    if (error || !linked?.length)
      redirect(destination(locale, venueId, "section=rewards&error=stamp"));
  }
  const { data, error } = await supabase
    .from("loyalty_programs")
    .update({ active: parsed.data.active === "true" })
    .eq("id", parsed.data.programId)
    .eq("venue_id", venueId)
    .select("id")
    .maybeSingle();
  redirect(
    destination(
      locale,
      venueId,
      error || !data
        ? "section=rewards&error=stamp"
        : "section=rewards&updated=stamp",
    ),
  );
}

export async function removeStampCard(formData: FormData) {
  const parsed = context
    .extend({
      programId: z.string().uuid(),
      confirmRemoval: z.literal("yes"),
    })
    .safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  if (!parsed.success)
    redirect(destination(locale, venueId, "section=rewards&error=stamp"));
  const { supabase } = await requireStampManager(locale, venueId);
  const { data: owned } = await supabase
    .from("loyalty_programs")
    .select("id")
    .eq("id", parsed.data.programId)
    .eq("venue_id", venueId)
    .maybeSingle();
  if (!owned)
    redirect(destination(locale, venueId, "section=rewards&error=stamp"));

  const counts = await Promise.all([
    supabase
      .from("loyalty_ledger")
      .select("id", { count: "exact", head: true })
      .eq("program_id", owned.id),
    supabase
      .from("reward_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("program_id", owned.id),
    supabase
      .from("reward_claims")
      .select("id", { count: "exact", head: true })
      .eq("program_id", owned.id),
  ]);
  // Never cascade-delete customer stamps, pending redemptions or claims.
  if (counts.some((row) => row.error || (row.count || 0) > 0)) {
    const { error } = await supabase
      .from("loyalty_programs")
      .update({ active: false })
      .eq("id", owned.id)
      .eq("venue_id", venueId);
    redirect(
      destination(
        locale,
        venueId,
        error
          ? "section=rewards&error=stamp"
          : "section=rewards&updated=stamp-paused",
      ),
    );
  }
  const { error } = await supabase
    .from("loyalty_programs")
    .delete()
    .eq("id", owned.id)
    .eq("venue_id", venueId);
  redirect(
    destination(
      locale,
      venueId,
      error
        ? "section=rewards&error=stamp"
        : "section=rewards&updated=stamp-deleted",
    ),
  );
}

export async function confirmVenueStampRedemption(formData: FormData) {
  const parsed = context
    .extend({ redemptionId: z.string().uuid() })
    .safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  if (!parsed.success)
    redirect(destination(locale, venueId, "section=rewards&error=redemption"));
  const { supabase } = await requireStampManager(locale, venueId);
  const { data: redemption } = await supabase
    .from("reward_redemptions")
    .select("id,loyalty_programs!inner(venue_id)")
    .eq("id", parsed.data.redemptionId)
    .eq("loyalty_programs.venue_id", venueId)
    .eq("state", "requested")
    .maybeSingle();
  if (!redemption)
    redirect(destination(locale, venueId, "section=rewards&error=redemption"));
  const { error } = await supabase.rpc("confirm_reward_redemption", {
    p_redemption: parsed.data.redemptionId,
  });
  redirect(
    destination(
      locale,
      venueId,
      error
        ? "section=rewards&error=redemption"
        : "section=rewards&updated=redemption",
    ),
  );
}

export async function createBusinessReward(formData: FormData) {
  const parsed = context
    .extend({
      title: z.string().trim().min(3).max(160),
      description: z.string().trim().min(3).max(1000),
      claimWindowDays: z.coerce.number().int().min(1).max(365),
    })
    .safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  if (!parsed.success) redirect(destination(locale, venueId, "error=reward"));
  const { supabase, user } = await requireBusinessAccess(locale);
  let localized;
  try {
    localized = await translateLocalizedFields(
      locale,
      { title: parsed.data.title, description: parsed.data.description },
      user.id,
    );
  } catch {
    redirect(destination(locale, venueId, "error=translation"));
  }
  const { error } = await supabase.from("business_rewards").insert({
    venue_id: parsed.data.venueId,
    title_es: localized.title.es,
    title_en: localized.title.en,
    description_es: localized.description.es,
    description_en: localized.description.en,
    claim_window_days: parsed.data.claimWindowDays,
    active: true,
  });
  redirect(
    destination(locale, venueId, error ? "error=reward" : "updated=reward"),
  );
}

export async function assignReward(formData: FormData) {
  const parsed = context
    .extend({
      rewardId: z.string().uuid(),
      targetType: z.enum(["stamp", "passport"]),
      targetId: z.string().uuid(),
      accessTier: z.enum(["free", "premium"]).default("free"),
    })
    .safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  if (!parsed.success)
    redirect(destination(locale, venueId, "error=assignment"));
  const { supabase } = await requireBusinessAccess(locale);
  const { error } =
    parsed.data.targetType === "stamp"
      ? await supabase.from("loyalty_program_rewards").upsert({
          program_id: parsed.data.targetId,
          reward_id: parsed.data.rewardId,
        })
      : await supabase.from("passport_rewards").upsert({
          passport_id: parsed.data.targetId,
          reward_id: parsed.data.rewardId,
          access_tier: parsed.data.accessTier,
        });
  redirect(
    destination(
      locale,
      venueId,
      error ? "error=assignment" : "updated=assignment",
    ),
  );
}

export async function createCheckInCredential(formData: FormData) {
  const parsed = context
    .extend({ label: z.string().trim().min(2).max(80) })
    .safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  if (!parsed.success)
    redirect(destination(locale, venueId, "error=credential"));
  const { supabase, user } = await requireBusinessAccess(locale);
  const { error } = await supabase.from("venue_checkin_credentials").insert({
    venue_id: parsed.data.venueId,
    label: parsed.data.label,
    created_by: user.id,
  });
  redirect(
    destination(
      locale,
      venueId,
      error ? "error=credential" : "updated=credential",
    ),
  );
}

export async function redeemRewardClaim(formData: FormData) {
  const parsed = context
    .extend({ claimCode: z.string().uuid() })
    .safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  if (!parsed.success)
    redirect(destination(locale, venueId, "error=redemption"));
  const { supabase } = await requireBusinessAccess(locale);
  const { error } = await supabase.rpc("redeem_reward_claim", {
    p_code: parsed.data.claimCode,
  });
  redirect(
    destination(
      locale,
      venueId,
      error ? "error=redemption" : "updated=redemption",
    ),
  );
}

function bookingDestination(
  locale: string,
  venueId: string,
  result: string,
  form?: FormData,
) {
  if (form && result.includes("booking-request")) {
    const href = bookingInboxHref(
      locale,
      venueId,
      parseBookingInbox(Object.fromEntries(form)),
    );
    return href.replace("#booking-inbox", `&${result}#booking-inbox`);
  }
  const tab = result.includes("booking-request")
    ? "inbox"
    : result.includes("booking-resource")
      ? "resources"
      : result.includes("booking-offering")
        ? "offerings"
        : result.includes("booking-slot") ||
            result.includes("booking-recurrence")
          ? "calendar"
          : "setup";
  return destination(
    locale,
    venueId,
    `section=bookings&bookingTab=${tab}&${result}`,
  );
}

function accommodationDestination(
  locale: string,
  venueId: string,
  tab: string,
  result: string,
) {
  return destination(
    locale,
    venueId,
    `section=bookings&accommodationTab=${tab}&${result}`,
  );
}

async function requireBookingManager(
  supabase: Awaited<ReturnType<typeof requireBusinessAccess>>["supabase"],
  locale: "es" | "en",
  venueId: string,
) {
  const { data, error } = await supabase.rpc("is_venue_member", {
    target_venue: venueId,
    allowed_roles: ["owner", "manager"],
  });
  if (error || !data)
    redirect(bookingDestination(locale, venueId, "error=booking-permission"));
}

async function requireAccommodationManager(
  supabase: Awaited<ReturnType<typeof requireBusinessAccess>>["supabase"],
  locale: "es" | "en",
  venueId: string,
) {
  const { data, error } = await supabase.rpc("is_venue_member", {
    target_venue: venueId,
    allowed_roles: ["owner", "manager"],
  });
  if (error || !data)
    redirect(
      accommodationDestination(locale, venueId, "rooms", "error=permission"),
    );
  const { data: venue } = await supabase
    .from("venues")
    .select("discovery_vertical")
    .eq("id", venueId)
    .maybeSingle();
  if (venue?.discovery_vertical !== "accommodation")
    redirect(
      accommodationDestination(locale, venueId, "rooms", "error=property"),
    );
}

export async function saveAccommodationSettings(formData: FormData) {
  const parsed = z
    .object({
      venueId: z.string().uuid(),
      locale: z.enum(["en", "es"]),
      mode: z.enum(["disabled", "external", "request"]),
      policy: z.string().trim().max(4000),
      externalUrl: z.string().trim().max(2000),
      notificationEmail: z.union([
        z.literal(""),
        z.string().trim().email().max(254),
      ]),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("Invalid accommodation settings");
  const p = parsed.data;
  const { supabase } = await requireBusinessAccess(p.locale);
  await requireAccommodationManager(supabase, p.locale, p.venueId);
  if (p.mode === "request" && p.policy.length < 10)
    redirect(
      accommodationDestination(p.locale, p.venueId, "settings", "error=policy"),
    );
  if (p.mode === "external" && !/^https:\/\/[^\s]+$/.test(p.externalUrl))
    redirect(
      accommodationDestination(p.locale, p.venueId, "settings", "error=url"),
    );
  const { error } = await supabase
    .from("accommodation_booking_settings")
    .upsert({
      venue_id: p.venueId,
      mode: p.mode,
      policy: p.policy,
      external_url: p.externalUrl || null,
      notification_email: p.notificationEmail || null,
    });
  redirect(
    accommodationDestination(
      p.locale,
      p.venueId,
      "settings",
      error ? "error=settings" : "success=settings",
    ),
  );
}

export async function changeAccommodationStatus(formData: FormData) {
  const parsed = z
    .object({
      venueId: z.string().uuid(),
      locale: z.enum(["en", "es"]),
      reservationId: z.string().uuid(),
      status: z.enum([
        "confirmed",
        "declined",
        "cancelled",
        "checked_in",
        "completed",
      ]),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("Invalid reservation");
  const p = parsed.data;
  const { supabase } = await requireBusinessAccess(p.locale);
  await requireAccommodationManager(supabase, p.locale, p.venueId);
  const { data: owned } = await supabase
    .from("accommodation_reservations")
    .select("id")
    .eq("id", p.reservationId)
    .eq("venue_id", p.venueId)
    .maybeSingle();
  if (!owned)
    redirect(
      accommodationDestination(
        p.locale,
        p.venueId,
        "reservations",
        "error=reservation",
      ),
    );
  const { error } = await supabase.rpc("accommodation_change_status", {
    p_reservation: p.reservationId,
    p_status: p.status,
  });
  redirect(
    accommodationDestination(
      p.locale,
      p.venueId,
      "reservations",
      error ? "error=reservation" : "success=reservation",
    ),
  );
}

export async function createAccommodationRoomType(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  const parsed = context
    .extend({
      name: z.string().trim().min(2).max(120),
      maxGuests: z.coerce.number().int().min(1).max(30),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect(accommodationDestination(locale, venueId, "rooms", "error=room"));
  const { supabase } = await requireBusinessAccess(locale);
  await requireAccommodationManager(supabase, locale, parsed.data.venueId);
  const { error } = await supabase.from("accommodation_room_types").insert({
    venue_id: parsed.data.venueId,
    name: parsed.data.name,
    max_guests: parsed.data.maxGuests,
  });
  redirect(
    accommodationDestination(
      locale,
      venueId,
      "rooms",
      error ? "error=room" : "updated=room",
    ),
  );
}

export async function updateAccommodationRoomType(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  const parsed = context
    .extend({
      roomTypeId: z.string().uuid(),
      name: z.string().trim().min(2).max(120),
      maxGuests: z.coerce.number().int().min(1).max(30),
      active: z.enum(["on"]).optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect(accommodationDestination(locale, venueId, "rooms", "error=room"));
  const { supabase } = await requireBusinessAccess(locale);
  await requireAccommodationManager(supabase, locale, parsed.data.venueId);
  const { error } = await supabase
    .from("accommodation_room_types")
    .update({
      name: parsed.data.name,
      max_guests: parsed.data.maxGuests,
      active: parsed.data.active === "on",
    })
    .eq("id", parsed.data.roomTypeId)
    .eq("venue_id", parsed.data.venueId);
  redirect(
    accommodationDestination(
      locale,
      venueId,
      "rooms",
      error ? "error=room" : "updated=room",
    ),
  );
}

export async function createAccommodationUnit(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  const parsed = context
    .extend({
      roomTypeId: z.string().uuid(),
      name: z.string().trim().min(1).max(120),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect(accommodationDestination(locale, venueId, "rooms", "error=unit"));
  const { supabase } = await requireBusinessAccess(locale);
  await requireAccommodationManager(supabase, locale, parsed.data.venueId);
  const { error } = await supabase.from("accommodation_units").insert({
    venue_id: parsed.data.venueId,
    room_type_id: parsed.data.roomTypeId,
    name: parsed.data.name,
  });
  redirect(
    accommodationDestination(
      locale,
      venueId,
      "rooms",
      error ? "error=unit" : "updated=unit",
    ),
  );
}

export async function updateAccommodationUnit(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  const parsed = context
    .extend({
      unitId: z.string().uuid(),
      roomTypeId: z.string().uuid(),
      name: z.string().trim().min(1).max(120),
      active: z.enum(["on"]).optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect(accommodationDestination(locale, venueId, "rooms", "error=unit"));
  const { supabase } = await requireBusinessAccess(locale);
  await requireAccommodationManager(supabase, locale, parsed.data.venueId);
  const { error } = await supabase
    .from("accommodation_units")
    .update({
      room_type_id: parsed.data.roomTypeId,
      name: parsed.data.name,
      active: parsed.data.active === "on",
    })
    .eq("id", parsed.data.unitId)
    .eq("venue_id", parsed.data.venueId);
  redirect(
    accommodationDestination(
      locale,
      venueId,
      "rooms",
      error ? "error=unit" : "updated=unit",
    ),
  );
}

export async function createAccommodationRate(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  const parsed = context
    .extend({
      roomTypeId: z.string().uuid(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      nightlyPriceEuros: z.coerce.number().min(0).max(100000),
      minimumNights: z.coerce.number().int().min(1).max(365),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success || parsed.data.endDate <= parsed.data.startDate)
    redirect(accommodationDestination(locale, venueId, "rates", "error=rate"));
  const { supabase } = await requireBusinessAccess(locale);
  await requireAccommodationManager(supabase, locale, parsed.data.venueId);
  const { error } = await supabase.from("accommodation_nightly_rates").insert({
    venue_id: parsed.data.venueId,
    room_type_id: parsed.data.roomTypeId,
    start_date: parsed.data.startDate,
    end_date_exclusive: parsed.data.endDate,
    nightly_price_cents: Math.round(parsed.data.nightlyPriceEuros * 100),
    minimum_nights: parsed.data.minimumNights,
  });
  redirect(
    accommodationDestination(
      locale,
      venueId,
      "rates",
      error ? "error=rate" : "updated=rate",
    ),
  );
}

export async function deleteAccommodationRate(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  const parsed = context
    .extend({ rateId: z.string().uuid() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect(accommodationDestination(locale, venueId, "rates", "error=rate"));
  const { supabase } = await requireBusinessAccess(locale);
  await requireAccommodationManager(supabase, locale, parsed.data.venueId);
  const { error } = await supabase
    .from("accommodation_nightly_rates")
    .delete()
    .eq("id", parsed.data.rateId)
    .eq("venue_id", parsed.data.venueId);
  redirect(
    accommodationDestination(
      locale,
      venueId,
      "rates",
      error ? "error=rate" : "updated=rate",
    ),
  );
}

export async function createAccommodationBlock(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  const parsed = context
    .extend({
      unitId: z.string().uuid(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      reason: z.string().trim().min(2).max(120).default("maintenance"),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success || parsed.data.endDate <= parsed.data.startDate)
    redirect(
      accommodationDestination(locale, venueId, "calendar", "error=block"),
    );
  const { supabase } = await requireBusinessAccess(locale);
  await requireAccommodationManager(supabase, locale, parsed.data.venueId);
  const { error } = await supabase.from("accommodation_unit_blocks").insert({
    venue_id: parsed.data.venueId,
    unit_id: parsed.data.unitId,
    start_date: parsed.data.startDate,
    end_date_exclusive: parsed.data.endDate,
    reason: parsed.data.reason,
  });
  redirect(
    accommodationDestination(
      locale,
      venueId,
      "calendar",
      error ? "error=block" : "updated=block",
    ),
  );
}

export async function deleteAccommodationBlock(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  const parsed = context
    .extend({ blockId: z.string().uuid() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect(
      accommodationDestination(locale, venueId, "calendar", "error=block"),
    );
  const { supabase } = await requireBusinessAccess(locale);
  await requireAccommodationManager(supabase, locale, parsed.data.venueId);
  const { error } = await supabase
    .from("accommodation_unit_blocks")
    .delete()
    .eq("id", parsed.data.blockId)
    .eq("venue_id", parsed.data.venueId);
  redirect(
    accommodationDestination(
      locale,
      venueId,
      "calendar",
      error ? "error=block" : "updated=block",
    ),
  );
}

export async function retryBookingEmails(formData: FormData) {
  const parsed = context
    .extend({ requestId: z.string().uuid() })
    .safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  if (!parsed.success)
    redirect(
      bookingDestination(locale, venueId, "error=booking-request", formData),
    );
  const { supabase } = await requireBusinessAccess(locale);
  await requireBookingManager(supabase, locale, venueId);
  const { error } = await supabase.rpc("retry_booking_confirmation", {
    p_venue: venueId,
    p_booking: parsed.data.requestId,
  });
  if (!error)
    await dispatchBookingConfirmations(
      undefined,
      venueId,
      parsed.data.requestId,
    ).catch(() => undefined);
  redirect(
    bookingDestination(
      locale,
      venueId,
      error ? "error=booking-request" : "updated=booking-request",
      formData,
    ),
  );
}

export async function saveBookingSettings(formData: FormData) {
  const parsed = context
    .extend({
      mode: z.enum(["external", "request", "disabled"]),
      externalUrl: z.string().trim().max(2048).default(""),
      requiresDeposit: z.string().optional(),
      depositEuros: z
        .union([z.literal(""), z.coerce.number().min(0).max(10000)])
        .default(""),
      instructions: z.string().trim().max(1000).default(""),
      notificationEmail: z
        .union([z.literal(""), z.string().email().max(254)])
        .default(""),
      template: z
        .enum([
          "dining",
          "experience",
          "resource",
          "appointment",
          "ticket",
          "class",
          "stay",
        ])
        .default("experience"),
    })
    .safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  if (!parsed.success)
    redirect(bookingDestination(locale, venueId, "error=booking"));
  const v = parsed.data;
  if (
    v.mode === "request" &&
    v.requiresDeposit === "on" &&
    (!v.depositEuros || Number(v.depositEuros) <= 0)
  )
    redirect(bookingDestination(locale, venueId, "error=booking-deposit"));
  // External providers must use an absolute HTTP(S) URL; never allow javascript: links.
  let externalUrl: string | null = null;
  if (v.mode === "external") {
    try {
      const url = new URL(v.externalUrl);
      if (
        !["https:", "http:"].includes(url.protocol) ||
        !url.hostname ||
        url.username ||
        url.password
      )
        throw new Error("Invalid booking URL");
      externalUrl = url.toString();
    } catch {
      redirect(bookingDestination(locale, venueId, "error=booking-url"));
    }
  }
  const { supabase, user } = await requireBusinessAccess(locale);
  await requireBookingManager(supabase, locale, venueId);
  let localizedInstructions = { es: "", en: "" };
  if (v.mode === "request" && v.instructions) {
    try {
      localizedInstructions = (
        await translateLocalizedFields(
          locale,
          { instructions: v.instructions },
          user.id,
        )
      ).instructions;
    } catch {
      redirect(bookingDestination(locale, venueId, "error=translation"));
    }
  }
  const { error } = await supabase.from("venue_booking_settings").upsert({
    venue_id: v.venueId,
    mode: v.mode,
    external_url: externalUrl,
    booking_template: v.mode === "request" ? v.template : null,

    requires_deposit: v.mode === "request" && v.requiresDeposit === "on",
    deposit_cents:
      v.mode === "request" && v.depositEuros !== ""
        ? Math.round(v.depositEuros * 100)
        : null,
    instructions_es:
      v.mode === "request" ? localizedInstructions.es || null : null,
    instructions_en:
      v.mode === "request" ? localizedInstructions.en || null : null,
    active: v.mode !== "disabled",
  });
  if (!error && v.mode === "request") {
    const { error: mailError } = await supabase
      .from("booking_notification_settings")
      .upsert({
        venue_id: v.venueId,
        notification_email: v.notificationEmail || null,
        locale,
      });
    if (mailError)
      redirect(bookingDestination(locale, venueId, "error=booking-email"));
  }
  redirect(
    bookingDestination(
      locale,
      venueId,
      error ? "error=booking" : "updated=booking",
    ),
  );
}

export async function createBookingOffering(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  const parsed = context
    .extend({
      name: z.string().trim().min(2).max(120),
      kind: z.enum([
        "dining",
        "experience",
        "resource",
        "appointment",
        "ticket",
        "class",
        "stay",
      ]),
      duration: z.coerce.number().int().min(15).max(1440),
      capacity: z.coerce.number().int().min(1).max(10000),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect(bookingDestination(locale, venueId, "error=booking-offering"));
  const { supabase } = await requireBusinessAccess(locale);
  await requireBookingManager(supabase, locale, venueId);
  const { error } = await supabase.from("booking_offerings").insert({
    venue_id: parsed.data.venueId,
    name: parsed.data.name,
    kind: parsed.data.kind,
    duration_minutes: parsed.data.duration,
    capacity: parsed.data.capacity,
  });
  redirect(
    bookingDestination(
      locale,
      venueId,
      error ? "error=booking-offering" : "updated=booking-offering",
    ),
  );
}

export async function updateBookingOffering(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  const parsed = context
    .extend({
      offeringId: z.string().uuid(),
      name: z.string().trim().min(2).max(120),
      kind: z.enum([
        "dining",
        "experience",
        "resource",
        "appointment",
        "ticket",
        "class",
        "stay",
      ]),
      duration: z.coerce.number().int().min(15).max(1440),
      capacity: z.coerce.number().int().min(1).max(10000),
      active: z.enum(["on"]).optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect(bookingDestination(locale, venueId, "error=booking-offering"));
  const { supabase } = await requireBusinessAccess(locale);
  await requireBookingManager(supabase, locale, venueId);
  const { error } = await supabase
    .from("booking_offerings")
    .update({
      name: parsed.data.name,
      kind: parsed.data.kind,
      duration_minutes: parsed.data.duration,
      capacity: parsed.data.capacity,
      active: parsed.data.active === "on",
    })
    .eq("id", parsed.data.offeringId)
    .eq("venue_id", parsed.data.venueId);
  redirect(
    bookingDestination(
      locale,
      venueId,
      error ? "error=booking-offering" : "updated=booking-offering",
    ),
  );
}

export async function createBookingResource(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  const parsed = context
    .extend({
      name: z.string().trim().min(2).max(100),
      kind: z.enum([
        "table",
        "staff",
        "vehicle",
        "equipment",
        "court",
        "room",
        "other",
      ]),
      capacity: z.coerce.number().int().min(1).max(10000),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect(bookingDestination(locale, venueId, "error=booking-resource"));
  const { supabase } = await requireBusinessAccess(locale);
  await requireBookingManager(supabase, locale, venueId);
  const { error } = await supabase.from("booking_resources").insert({
    venue_id: parsed.data.venueId,
    name: parsed.data.name,
    kind: parsed.data.kind,
    capacity: parsed.data.capacity,
  });
  redirect(
    bookingDestination(
      locale,
      venueId,
      error ? "error=booking-resource" : "updated=booking-resource",
    ),
  );
}

export async function createBookingSlot(formData: FormData) {
  const parsed = context
    .extend({
      startsAt: madridLocalDateTimeSchema,
      endsAt: madridLocalDateTimeSchema,
      capacity: z.coerce.number().int().min(1).max(10000),
      resourceId: z.union([z.string().uuid(), z.literal("")]).default(""),
      offeringId: z.union([z.string().uuid(), z.literal("")]).default(""),
    })
    .safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  if (!parsed.success || parsed.data.endsAt <= parsed.data.startsAt)
    redirect(bookingDestination(locale, venueId, "error=booking-slot"));
  const { supabase } = await requireBusinessAccess(locale);
  await requireBookingManager(supabase, locale, venueId);
  const { error } = await supabase.from("venue_availability_slots").insert({
    venue_id: parsed.data.venueId,
    starts_at: parsed.data.startsAt.toISOString(),
    ends_at: parsed.data.endsAt.toISOString(),
    capacity: parsed.data.capacity,
    resource_id: parsed.data.resourceId || null,
    offering_id: parsed.data.offeringId || null,
  });
  redirect(
    bookingDestination(
      locale,
      venueId,
      error ? "error=booking-slot" : "updated=booking-slot",
    ),
  );
}

export async function createRecurringBookingSlots(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  const parsed = context
    .extend({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      duration: z.coerce.number().int().min(15).max(1440),
      capacity: z.coerce.number().int().min(1).max(10000),
      resourceId: z.union([z.string().uuid(), z.literal("")]).default(""),
      offeringId: z.union([z.string().uuid(), z.literal("")]).default(""),
    })
    .safeParse(Object.fromEntries(formData));
  const weekdays = formData.getAll("weekdays").map(Number);
  if (
    !parsed.success ||
    !weekdays.length ||
    weekdays.some((day) => !Number.isInteger(day) || day < 1 || day > 7)
  ) {
    redirect(bookingDestination(locale, venueId, "error=booking-recurrence"));
  }
  const { supabase } = await requireBusinessAccess(locale);
  await requireBookingManager(supabase, locale, venueId);
  const { error } = await supabase.rpc("create_recurring_booking_slots", {
    p_venue: parsed.data.venueId,
    p_start_date: parsed.data.startDate,
    p_end_date: parsed.data.endDate,
    p_weekdays: weekdays,
    p_start_time: parsed.data.startTime,
    p_duration_minutes: parsed.data.duration,
    p_capacity: parsed.data.capacity,
    p_resource: parsed.data.resourceId || null,
    p_offering: parsed.data.offeringId || null,
  });
  redirect(
    bookingDestination(
      locale,
      venueId,
      error ? "error=booking-recurrence" : "updated=booking-recurrence",
    ),
  );
}

export async function updateBookingRequest(formData: FormData) {
  const parsed = context
    .extend({
      requestId: z.string().uuid(),
      status: z.enum(["confirmed", "declined", "completed", "cancelled"]),
    })
    .safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  if (!parsed.success)
    redirect(
      bookingDestination(locale, venueId, "error=booking-request", formData),
    );
  const { supabase } = await requireBusinessAccess(locale);
  await requireBookingManager(supabase, locale, venueId);
  if (parsed.data.status === "confirmed") {
    const { error } = await supabase.rpc("approve_booking_and_queue_emails", {
      p_venue: parsed.data.venueId,
      p_booking: parsed.data.requestId,
    });
    if (error)
      redirect(
        bookingDestination(locale, venueId, "error=booking-request", formData),
      );
    await dispatchBookingConfirmations(
      undefined,
      parsed.data.venueId,
      parsed.data.requestId,
    ).catch(() => undefined);
    redirect(
      bookingDestination(locale, venueId, "updated=booking-request", formData),
    );
  }
  const { error } = await supabase
    .from("booking_requests")
    .update({
      status: parsed.data.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.requestId)
    .eq("venue_id", parsed.data.venueId);
  redirect(
    bookingDestination(
      locale,
      venueId,
      error ? "error=booking-request" : "updated=booking-request",
      formData,
    ),
  );
}

const catalogueSaveSchema = context.extend({
  expectedRevision: z.coerce.number().int().min(0),
  document: z.string().min(2).max(400000),
  publish: z.enum(["0", "1"]).default("0"),
});

export async function saveVenueCatalogue(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  const parsed = catalogueSaveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect(destination(locale, venueId, "section=catalogue&error=catalogue"));

  let document: unknown;
  try {
    document = JSON.parse(parsed.data.document);
  } catch {
    redirect(destination(locale, venueId, "section=catalogue&error=catalogue"));
  }

  const { supabase, user } = await requireBusinessAccess(locale);

  try {
    document = await translateVenueCatalogueDocument(
      locale,
      document as VenueCatalogueDocument,
      user.id,
    );
  } catch {
    redirect(
      destination(locale, venueId, "section=catalogue&error=translation"),
    );
  }

  const { error } = await supabase.rpc("save_venue_catalogue", {
    p_venue: parsed.data.venueId,
    p_expected_revision: parsed.data.expectedRevision,
    p_document: document,
    p_publish: parsed.data.publish === "1",
  });
  if (error) {
    // Distinguish bad catalogue data from membership failures; the generic
    // "check permissions" notice hid valid users' failed saves.
    const message = error.message || "";
    const code = message.includes("ALLERGEN_REVIEW_REQUIRED")
      ? "allergens"
      : message.includes("Invalid item") ||
          message.includes("Invalid section") ||
          message.includes("Invalid price") ||
          message.includes("Invalid allergen")
        ? "catalogue-item"
        : error.code === "PT409"
          ? "catalogue-conflict"
          : error.code === "42501"
            ? "catalogue-permission"
            : "catalogue";
    redirect(destination(locale, venueId, `section=catalogue&error=${code}`));
  }
  revalidatePath(`/${locale}/venues`, "layout");
  redirect(
    destination(
      locale,
      venueId,
      `section=catalogue&updated=${parsed.data.publish === "1" ? "catalogue-published" : "catalogue"}`,
    ),
  );
}

export async function unpublishVenueCatalogue(formData: FormData) {
  const parsed = context
    .extend({ expectedRevision: z.coerce.number().int().min(0) })
    .safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  if (!parsed.success)
    redirect(destination(locale, venueId, "section=catalogue&error=catalogue"));
  const { supabase } = await requireBusinessAccess(locale);
  const { error } = await supabase.rpc("unpublish_venue_catalogue", {
    p_venue: parsed.data.venueId,
    p_expected_revision: parsed.data.expectedRevision,
  });
  if (error)
    redirect(destination(locale, venueId, "section=catalogue&error=catalogue"));
  revalidatePath(`/${locale}/venues`, "layout");
  redirect(destination(locale, venueId, "section=catalogue&updated=catalogue"));
}

const stayHeaderSchema = context.extend({ mediaId: z.string().uuid() });

export async function addStayHeaderPhoto(formData: FormData) {
  const parsed = stayHeaderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: "media" };
  const { supabase, user } = await requireBusinessAccess(parsed.data.locale);
  const { data: venue } = await supabase
    .from("venues")
    .select("id")
    .eq("id", parsed.data.venueId)
    .eq("discovery_vertical", "accommodation")
    .maybeSingle();
  const media = await authorizedSuiteMedia(
    supabase,
    parsed.data.venueId,
    parsed.data.mediaId,
  );
  if (!venue || !media) return { ok: false as const, error: "media" };
  const { data: existing, error: readError } = await supabase
    .from("venue_media_placements")
    .select("media_id,sort_order")
    .eq("venue_id", parsed.data.venueId)
    .eq("placement", "venue_gallery")
    .eq("target_key", "stay_header");
  if (readError) return { ok: false as const, error: "media" };
  if (existing?.some((item) => item.media_id === parsed.data.mediaId))
    return { ok: true as const, mediaId: parsed.data.mediaId };
  if ((existing?.length || 0) >= 12)
    return { ok: false as const, error: "limit" };
  const used = new Set((existing || []).map((item) => item.sort_order));
  const sortOrder = Array.from({ length: 12 }, (_, index) => index).find(
    (index) => !used.has(index),
  );
  if (sortOrder === undefined) return { ok: false as const, error: "limit" };
  const { error } = await supabase.from("venue_media_placements").insert({
    venue_id: parsed.data.venueId,
    media_id: parsed.data.mediaId,
    placement: "venue_gallery",
    target_key: "stay_header",
    sort_order: sortOrder,
    created_by: user.id,
  });
  if (error) return { ok: false as const, error: "media" };
  revalidatePath("/akiduermo/stays", "layout");
  return { ok: true as const, mediaId: parsed.data.mediaId };
}

export async function removeStayHeaderPhoto(formData: FormData) {
  const parsed = stayHeaderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: "media" };
  const { supabase } = await requireBusinessAccess(parsed.data.locale);
  const { data: venue } = await supabase
    .from("venues")
    .select("id")
    .eq("id", parsed.data.venueId)
    .eq("discovery_vertical", "accommodation")
    .maybeSingle();
  if (!venue) return { ok: false as const, error: "media" };
  const { error } = await supabase
    .from("venue_media_placements")
    .delete()
    .eq("venue_id", parsed.data.venueId)
    .eq("media_id", parsed.data.mediaId)
    .eq("placement", "venue_gallery")
    .eq("target_key", "stay_header");
  if (error) return { ok: false as const, error: "media" };
  revalidatePath("/akiduermo/stays", "layout");
  return { ok: true as const, mediaId: parsed.data.mediaId };
}

const venueMediaPlacementSchema = context.extend({
  mediaId: z.string().uuid(),
  placement: z.enum([
    "venue_profile",
    "venue_cover",
    "venue_menu",
    "venue_events",
    "venue_explore",
  ]),
});

export async function setVenueMediaPlacement(formData: FormData) {
  const inline = formData.get("inline") === "1";
  const parsed = venueMediaPlacementSchema.safeParse(
    Object.fromEntries(formData),
  );
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  if (!parsed.success) {
    if (inline) return { ok: false as const, error: "media" };
    redirect(destination(locale, venueId, "error=media"));
  }

  const { supabase, user } = await requireBusinessAccess(locale);
  const media = await authorizedSuiteMedia(
    supabase,
    parsed.data.venueId,
    parsed.data.mediaId,
  );
  if (!media) {
    if (inline) return { ok: false as const, error: "media" };
    redirect(destination(locale, venueId, "error=media"));
  }

  await supabase
    .from("venue_media_placements")
    .delete()
    .eq("venue_id", parsed.data.venueId)
    .eq("placement", parsed.data.placement)
    .eq("target_key", "");

  const { error } = await supabase.from("venue_media_placements").insert({
    venue_id: parsed.data.venueId,
    media_id: parsed.data.mediaId,
    placement: parsed.data.placement,
    target_key: "",
    sort_order: 0,
    created_by: user.id,
  });

  if (error) {
    if (inline) return { ok: false as const, error: "media" };
    redirect(destination(locale, venueId, "error=media"));
  }
  revalidatePath(`/${locale}/venues`, "layout");
  if (inline) {
    return {
      ok: true as const,
      placement: parsed.data.placement,
      mediaId: parsed.data.mediaId,
    };
  }
  redirect(
    destination(locale, venueId, "section=profile&updated=media-placement"),
  );
}

const clearVenueMediaPlacementSchema = context.extend({
  placement: z.enum([
    "venue_profile",
    "venue_cover",
    "venue_menu",
    "venue_events",
    "venue_explore",
  ]),
});

export async function clearVenueMediaPlacement(formData: FormData) {
  const inline = formData.get("inline") === "1";
  const parsed = clearVenueMediaPlacementSchema.safeParse(
    Object.fromEntries(formData),
  );
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  if (!parsed.success) {
    if (inline) return { ok: false as const, error: "media" };
    redirect(destination(locale, venueId, "error=media"));
  }

  const { supabase } = await requireBusinessAccess(locale);
  const { error } = await supabase
    .from("venue_media_placements")
    .delete()
    .eq("venue_id", parsed.data.venueId)
    .eq("placement", parsed.data.placement)
    .eq("target_key", "");

  if (error) {
    if (inline) return { ok: false as const, error: "media" };
    redirect(destination(locale, venueId, "error=media"));
  }
  revalidatePath(`/${locale}/venues`, "layout");
  if (inline) {
    return { ok: true as const, placement: parsed.data.placement };
  }
  redirect(
    destination(locale, venueId, "section=profile&updated=media-placement"),
  );
}

const eventMediaContext = context.extend({
  eventId: z.string().uuid(),
});

export async function addVenueMediaToEventBin(formData: FormData) {
  const inline = formData.get("inline") === "1";
  const parsed = eventMediaContext
    .extend({ mediaId: z.string().uuid() })
    .safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  if (!parsed.success) {
    if (inline) return { ok: false as const, error: "media" };
    redirect(destination(locale, venueId, "error=media"));
  }

  const { supabase, user } = await requireBusinessAccess(locale);
  const [{ data: event }, { data: media }] = await Promise.all([
    supabase
      .from("events")
      .select("id")
      .eq("id", parsed.data.eventId)
      .eq("venue_id", parsed.data.venueId)
      .maybeSingle(),
    authorizedSuiteMedia(
      supabase,
      parsed.data.venueId,
      parsed.data.mediaId,
    ).then((data) => ({ data })),
  ]);
  if (!event || !media) {
    if (inline) return { ok: false as const, error: "media" };
    redirect(destination(locale, venueId, "error=media"));
  }

  const { data: existing } = await supabase
    .from("venue_media_placements")
    .select("id")
    .eq("venue_id", parsed.data.venueId)
    .eq("target_key", parsed.data.eventId)
    .eq("placement", "event_bin")
    .eq("media_id", parsed.data.mediaId)
    .maybeSingle();
  if (!existing) {
    const { count } = await supabase
      .from("venue_media_placements")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", parsed.data.venueId)
      .eq("target_key", parsed.data.eventId)
      .eq("placement", "event_bin");
    const { error } = await supabase.from("venue_media_placements").insert({
      venue_id: parsed.data.venueId,
      media_id: parsed.data.mediaId,
      placement: "event_bin",
      target_key: parsed.data.eventId,
      sort_order: count || 0,
      created_by: user.id,
    });
    if (error) {
      if (inline) return { ok: false as const, error: "media" };
      redirect(destination(locale, venueId, "error=media"));
    }
  }
  if (inline) return { ok: true as const, mediaId: parsed.data.mediaId };
  redirect(destination(locale, venueId, "section=events&updated=event-media"));
}

export async function removeMediaFromEventBin(formData: FormData) {
  const inline = formData.get("inline") === "1";
  const parsed = eventMediaContext
    .extend({ mediaId: z.string().uuid() })
    .safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  if (!parsed.success) redirect(destination(locale, venueId, "error=media"));

  const { supabase } = await requireBusinessAccess(locale);
  const { error } = await supabase
    .from("venue_media_placements")
    .delete()
    .eq("venue_id", parsed.data.venueId)
    .eq("target_key", parsed.data.eventId)
    .eq("media_id", parsed.data.mediaId)
    .in("placement", [
      "event_bin",
      "event_banner",
      "event_explore",
      "event_profile",
      "event_background",
      "event_map_vertical",
    ]);
  if (error) {
    if (inline) return { ok: false as const, error: "media" };
    redirect(destination(locale, venueId, "error=media"));
  }
  if (inline) return { ok: true as const, mediaId: parsed.data.mediaId };
  redirect(destination(locale, venueId, "section=events&updated=event-media"));
}

export async function uploadEventImage(formData: FormData) {
  const inline = formData.get("inline") === "1";
  const parsed = eventMediaContext
    .extend({
      alt: z.string().trim().min(3).max(300),
      sortOrder: z.coerce.number().int().min(0).max(10000).default(0),
    })
    .safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const venueId = String(formData.get("venueId") || "");
  const file = formData.get("image");
  if (
    !parsed.success ||
    !(file instanceof File) ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size < 1 ||
    file.size > 10 * 1024 * 1024
  ) {
    if (inline) return { ok: false as const, error: "media" };
    redirect(destination(locale, venueId, "error=media"));
  }

  const { supabase, user } = await requireBusinessAccess(locale);
  const { data: event } = await supabase
    .from("events")
    .select("id")
    .eq("id", parsed.data.eventId)
    .eq("venue_id", parsed.data.venueId)
    .maybeSingle();
  if (!event) {
    if (inline) return { ok: false as const, error: "media" };
    redirect(destination(locale, venueId, "error=media"));
  }

  const localizedAlt = (
    await translateLocalizedFields(locale, { alt: parsed.data.alt }, user.id)
  ).alt;
  let stored: StoredListingUpload;
  try {
    stored = await storeListingUpload(
      supabase,
      parsed.data.venueId,
      file,
      parsed.data.eventId,
    );
  } catch (error) {
    if (inline)
      return {
        ok: false as const,
        error: error instanceof ListingUploadError ? error.code : "unavailable",
      };
    redirect(destination(locale, venueId, "error=media"));
  }
  const storagePath = stored.path;
  const mediaId = crypto.randomUUID();
  const { error: mediaError } = await supabase.from("venue_media").insert({
    id: mediaId,
    venue_id: parsed.data.venueId,
    storage_path: storagePath,
    alt_es: localizedAlt.es,
    alt_en: localizedAlt.en,
    sort_order: parsed.data.sortOrder,
    mime_type: file.type,
    size_bytes: file.size,
    created_by: user.id,
  });
  if (mediaError) {
    await discardListingUpload(supabase, stored);
    if (inline) return { ok: false as const, error: "media" };
    redirect(destination(locale, venueId, "error=media"));
  }

  const { error: binError } = await supabase
    .from("venue_media_placements")
    .insert({
      venue_id: parsed.data.venueId,
      media_id: mediaId,
      placement: "event_bin",
      target_key: parsed.data.eventId,
      sort_order: parsed.data.sortOrder,
      created_by: user.id,
    });
  if (binError) {
    if (inline) return { ok: false as const, error: "media" };
    redirect(destination(locale, venueId, "error=media"));
  }

  if (inline) {
    const { data: signed } = await supabase.storage
      .from("event-media")
      .createSignedUrl(storagePath, 3600);
    return {
      ok: true as const,
      media: {
        id: mediaId,
        url: signed?.signedUrl || "",
        alt:
          localizedAlt[locale] ||
          localizedAlt.es ||
          localizedAlt.en ||
          parsed.data.alt,
      },
    };
  }
  redirect(destination(locale, venueId, "section=events&updated=event-media"));
}

export async function removeVenueRentalBlock(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const parsed = z
    .object({
      locale: z.enum(["en", "es"]),
      venueId: z.string().uuid(),
      companyId: z.string().uuid(),
      vehicleId: z.string().uuid(),
      blockId: z.string().uuid(),
    })
    .safeParse(Object.fromEntries(formData));
  const venueId = String(formData.get("venueId") || "");
  if (!parsed.success)
    redirect(fleetDestination(locale, venueId, "error=availability"));
  const { supabase } = await requireFleetManager(locale, parsed.data.venueId);
  const { data: company } = await supabase
    .from("car_rental_companies")
    .select("id")
    .eq("id", parsed.data.companyId)
    .eq("venue_id", parsed.data.venueId)
    .maybeSingle();
  if (!company)
    redirect(fleetDestination(locale, venueId, "error=availability"));
  const { data: vehicle } = await supabase
    .from("car_rental_vehicles")
    .select("id")
    .eq("id", parsed.data.vehicleId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!vehicle)
    redirect(fleetDestination(locale, venueId, "error=availability"));
  const { data: removed, error } = await supabase
    .from("car_rental_calendar_blocks")
    .delete()
    .eq("id", parsed.data.blockId)
    .eq("vehicle_id", vehicle.id)
    .eq("reason", "maintenance")
    .select("id")
    .maybeSingle();
  if (error || !removed)
    redirect(fleetDestination(locale, venueId, "error=availability"));
  revalidatePath(`/${locale}/business/venue/${venueId}`);
  redirect(fleetDestination(locale, venueId, "updated=fleet"));
}
