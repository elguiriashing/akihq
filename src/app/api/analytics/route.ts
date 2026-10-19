import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHmac } from "node:crypto";
import { z } from "zod";
import {
  requireSameOriginRequest,
  RequestSecurityError,
} from "@/lib/request-security";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const signalSchema = z
  .object({
    action: z.enum([
      "event_view",
      "venue_view",
      "directions_click",
      "booking_click",
      "share",
    ]),
    venueId: z.string().uuid().nullable().optional(),
    eventId: z.string().uuid().nullable().optional(),
    locale: z.enum(["es", "en"]),
  })
  .strict();

function analyticsSourceHash(request: Request) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Analytics rate-limit secret is unavailable");
  const clientAddress = request.headers.get("cf-connecting-ip") || "unknown";
  return createHmac("sha256", secret)
    .update(`akipasa-analytics:${clientAddress}`)
    .digest("hex");
}

export async function POST(request: Request) {
  try {
    requireSameOriginRequest(request);
    if (
      request.headers.get("content-type")?.split(";")[0] !== "application/json"
    )
      return NextResponse.json({ error: "unsupported" }, { status: 415 });
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 16_000)
      return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
    const body = await request.json().catch(() => null);
    const parsed = signalSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json({ error: "invalid" }, { status: 400 });

    const sessionId = (await cookies()).get("ak_session_id")?.value;
    if (!sessionId || !z.string().uuid().safeParse(sessionId).success)
      return NextResponse.json(
        { error: "tracking_session_missing" },
        { status: 409 },
      );

    const supabase = await createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    const service = createSupabaseServiceClient();
    const { error } = await service.rpc("record_analytics_limited", {
      p_action: parsed.data.action,
      p_venue: parsed.data.venueId || null,
      p_event: parsed.data.eventId || null,
      p_metadata: { locale: parsed.data.locale },
      p_profile: auth.user?.id || null,
      p_session: sessionId,
      p_source_hash: analyticsSourceHash(request),
    });
    if (error) {
      const rateLimited = error.message.toLowerCase().includes("rate limit");
      return NextResponse.json(
        { error: rateLimited ? "rate_limited" : "unavailable" },
        { status: rateLimited ? 429 : 503 },
      );
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof RequestSecurityError)
      return NextResponse.json({ error: error.code }, { status: error.status });
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
