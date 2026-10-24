"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBusinessAccess } from "@/lib/entitlements";
import { madridLocalDateTimeSchema } from "@/lib/time";
const input = z.object({
  locale: z.enum(["en", "es"]),
  venueId: z.string().uuid(),
});
function failure(locale: string, venue: string, reason: string): never {
  redirect(`/${locale}/business/venue/${venue}?section=events&error=${reason}`);
}
async function premiumContext(locale: "en" | "es", venue: string) {
  if (process.env.AKISUITE_LISTING_LIBRARY_READY === "true") {
    const context = await requireBusinessAccess(locale);
    const { data, error } = await context.supabase.rpc("listing_limits_info", {
      p_venue: venue,
    });
    if (error || data?.library_enabled !== true || data?.premium !== true)
      failure(locale, venue, "premium_required");
    return context;
  }
  if (
    process.env.AKISUITE_FEATURES_READY !== "true" ||
    process.env.AKISUITE_SUBSCRIPTIONS_READY !== "true"
  )
    failure(locale, venue, "premium_unavailable");
  const context = await requireBusinessAccess(locale);
  const { data, error } = await context.supabase.rpc("akisuite_venue_premium", {
    p_venue: venue,
  });
  if (error || !data) failure(locale, venue, "premium_required");
  return context;
}
export async function saveEventTemplate(form: FormData) {
  const parsed = input
    .extend({
      eventId: z.string().uuid(),
      name: z.string().trim().min(2).max(100),
    })
    .safeParse(Object.fromEntries(form));
  const locale = form.get("locale") === "en" ? "en" : "es",
    venue = String(form.get("venueId") || "");
  if (!parsed.success) failure(locale, venue, "template");
  const { supabase } = await premiumContext(
    parsed.data.locale,
    parsed.data.venueId,
  );
  const { error } = await supabase.rpc("save_akisuite_event_template", {
    p_event: parsed.data.eventId,
    p_name: parsed.data.name,
  });
  if (error) failure(locale, venue, "template");
  revalidatePath(`/${locale}/business/venue/${venue}`);
  redirect(
    `/${locale}/business/venue/${venue}?section=events&updated=template`,
  );
}
export async function useEventTemplate(form: FormData) {
  const parsed = input
    .extend({
      templateId: z.string().uuid(),
      slug: z
        .string()
        .min(1)
        .max(150)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    })
    .safeParse(Object.fromEntries(form));
  const locale = form.get("locale") === "en" ? "en" : "es",
    venue = String(form.get("venueId") || "");
  if (!parsed.success) failure(locale, venue, "template");
  const { supabase } = await premiumContext(
    parsed.data.locale,
    parsed.data.venueId,
  );
  const { error } = await supabase.rpc("create_akisuite_event_from_template", {
    p_template: parsed.data.templateId,
    p_venue: parsed.data.venueId,
    p_slug: parsed.data.slug,
  });
  if (error) failure(locale, venue, "template");
  revalidatePath(`/${locale}/business/venue/${venue}`);
  redirect(
    `/${locale}/business/venue/${venue}?section=events&updated=template`,
  );
}
export async function scheduleEventPublication(form: FormData) {
  const parsed = input
    .extend({
      eventId: z.string().uuid(),
      publishAt: madridLocalDateTimeSchema,
    })
    .safeParse(Object.fromEntries(form));
  const locale = form.get("locale") === "en" ? "en" : "es",
    venue = String(form.get("venueId") || "");
  if (!parsed.success) failure(locale, venue, "schedule");
  const { supabase } = await premiumContext(
    parsed.data.locale,
    parsed.data.venueId,
  );
  const { error } = await supabase.rpc("schedule_akisuite_event", {
    p_event: parsed.data.eventId,
    p_publish_at: parsed.data.publishAt.toISOString(),
  });
  if (error) failure(locale, venue, "schedule");
  revalidatePath(`/${locale}/business/venue/${venue}`);
  redirect(
    `/${locale}/business/venue/${venue}?section=events&updated=schedule`,
  );
}
export async function cancelFutureEventDates(form: FormData) {
  const parsed = input
    .extend({
      eventId: z.string().uuid(),
      confirm: z.literal("cancel-future-dates"),
    })
    .safeParse(Object.fromEntries(form));
  const locale = form.get("locale") === "en" ? "en" : "es",
    venue = String(form.get("venueId") || "");
  if (!parsed.success) failure(locale, venue, "occurrence");
  const { supabase } = await requireBusinessAccess(parsed.data.locale);
  const { error } = await supabase.rpc("cancel_akisuite_future_dates", {
    p_event: parsed.data.eventId,
  });
  if (error) failure(locale, venue, "occurrence");
  revalidatePath(`/${locale}/business/venue/${venue}`);
  redirect(
    `/${locale}/business/venue/${venue}?section=events&updated=occurrence`,
  );
}
export async function setMediaFolder(form: FormData) {
  const parsed = input
    .extend({ mediaId: z.string().uuid(), name: z.string().trim().max(80) })
    .safeParse(Object.fromEntries(form));
  if (
    !parsed.success ||
    (process.env.AKISUITE_FEATURES_READY !== "true" &&
      process.env.AKISUITE_LISTING_LIBRARY_READY !== "true")
  )
    return { ok: false as const };
  const { supabase } = await requireBusinessAccess(parsed.data.locale);
  const { error } = await supabase.rpc("set_akisuite_media_folder", {
    p_media: parsed.data.mediaId,
    p_name: parsed.data.name,
  });
  if (error) return { ok: false as const };
  revalidatePath(
    `/${parsed.data.locale}/business/venue/${parsed.data.venueId}`,
  );
  return { ok: true as const, folder: parsed.data.name };
}
