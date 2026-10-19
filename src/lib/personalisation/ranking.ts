import { recommendationWeight } from "../venue-relevance";
import type { DiscoveryResult } from "@/lib/domain";

export type PreferenceDimension =
  | "category"
  | "subcategory"
  | "venue"
  | "artist"
  | "organiser"
  | "price"
  | "distance"
  | "time"
  | "weekday"
  | "planning_horizon"
  | "search_intent";

export type PreferenceSignal = {
  dimension: PreferenceDimension;
  key: string;
  shortTermScore: number;
  longTermScore: number;
  confidence: number;
};

export type RankingWeights = {
  categoryAffinity: number;
  venueAffinity: number;
  priceAffinity: number;
  distanceRelevance: number;
  temporalRelevance: number;
  quality: number;
  freshness: number;
  sessionIntent: number;
  repetitionPenalty: number;
  negativeAffinity: number;
};

export type RankingConfig = {
  version: number;
  weights: RankingWeights;
  explorationRatio: number;
  sponsoredMultiplier: number;
  sponsoredMinimumRelevance: number;
};

export type RecommendationReason =
  | "because_you_like_category"
  | "from_a_venue_you_like"
  | "matches_your_budget"
  | "nearby"
  | "starting_soon"
  | "happening_now"
  | "popular_nearby"
  | "verified_quality"
  | "something_new"
  | "sponsored_relevant";

export type RankedRecommendation = {
  result: DiscoveryResult;
  organicScore: number;
  finalScore: number;
  components: Record<string, number>;
  reasonCodes: RecommendationReason[];
  sponsored: boolean;
  exploration: boolean;
  candidateSource: string;
};

export const defaultRankingConfig: RankingConfig = {
  version: 1,
  weights: {
    categoryAffinity: 0.24,
    venueAffinity: 0.18,
    priceAffinity: 0.08,
    distanceRelevance: 0.15,
    temporalRelevance: 0.13,
    quality: 0.1,
    freshness: 0.06,
    sessionIntent: 0.16,
    repetitionPenalty: 0.12,
    negativeAffinity: 0.28,
  },
  explorationRatio: 0.15,
  sponsoredMultiplier: 1.12,
  sponsoredMinimumRelevance: 0.25,
};

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function priceBucket(cents: number) {
  if (cents === 0) return "free";
  if (cents < 1000) return "under_10";
  if (cents < 2000) return "under_20";
  return "premium";
}

function affinity(
  signals: PreferenceSignal[],
  dimension: PreferenceDimension,
  key: string,
) {
  const signal = signals.find(
    (item) => item.dimension === dimension && item.key === key,
  );
  if (!signal) return 0;
  return (
    (signal.shortTermScore * 0.7 + signal.longTermScore * 0.3) *
    signal.confidence
  );
}

function temporalRelevance(result: DiscoveryResult, now: Date) {
  const starts = new Date(result.occurrence.startsAt).getTime();
  const ends = new Date(result.occurrence.endsAt).getTime();
  const current = now.getTime();
  if (starts <= current && ends > current) return 1;
  const hours = (starts - current) / 3_600_000;
  if (hours <= 2) return 0.95;
  if (hours <= 8) return 0.8;
  if (hours <= 24) return 0.65;
  if (hours <= 72) return 0.45;
  return 0.25;
}

function deterministicUnit(seed: string) {
  let hash = 2166136261;
  for (const char of seed)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) / 4_294_967_295;
}

