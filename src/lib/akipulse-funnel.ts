import { z } from "zod";
const stage = z.enum([
  "claim_completed",
  "hq_activated",
  "checkout_started",
  "payment_verified",
  "subscription_upgraded",
  "subscription_cancelled",
]);
const funnel = z.discriminatedUnion("available", [
  z.object({ available: z.literal(false), reason: z.string().max(80) }),
  z.object({
    available: z.literal(true),
    scope: z.literal("workspace"),
    days: z.number().int().min(1).max(90),
    stages: z.record(
      stage,
      z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    ),
    coverage: z.literal("consented_verified_observations_only"),
    retention_days: z.number().int().min(1).max(3650),
    collection_started_at: z.string().datetime({ offset: true }),
    claim_stage_available: z.boolean(),
    cta_attribution_available: z.literal(false),
    conversion_rate_available: z.literal(false),
    hq_activation_definition: z.literal("owner_created_management_workspace"),
  }),
]);
export type BusinessFunnel = z.infer<typeof funnel>;
/** Only a response bound to the selected scope and period can supply counts. */
export function readBusinessFunnel(
  value: unknown,
  kind: string,
  id: string,
  days: number,
): BusinessFunnel | null {
  const direct = funnel.safeParse(value);
  if (direct.success && !direct.data.available) return direct.data;
  const response = z
    .object({
      kind: z.string(),
      id: z.string().uuid(),
      days: z.number(),
      funnel,
    })
    .safeParse(value);
  return response.success &&
    response.data.kind === kind &&
    response.data.id === id &&
    response.data.days === days &&
    (!response.data.funnel.available || response.data.funnel.days === days)
    ? response.data.funnel
    : null;
}
