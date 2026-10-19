"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { config, isLocale } from "@/lib/config";
import { requireUser } from "@/lib/auth";
import { requireBusinessAccess } from "@/lib/entitlements";
import { safeExternalUrlSchema } from "@/lib/auth-security";
import { dispatchClaimSubmissionAlerts } from "@/lib/claim-alert-delivery";
import { madridLocalDateTimeSchema } from "@/lib/time";
import { createEventSlug, createVenueSlug } from "@/lib/business";
import { reviewPendingCatalogueItem } from "@/lib/automatic-moderation";
import { businessCategories } from "@/lib/business-packages";
import { translateLocalizedFields } from "@/lib/localized-copy";

const businessApplicationSchema = z.object({
  locale: z.enum(["es", "en"]),
  businessName: z.string().trim().min(2).max(160),
  contactName: z.string().trim().min(2).max(120),
  locality: z.string().trim().min(2).max(120),
  websiteUrl: safeExternalUrlSchema,
  message: z.string().trim().min(20).max(2000),
  businessCategory: z.enum(
    businessCategories.map((item) => item.key) as [string, ...string[]],
  ),
  plan: z.enum(["business", "business_pro"]),
});

export async function submitBusinessApplication(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const parsed = businessApplicationSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success) redirect(`/${locale}/business/apply?error=validation`);
  const { supabase } = await requireUser(locale);
  const { error } = await supabase.rpc("submit_business_application", {
    p_business_name: parsed.data.businessName,
    p_contact_name: parsed.data.contactName,
    p_locality: parsed.data.locality,
    p_website_url: parsed.data.websiteUrl,
    p_message: parsed.data.message,
    p_business_category: parsed.data.businessCategory,
    p_plan_code: parsed.data.plan,
  });
  if (error) redirect(`/${locale}/business/apply?error=application`);
  redirect(`/${locale}/business/apply?submitted=1`);
}

const crmWorkspaceSchema = z.object({
  locale: z.enum(["es", "en"]),
  venueId: z.string().uuid(),
});

export async function openCrmWorkspace(formData: FormData) {
  const parsed = crmWorkspaceSchema.safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  if (!parsed.success) redirect(`/${locale}/business?error=crm_workspace`);
  const { supabase } = await requireBusinessAccess(
    locale,
    `/${locale}/business`,
  );
  const { data: workspaceId, error } = await supabase.rpc(
    "crm_provision_workspace_for_venue",
    { p_venue: parsed.data.venueId },
  );
  if (error || typeof workspaceId !== "string")
    redirect(`/${locale}/business?error=crm_workspace`);
  const crmUrl = config.crmUrl;
  redirect(`${crmUrl}/?workspace=${encodeURIComponent(workspaceId)}`);
}

const venueSchema = z.object({
  locale: z.string(),
  locality: z.string().trim().min(2).max(120),
  province: z.string().trim().min(2).max(120),
  postalCode: z.string().trim().max(20),
  addressSelection: z.literal("selected"),
  addressProviderId: z.string().trim().min(1).max(160),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(20).max(2000),
  address: z.string().trim().min(5).max(300),
  latitude: z.coerce.number().min(27).max(44.5),
  longitude: z.coerce.number().min(-19).max(5),
});

export async function createVenue(formData: FormData) {
  const parsed = venueSchema.safeParse(Object.fromEntries(formData));
  const locale = isLocale(String(formData.get("locale")))
    ? (String(formData.get("locale")) as "es" | "en")
    : "es";
  if (!parsed.success) redirect(`/${locale}/business?error=venue`);
  const { supabase, user } = await requireBusinessAccess(locale);
  const v = parsed.data;
  let localizedDescription;
  try {
    localizedDescription = (
      await translateLocalizedFields(
        locale,
        { description: v.description },
        user.id,
      )
    ).description;
  } catch {
    redirect(`/${locale}/business?error=translation`);
  }
  const { data: venueId, error } = await supabase.rpc(
    "create_owned_venue_in_spain",
    {
      locality_name: v.locality,
      province_name: v.province,
      venue_name: v.name,
      venue_slug: createVenueSlug(v.name),
      description_es: localizedDescription.es,
      description_en: localizedDescription.en,
      venue_address: v.address,
      latitude: v.latitude,
      longitude: v.longitude,
    },
  );
  if (error) redirect(`/${locale}/business?error=venue`);
  if (typeof venueId === "string") {
    await reviewPendingCatalogueItem({
      targetType: "venue",
      targetId: venueId,
      requesterId: user.id,
    });
  }
  redirect(`/${locale}/business?created=venue`);
}

