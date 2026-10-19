import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { behaviourBatchSchema } from "@/lib/personalisation/schema";
import {
  requireSameOriginRequest,
  RequestSecurityError,
} from "@/lib/request-security";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    requireSameOriginRequest(request);
    if (
      request.headers.get("content-type")?.split(";")[0] !== "application/json"
    )
      return NextResponse.json(
        { error: "unsupported_media_type" },
        { status: 415 },
      );
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 64_000)
      return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
    const parsed = behaviourBatchSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success)
      return NextResponse.json(
        { error: "invalid_behaviour_batch" },
        { status: 400 },
      );

    const cookieStore = await cookies();
    const anonymousId = cookieStore.get("ak_anonymous_id")?.value;
    const sessionId = cookieStore.get("ak_session_id")?.value;
    if (!anonymousId || !sessionId)
      return NextResponse.json(
        { error: "tracking_session_missing" },
        { status: 409 },
      );

    const supabase = await createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    let allowed = cookieStore.get("ak_personalisation")?.value === "granted";
    if (user) {
      const { data: settings } = await supabase
        .from("personalisation_settings")
        .select("personalisation_enabled")
        .eq("profile_id", user.id)
        .maybeSingle();
      allowed = allowed && Boolean(settings?.personalisation_enabled);
    }

    const service = createSupabaseServiceClient();
    const { data, error } = await service.rpc("ingest_behaviour_batch", {
      p_events: parsed.data.events,
      p_profile: user?.id || null,
      p_anonymous: anonymousId,
      p_session: sessionId,
      p_personalisation_allowed: allowed,
      p_verified: false,
    });
    if (error) {
      const rateLimited = error.message.toLowerCase().includes("rate limit");
      return NextResponse.json(
        { error: rateLimited ? "rate_limited" : "ingestion_unavailable" },
        { status: rateLimited ? 429 : 503 },
      );
    }
    return NextResponse.json(data, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    if (error instanceof RequestSecurityError)
      return NextResponse.json({ error: error.code }, { status: error.status });
    return NextResponse.json(
      { error: "ingestion_unavailable" },
      { status: 503 },
    );
  }
}
