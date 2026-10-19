import { z } from "zod";

export const relevanceActions = [
  "KEEP",
  "DOWNRANK",
  "HIDE",
  "MOVE TO AKIDUERMO",
  "REVIEW",
  "CLOSED/ARCHIVE CANDIDATE",
] as const;
export const relevanceFilterSchema = z.object({
  q: z.string().trim().max(160).default(""),
  action: z.enum(["", ...relevanceActions]).default(""),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
});
export const relevanceDecisionSchema = z.object({
  venueId: z.string().uuid(),
  action: z.enum(["KEEP", "DOWNRANK", "HIDE"]),
  weight: z.number().min(0.01).max(1).default(1),
  fingerprint: z.string().regex(/^[a-f0-9]{32}$/),
  reason: z.string().trim().min(10).max(1000),
});
export function recommendationWeight(value: unknown) {
  const weight = Number(value);
  return Number.isFinite(weight) && weight > 0 && weight <= 1 ? weight : 1;
}
export function effectiveVenueRelevance(
  row: Record<string, unknown>,
  enabled: boolean,
) {
  return {
    discoveryEnabled: !enabled || row.discovery_enabled !== false,
    recommendationWeight: enabled
      ? recommendationWeight(row.recommendation_weight)
      : 1,
  };
}
export type RelevanceProposal = {
  id: string;
  name: string;
  slug: string;
  address: string;
  action: (typeof relevanceActions)[number];
  relevance_class: string;
  chain_name: string | null;
  confidence: string;
  source_categories: string;
  reason: string;
  fingerprint: string;
  stale: boolean;
  manual_override: boolean;
};
