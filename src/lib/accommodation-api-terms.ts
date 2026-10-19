import { config } from "./config";
import type { createSupabaseServerClient } from "./supabase/server";

/** Match requireUser's current-terms gate without redirecting JSON callers. */
export async function accommodationApiTerms(
  db: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
) {
  const { data, error } = await db
    .from("profiles")
    .select("terms_version")
    .eq("id", userId)
    .maybeSingle();
  if (error) return "unavailable";
  return data?.terms_version === config.currentTermsVersion
    ? null
    : "terms_required";
}