const managedVenueDeletionSchema = z.object({
  locale: z.enum(["es", "en"]),
  venueId: z.string().uuid(),
  confirmation: z.literal("DELETE"),
  reason: z.string().trim().min(10).max(2000),
});

export async function deleteManagedVenue(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const parsed = managedVenueDeletionSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success)
    redirect(`/${locale}/business?view=venues&error=venue-delete`);

  const { supabase } = await requireBusinessAccess(
    locale,
    `/${locale}/business?view=venues`,
  );
  const { error } = await supabase.rpc("delete_owned_venue", {
    p_venue: parsed.data.venueId,
    p_confirmation: parsed.data.confirmation,
    p_reason: parsed.data.reason,
  });
  if (error) redirect(`/${locale}/business?view=venues&error=venue-delete`);

  redirect(`/${locale}/business?view=venues&updated=venue-deleted`);
}

const claimSchema = z.object({
  locale: z.string(),
  venueId: z.string().uuid(),
  applicantName: z.string().trim().min(2).max(120),
  businessRole: z.enum(["owner", "manager", "authorized", "employee", "other"]),
  applicantPhone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[+0-9 ()-]*$/),
  businessEmail: z.union([z.literal(""), z.string().trim().email().max(254)]),
  businessWebsite: safeExternalUrlSchema.refine((value) => value.length <= 500),
  businessPhone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[+0-9 ()-]*$/),
  evidence: z.string().trim().min(20).max(2000),
});
export async function submitVenueClaim(formData: FormData) {
  const parsed = claimSchema.safeParse(Object.fromEntries(formData));
  const locale = isLocale(String(formData.get("locale")))
    ? (String(formData.get("locale")) as "es" | "en")
    : "es";
  if (!parsed.success)
    redirect(`/${locale}/business?view=claims&error=claim-validation`);
  const { supabase, user } = await requireUser(
    locale,
    `/${locale}/business?view=claims&venueId=${parsed.data.venueId}`,
  );
  // A published listing cannot be reclaimed after an approved claim.
  // This is a server-side guard in addition to hiding the public CTA.
  const { data: alreadyClaimed, error: ownershipCheckError } =
    await supabase.rpc("public_venue_is_claimed", {
      p_venue: parsed.data.venueId,
    });
  if (ownershipCheckError || alreadyClaimed !== false) {
    redirect(`/${locale}/business?view=claims&error=already-claimed`);
  }
  const claimId = crypto.randomUUID();
  const { error } = await supabase.from("venue_claims").insert({
    id: claimId,
    venue_id: parsed.data.venueId,
    claimant_id: user.id,
    evidence: parsed.data.evidence,
    claim_locale: parsed.data.locale,
    claim_details: {
      applicant_name: parsed.data.applicantName,
      relationship: parsed.data.businessRole,
      applicant_phone: parsed.data.applicantPhone,
      business_email: parsed.data.businessEmail,
      business_website: parsed.data.businessWebsite,
      business_phone: parsed.data.businessPhone,
      submission_locale: locale,
    },
  });
  if (error) redirect(`/${locale}/business?view=claims&error=claim`);
  // The database trigger already committed a durable staff-alert outbox row.
  // Best-effort immediate dispatch; Cloudflare's scheduled worker retries if
  // the mail provider is unavailable. Never undo the submitted claim.
  try {
    await dispatchClaimSubmissionAlerts(undefined, claimId);
  } catch {
    console.error("claim_submission_alert_immediate_dispatch_failed");
  }
  redirect(`/${locale}/business?view=claims&created=claim`);
}

