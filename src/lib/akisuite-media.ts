import type { SupabaseClient } from "@supabase/supabase-js";
export async function authorizedSuiteMedia(
  supabase: SupabaseClient,
  venue: string,
  media: string,
) {
  if (
    process.env.AKISUITE_FEATURES_READY === "true" &&
    process.env.AKISUITE_SUBSCRIPTIONS_READY === "true"
  ) {
    const { data, error } = await supabase.rpc("akisuite_media_allowed", {
      p_venue: venue,
      p_media: media,
    });
    return !error && data === true ? { id: media } : null;
  }
  const { data, error } = await supabase
    .from("venue_media")
    .select("id")
    .eq("id", media)
    .eq("venue_id", venue)
    .maybeSingle();
  return !error ? data : null;
}
