import { NextResponse } from "next/server";
import { z } from "zod";
import { recommendDiscovery } from "@/lib/personalisation/server";
import {
  RequestSecurityError,
  requireSameOriginRequest,
} from "@/lib/request-security";

const querySchema = z.object({
  locality: z
    .string()
    .regex(/^[a-z0-9-]{2,80}$/)
    .default("fuengirola"),
  radius: z.coerce.number().int().min(1).max(100).default(25),
  time: z.enum(["now", "tonight", "tomorrow", "weekend", "all"]).default("all"),
  category: z
    .string()
    .regex(/^[a-z0-9-]{2,80}$/)
    .optional(),
  price: z.enum(["free", "paid"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  language: z.enum(["es", "en"]).default("es"),
});

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    requireSameOriginRequest(request);
  } catch (error) {
    return error instanceof RequestSecurityError
      ? NextResponse.json({ error: error.code }, { status: error.status })
      : NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success)
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  const data = await recommendDiscovery({
    query: {
      locality: parsed.data.locality,
      radiusKm: parsed.data.radius,
      time: parsed.data.time,
      category: parsed.data.category,
      price: parsed.data.price,
    },
    surface: "recommendation_api",
    limit: parsed.data.limit,
  });
  return NextResponse.json(
    {
      recommendation_request_id: data.requestId || null,
      model: data.model,
      model_version: data.modelVersion,
      ranking_version: data.rankingVersion,
      fallback_used: data.fallbackUsed,
      recommendations: data.items.map((item) => ({
        event_id: item.result.event.id,
        slug: item.result.event.slug,
        title:
          item.result.event.title[parsed.data.language] ||
          item.result.event.title.es,
        venue: item.result.venue.name,
        distance_km: Number(item.result.distanceKm.toFixed(2)),
        starts_at: item.result.occurrence.startsAt,
        price_cents: item.result.event.priceCents,
        currency: item.result.event.currency,
        reason_codes: item.reasonCodes,
        sponsored: item.sponsored,
      })),
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}