const eventSchema = z.object({
  locale: z.string(),
  venueId: z.string().uuid(),
  categoryId: z.string().uuid(),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(20).max(4000),
  priceEuros: z.coerce.number().min(0).max(10000),
  priceDisplayMode: z.enum(["show", "hide"]).default("show"),
  bannerMediaId: z.union([z.string().uuid(), z.literal("")]).default(""),
  exploreMediaId: z.union([z.string().uuid(), z.literal("")]).default(""),
  profileMediaId: z.union([z.string().uuid(), z.literal("")]).default(""),
  backgroundMediaId: z.union([z.string().uuid(), z.literal("")]).default(""),
  mapMediaId: z.union([z.string().uuid(), z.literal("")]).default(""),
  bookingUrl: safeExternalUrlSchema,
  startsAt: madridLocalDateTimeSchema,
  endsAt: madridLocalDateTimeSchema,
});
export async function createEvent(formData: FormData) {
  const parsed = eventSchema.safeParse(Object.fromEntries(formData));
  const locale = isLocale(String(formData.get("locale")))
    ? (String(formData.get("locale")) as "es" | "en")
    : "es";
  if (!parsed.success || parsed.data.endsAt <= parsed.data.startsAt)
    redirect(`/${locale}/business?view=events&error=event`);
  const { supabase, user } = await requireBusinessAccess(locale);
  const e = parsed.data;
  let localized;
  try {
    localized = await translateLocalizedFields(
      locale,
      { title: e.title, description: e.description },
      user.id,
    );
  } catch {
    redirect(`/${locale}/business?view=events&error=translation`);
  }
  const { data: venue } = await supabase
    .from("venues")
    .select("slug,verified")
    .eq("id", e.venueId)
    .maybeSingle();
  if (!venue || venue.slug === "akipasa-editorial") {
    redirect(`/${locale}/business?view=events&error=event`);
  }

  const eventSlug = createEventSlug(e.title);
  const { data: eventId, error } = await supabase.rpc(
    "create_event_with_occurrence",
    {
      target_venue: e.venueId,
      category: e.categoryId,
      event_slug: eventSlug,
      title_es: localized.title.es,
      title_en: localized.title.en,
      description_es: localized.description.es,
      description_en: localized.description.en,
      price_cents: Math.round(e.priceEuros * 100),
      booking_url: e.bookingUrl,
      starts_at: e.startsAt.toISOString(),
      ends_at: e.endsAt.toISOString(),
    },
  );
  if (error) redirect(`/${locale}/business?view=events&error=event`);
  if (typeof eventId === "string") {
    const requestedSlots = [
      ["event_banner", e.bannerMediaId],
      ["event_explore", e.exploreMediaId],
      ["event_profile", e.profileMediaId],
      ["event_background", e.backgroundMediaId],
      ["event_map_vertical", e.mapMediaId],
    ] as const;
    const selectedMediaIds = requestedSlots.flatMap(([, mediaId]) =>
      mediaId ? [mediaId] : [],
    );

    if (selectedMediaIds.length) {
      const { data: ownedMedia } = await supabase
        .from("venue_media")
        .select("id")
        .eq("venue_id", e.venueId)
        .in("id", selectedMediaIds);
      const allowed = new Set((ownedMedia || []).map((item) => item.id));

      const placementRows = requestedSlots.flatMap(
        ([placement, mediaId], index) =>
          mediaId && allowed.has(mediaId)
            ? [
                {
                  venue_id: e.venueId,
                  media_id: mediaId,
                  placement,
                  target_key: eventId,
                  sort_order: index,
                  created_by: user.id,
                },
              ]
            : [],
      );
      if (placementRows.length) {
        await supabase.from("venue_media_placements").insert(placementRows);
      }
    }

    await supabase
      .from("events")
      .update({
        price_display_mode: e.priceDisplayMode,
        ...(venue.verified ? { status: "published" } : {}),
      })
      .eq("id", eventId)
      .eq("venue_id", e.venueId);

    if (!venue.verified) {
      await reviewPendingCatalogueItem({
        targetType: "event",
        targetId: eventId,
        requesterId: user.id,
      });
    }
  }
  redirect(`/${locale}/business?view=events&created=event`);
}

const officialEventSchema = z.object({
  locale: z.enum(["es", "en"]),
  categoryId: z.string().uuid(),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(20).max(4000),
  priceEuros: z.coerce.number().min(0).max(10000),
  priceDisplayMode: z.enum(["show", "hide"]).default("show"),
  bookingUrl: safeExternalUrlSchema,
  startsAt: madridLocalDateTimeSchema,
  endsAt: madridLocalDateTimeSchema,
  locationLabel: z.string().trim().min(2).max(160),
  directionsAddress: z.string().trim().max(300).optional().default(""),
  latitude: z.coerce.number().min(27).max(44.5),
  longitude: z.coerce.number().min(-19).max(5),
});

export async function createOfficialEvent(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const parsed = officialEventSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || parsed.data.endsAt <= parsed.data.startsAt)
    redirect(`/${locale}/business?view=events&error=official-event`);

  const { supabase, user } = await requireBusinessAccess(locale);
  const value = parsed.data;
  let localized;
  try {
    localized = await translateLocalizedFields(
      locale,
      { title: value.title, description: value.description },
      user.id,
    );
  } catch {
    localized = {
      title: { es: value.title, en: value.title },
      description: { es: value.description, en: value.description },
    };
  }

  const { data: eventId, error } = await supabase.rpc(
    "create_akipasa_selection_event_v2",
    {
      p_category: value.categoryId,
      p_slug: createEventSlug(value.title),
      p_title_es: localized.title.es,
      p_title_en: localized.title.en,
      p_description_es: localized.description.es,
      p_description_en: localized.description.en,
      p_price_cents: Math.round(value.priceEuros * 100),
      p_booking_url: value.bookingUrl,
      p_starts_at: value.startsAt.toISOString(),
      p_ends_at: value.endsAt.toISOString(),
      p_location_label: value.locationLabel,
      p_directions_address: value.directionsAddress || null,
      p_latitude: value.latitude,
      p_longitude: value.longitude,
    },
  );
  if (error) redirect(`/${locale}/business?view=events&error=official-event`);

  if (typeof eventId === "string") {
    await supabase
      .from("events")
      .update({ price_display_mode: value.priceDisplayMode })
      .eq("id", eventId);
  }

  redirect(`/${locale}/business?view=events&created=official-event`);
}