export function rankRecommendations({
  candidates,
  signals = [],
  radiusKm,
  now = new Date(),
  sessionCategory,
  config = defaultRankingConfig,
  requestSeed = "cold-start",
}: {
  candidates: DiscoveryResult[];
  signals?: PreferenceSignal[];
  radiusKm: number;
  now?: Date;
  sessionCategory?: string;
  config?: RankingConfig;
  requestSeed?: string;
}): RankedRecommendation[] {
  const scored = candidates
    .filter((result) => result.venue.discoveryEnabled !== false)
    .map((result) => {
      const category = affinity(signals, "category", result.event.category);
      const venue = affinity(signals, "venue", result.venue.id);
      const price = affinity(
        signals,
        "price",
        priceBucket(result.event.priceCents),
      );
      const distance = Math.exp(
        -result.distanceKm / Math.max(2, radiusKm * 0.65),
      );
      const temporal = temporalRelevance(result, now);
      const quality = result.venue.verified ? 1 : 0.45;
      const freshness = clamp(
        1 -
          Math.max(
            0,
            new Date(result.occurrence.startsAt).getTime() - now.getTime(),
          ) /
            (1000 * 60 * 60 * 24 * 30),
      );
      const intent =
        sessionCategory && result.event.category === sessionCategory ? 1 : 0;
      const negative =
        Math.abs(Math.min(0, category)) + Math.abs(Math.min(0, venue));
      const positiveCategory = Math.max(0, category);
      const positiveVenue = Math.max(0, venue);
      const positivePrice = Math.max(0, price);
      const components = {
        category_affinity: positiveCategory * config.weights.categoryAffinity,
        venue_affinity: positiveVenue * config.weights.venueAffinity,
        price_affinity: positivePrice * config.weights.priceAffinity,
        distance_relevance: distance * config.weights.distanceRelevance,
        temporal_relevance: temporal * config.weights.temporalRelevance,
        quality: quality * config.weights.quality,
        freshness: freshness * config.weights.freshness,
        session_intent: intent * config.weights.sessionIntent,
        negative_affinity: -negative * config.weights.negativeAffinity,
      };
      const organicScore = clamp(
        Object.values(components).reduce((total, value) => total + value, 0) *
          recommendationWeight(result.venue.recommendationWeight),
      );
      const exploration =
        signals.length > 0 &&
        category === 0 &&
        deterministicUnit(`${requestSeed}:${result.event.id}`) <
          config.explorationRatio;
      const explorationBonus = exploration ? 0.035 : 0;
      const sponsored =
        result.event.sponsored &&
        organicScore >= config.sponsoredMinimumRelevance;
      const finalScore = clamp(
        organicScore * (sponsored ? config.sponsoredMultiplier : 1) +
          explorationBonus,
        0,
        1.2,
      );
      const reasons: RecommendationReason[] = [];
      if (positiveCategory > 0.12) reasons.push("because_you_like_category");
      if (positiveVenue > 0.12) reasons.push("from_a_venue_you_like");
      if (positivePrice > 0.12) reasons.push("matches_your_budget");
      if (result.distanceKm <= Math.min(5, radiusKm * 0.35))
        reasons.push("nearby");
      if (temporal === 1) reasons.push("happening_now");
      else if (temporal >= 0.8) reasons.push("starting_soon");
      if (quality === 1) reasons.push("verified_quality");
      if (exploration) reasons.push("something_new");
      if (sponsored) reasons.push("sponsored_relevant");
      return {
        result,
        organicScore,
        finalScore,
        components,
        reasonCodes: reasons.slice(0, 3),
        sponsored,
        exploration,
        candidateSource: result.event.sponsored
          ? "sponsored_eligible"
          : "nearby",
      };
    });

  scored.sort(
    (a, b) =>
      b.finalScore - a.finalScore ||
      +new Date(a.result.occurrence.startsAt) -
        +new Date(b.result.occurrence.startsAt),
  );

  const categoryCounts = new Map<string, number>();
  const venueCounts = new Map<string, number>();
  return scored
    .map((item) => {
      const categoryCount = categoryCounts.get(item.result.event.category) || 0;
      const venueCount = venueCounts.get(item.result.venue.id) || 0;
      categoryCounts.set(item.result.event.category, categoryCount + 1);
      venueCounts.set(item.result.venue.id, venueCount + 1);
      const diversityPenalty = Math.min(
        0.24,
        categoryCount * 0.035 + venueCount * 0.08,
      );
      return { ...item, finalScore: item.finalScore - diversityPenalty };
    })
    .sort((a, b) => b.finalScore - a.finalScore);
}
