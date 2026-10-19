import { cookies } from "next/headers";
import type { DiscoveryQuery } from "@/lib/domain";
import { optionalUser } from "@/lib/auth";
import { repository } from "@/lib/repository";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  defaultRankingConfig,
  rankRecommendations,
  type PreferenceSignal,
  type RankingConfig,
} from "./ranking";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type RecommendationEnvelope = {
  requestId?: string;
  model: "weighted_ranker";
  modelVersion: "1.0.0";
  rankingVersion: number;
  fallbackUsed: boolean;
  items: ReturnType<typeof rankRecommendations>;
};

function configFromRow(row: Record<string, unknown> | null): RankingConfig {
  if (!row || typeof row.weights !== "object" || !row.weights)
    return defaultRankingConfig;
  const raw = row.weights as Record<string, unknown>;
  const number = (key: string, fallback: number) =>
    typeof raw[key] === "number" ? (raw[key] as number) : fallback;
  return {
    version: Number(row.version || 1),
    explorationRatio: Number(
      row.exploration_ratio ?? defaultRankingConfig.explorationRatio,
    ),
    sponsoredMultiplier: Number(
      row.sponsored_multiplier ?? defaultRankingConfig.sponsoredMultiplier,
    ),
    sponsoredMinimumRelevance: Number(
      row.sponsored_minimum_relevance ??
        defaultRankingConfig.sponsoredMinimumRelevance,
    ),
    weights: {
      categoryAffinity: number(
        "category_affinity",
        defaultRankingConfig.weights.categoryAffinity,
      ),
      venueAffinity: number(
        "venue_affinity",
        defaultRankingConfig.weights.venueAffinity,
      ),
      priceAffinity: number(
        "price_affinity",
        defaultRankingConfig.weights.priceAffinity,
      ),
      distanceRelevance: number(
        "distance_relevance",
        defaultRankingConfig.weights.distanceRelevance,
      ),
      temporalRelevance: number(
        "temporal_relevance",
        defaultRankingConfig.weights.temporalRelevance,
      ),
      quality: number("quality", defaultRankingConfig.weights.quality),
      freshness: number("freshness", defaultRankingConfig.weights.freshness),
      sessionIntent: number(
        "session_intent",
        defaultRankingConfig.weights.sessionIntent,
      ),
      repetitionPenalty: number(
        "repetition_penalty",
        defaultRankingConfig.weights.repetitionPenalty,
      ),
      negativeAffinity: number(
        "negative_affinity",
        defaultRankingConfig.weights.negativeAffinity,
      ),
    },
  };
}