const reuseEventSchema = z.object({
  locale: z.enum(["es", "en"]),
  eventId: z.string().uuid(),
  sourceSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export async function reuseEvent(formData: FormData) {
  const parsed = reuseEventSchema.safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  if (!parsed.success)
    redirect(`/${locale}/business?view=events&error=duplicate`);
  const { supabase } = await requireBusinessAccess(locale);
  const { error } = await supabase.rpc("duplicate_owned_event", {
    p_event: parsed.data.eventId,
    p_slug: `${parsed.data.sourceSlug}-copy-${crypto.randomUUID().slice(0, 8)}`,
  });
  if (error) redirect(`/${locale}/business?view=events&error=duplicate`);
  redirect(`/${locale}/business?view=events&created=duplicate`);
}

const loyaltySchema = z.object({
  locale: z.enum(["es", "en"]),
  venueId: z.string().uuid(),
  title: z.string().trim().min(3).max(160),
  reward: z.string().trim().min(3).max(500),
  stampsRequired: z.coerce.number().int().min(2).max(50),
});

export async function saveLoyaltyProgram(formData: FormData) {
  const parsed = loyaltySchema.safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  if (!parsed.success) redirect(`/${locale}/business?error=loyalty`);
  const { supabase, user } = await requireBusinessAccess(locale);
  const value = parsed.data;
  let localized;
  try {
    localized = await translateLocalizedFields(
      locale,
      { title: value.title, reward: value.reward },
      user.id,
    );
  } catch {
    redirect(`/${locale}/business?view=loyalty&error=translation`);
  }
  const { error } = await supabase.from("loyalty_programs").insert({
    venue_id: value.venueId,
    title_es: localized.title.es,
    title_en: localized.title.en,
    reward_es: localized.reward.es,
    reward_en: localized.reward.en,
    stamps_required: value.stampsRequired,
    active: true,
  });
  if (error) redirect(`/${locale}/business?error=loyalty`);
  redirect(`/${locale}/business?created=loyalty`);
}

export async function confirmRedemption(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const id = z.string().uuid().safeParse(formData.get("redemptionId"));
  if (!id.success) redirect(`/${locale}/business?error=redemption`);
  const { supabase } = await requireBusinessAccess(locale);
  const { error } = await supabase.rpc("confirm_reward_redemption", {
    p_redemption: id.data,
  });
  if (error) redirect(`/${locale}/business?error=redemption`);
  redirect(`/${locale}/business?created=redemption`);
}

const promotionSchema = z
  .object({
    locale: z.enum(["es", "en"]),
    venueId: z.string().uuid(),
    eventId: z.union([z.string().uuid(), z.literal("")]),
    service: z.enum([
      "featured_listing",
      "social_campaign",
      "content_package",
      "other",
    ]),
    message: z.string().trim().min(20).max(2000),
  })
  .superRefine((value, context) => {
    if (value.service === "featured_listing" && !value.eventId) {
      context.addIssue({
        code: "custom",
        path: ["eventId"],
        message: "A published event is required",
      });
    }
  });

export async function requestPromotion(formData: FormData) {
  const parsed = promotionSchema.safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  if (!parsed.success) redirect(`/${locale}/business?error=promotion`);
  const { supabase, user } = await requireBusinessAccess(locale);
  if (parsed.data.eventId) {
    const { data: event } = await supabase
      .from("events")
      .select("id")
      .eq("id", parsed.data.eventId)
      .eq("venue_id", parsed.data.venueId)
      .eq("status", "published")
      .maybeSingle();
    if (!event) redirect(`/${locale}/business?error=promotion`);
  }
  const { error } = await supabase.from("promotion_requests").insert({
    venue_id: parsed.data.venueId,
    event_id: parsed.data.eventId || null,
    requester_id: user.id,
    service: parsed.data.service,
    message: parsed.data.message,
  });
  if (error) redirect(`/${locale}/business?error=promotion`);
  redirect(`/${locale}/business?created=promotion`);
}
