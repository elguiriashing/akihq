import type { SupabaseClient } from "@supabase/supabase-js";

export const featureFlagKeys = [
  "community_submissions",
  "loyalty_check_ins",
  "promotion_requests",
  "personalised_feed",
  "recommendation_reasons",
  "sponsored_recommendations",
  "experimental_ranking",
  "social_recommendations",
  "partner_api",
  "venue_relevance",
] as const;

export type FeatureFlagKey = (typeof featureFlagKeys)[number];
export type FeatureFlags = Record<FeatureFlagKey, boolean>;

export const defaultFeatureFlags: FeatureFlags = {
  community_submissions: true,
  loyalty_check_ins: true,
  promotion_requests: true,
  personalised_feed: true,
  recommendation_reasons: true,
  sponsored_recommendations: true,
  experimental_ranking: false,
  social_recommendations: false,
  partner_api: false,
  venue_relevance: false,
};

export function resolveFeatureFlags(
  rows:
    | Array<{
        key: string;
        enabled: boolean;
      }>
    | null
    | undefined,
): FeatureFlags {
  const resolved = { ...defaultFeatureFlags };
  for (const row of rows || []) {
    if (featureFlagKeys.includes(row.key as FeatureFlagKey)) {
      resolved[row.key as FeatureFlagKey] = row.enabled;
    }
  }
  return resolved;
}

export async function loadFeatureFlags(
  supabase: SupabaseClient,
): Promise<FeatureFlags> {
  return (await loadFeatureFlagsState(supabase)).flags;
}

export async function loadFeatureFlagsState(
  supabase: SupabaseClient,
): Promise<{ flags: FeatureFlags; unavailable: boolean }> {
  const { data, error } = await supabase
    .from("feature_flags")
    .select("key,enabled");
  return {
    flags: error ? { ...defaultFeatureFlags } : resolveFeatureFlags(data),
    unavailable: Boolean(error),
  };
}