export async function recommendDiscovery({
  query,
  surface,
  limit = 50,
}: {
  query: DiscoveryQuery;
  surface: string;
  limit?: number;
}): Promise<RecommendationEnvelope> {
  const started = Date.now();
  const candidates = await repository.discover(query);
  let service: ReturnType<typeof createSupabaseServiceClient> | undefined;
  let preferenceProfileId: string | undefined;
  let signals: PreferenceSignal[] = [];
  let rankingConfig = defaultRankingConfig;
  let personalisedFeedEnabled = true;
  let recommendationReasonsEnabled = true;
  let sponsoredRecommendationsEnabled = true;
  let fallbackUsed = false;
  try {
    service = createSupabaseServiceClient();
    const cookieStore = await cookies();
    const anonymousId = cookieStore.get("ak_anonymous_id")?.value;
    const consent = cookieStore.get("ak_personalisation")?.value === "granted";
    const { user } = await optionalUser();
    const [{ data: configRow }, settingsResult, { data: flagRows }] =
      await Promise.all([
        service
          .from("ranking_configs")
          .select(
            "version,weights,exploration_ratio,sponsored_multiplier,sponsored_minimum_relevance",
          )
          .eq("key", "weighted_ranker")
          .eq("active", true)
          .maybeSingle(),
        user
          ? service
              .from("personalisation_settings")
              .select("personalisation_enabled")
              .eq("profile_id", user.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        service
          .from("feature_flags")
          .select("key,enabled")
          .in("key", [
            "personalised_feed",
            "recommendation_reasons",
            "sponsored_recommendations",
          ]),
      ]);
    const flags = new Map(
      (flagRows || []).map((row) => [row.key, Boolean(row.enabled)]),
    );
    personalisedFeedEnabled = flags.get("personalised_feed") ?? true;
    recommendationReasonsEnabled = flags.get("recommendation_reasons") ?? true;
    sponsoredRecommendationsEnabled =
      flags.get("sponsored_recommendations") ?? true;
    rankingConfig = configFromRow(configRow as Record<string, unknown> | null);
    const enabled =
      personalisedFeedEnabled &&
      consent &&
      (!user || Boolean(settingsResult.data?.personalisation_enabled));
    if (enabled && anonymousId) {
      let profileQuery = service.from("preference_profiles").select("id");
      profileQuery = user
        ? profileQuery.eq("profile_id", user.id)
        : profileQuery.eq("anonymous_id", anonymousId).is("profile_id", null);
      const { data: profile } = await profileQuery.maybeSingle();
      preferenceProfileId = profile?.id;
      if (preferenceProfileId) {
        const { data } = await service
          .from("user_preference_signals")
          .select("dimension,key,short_term_score,long_term_score,confidence")
          .eq("preference_profile_id", preferenceProfileId)
          .gte("confidence", 0.05)
          .limit(500);
        signals = (data || []).map((row) => ({
          dimension: row.dimension as PreferenceSignal["dimension"],
          key: row.key,
          shortTermScore: Number(row.short_term_score),
          longTermScore: Number(row.long_term_score),
          confidence: Number(row.confidence),
        }));
      }
    }
  } catch {
    fallbackUsed = true;
  }

  if (!sponsoredRecommendationsEnabled) {
    rankingConfig = {
      ...rankingConfig,
      sponsoredMultiplier: 1,
      sponsoredMinimumRelevance: 1,
    };
  }

  const requestSeed = crypto.randomUUID();
  const items = rankRecommendations({
    candidates,
    signals,
    radiusKm: query.radiusKm || 25,
    now: query.now,
    sessionCategory: query.category,
    config: rankingConfig,
    requestSeed,
  }).slice(0, limit);
  if (!recommendationReasonsEnabled) {
    for (const item of items) item.reasonCodes = [];
  }

  let requestId: string | undefined;
  if (service) {
    try {
      const context = {
        locality: query.locality || "fuengirola",
        radius_km: query.radiusKm || 25,
        time_window: query.time || "all",
        category: query.category || null,
        price: query.price || null,
      };
      const { data: requestRow, error } = await service
        .from("recommendation_requests")
        .insert({
          id: requestSeed,
          preference_profile_id: preferenceProfileId || null,
          surface,
          model: "weighted_ranker",
          model_version: "1.0.0",
          ranking_version: rankingConfig.version,
          feature_version: 1,
          context,
          candidate_count: candidates.length,
          result_count: items.length,
          latency_ms: Date.now() - started,
          fallback_used: fallbackUsed,
        })
        .select("id")
        .single();
      if (!error && requestRow) {
        requestId = requestRow.id;
        const rows = items
          .map((item, position) => ({ item, position }))
          .filter(
            ({ item }) =>
              uuidPattern.test(item.result.event.id) &&
              uuidPattern.test(item.result.occurrence.id),
          )
          .map(({ item, position }) => ({
            recommendation_request_id: requestId,
            event_id: item.result.event.id,
            occurrence_id: item.result.occurrence.id,
            position,
            candidate_source: item.candidateSource,
            organic_score: item.organicScore,
            final_score: item.finalScore,
            score_components: item.components,
            reason_codes: item.reasonCodes,
            sponsored: item.sponsored,
            exploration: item.exploration,
          }));
        if (rows.length)
          await service.from("recommendation_items").insert(rows);
      }
    } catch {
      fallbackUsed = true;
    }
  }
  return {
    requestId,
    model: "weighted_ranker",
    modelVersion: "1.0.0",
    rankingVersion: rankingConfig.version,
    fallbackUsed,
    items,
  };
}
