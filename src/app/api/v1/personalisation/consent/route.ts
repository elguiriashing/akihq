import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  requireSameOriginRequest,
  RequestSecurityError,
} from "@/lib/request-security";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const schema = z
  .object({
    analytics: z.boolean(),
    personalisation: z.boolean(),
    marketing: z.boolean(),
  })
  .strict();

export async function POST(request: Request) {
  try {
    requireSameOriginRequest(request);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    const supabase = await createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
      const { error } = await supabase.from("personalisation_settings").upsert({
        profile_id: auth.user.id,
        analytics_enabled: parsed.data.analytics,
        personalisation_enabled: parsed.data.personalisation,
        marketing_enabled: parsed.data.marketing,
        updated_at: new Date().toISOString(),
      });
      if (error)
        return NextResponse.json({ error: "unavailable" }, { status: 503 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return error instanceof RequestSecurityError
      ? NextResponse.json({ error: error.code }, { status: error.status })
      : NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  try {
    requireSameOriginRequest(request);
    const cookieStore = await cookies();
    const anonymousId = cookieStore.get("ak_anonymous_id")?.value;
    const supabase = await createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
      const { error } = await supabase.rpc("reset_personalisation_data");
      if (error)
        return NextResponse.json({ error: "unavailable" }, { status: 503 });
      const { error: consentError } = await supabase
        .from("personalisation_settings")
        .update({
          analytics_enabled: false,
          personalisation_enabled: false,
          marketing_enabled: false,
          updated_at: new Date().toISOString(),
        })
        .eq("profile_id", auth.user.id);
      if (consentError)
        return NextResponse.json({ error: "unavailable" }, { status: 503 });
    } else if (anonymousId) {
      const service = createSupabaseServiceClient();
      await service
        .from("behaviour_events")
        .delete()
        .eq("anonymous_id", anonymousId);
      await service
        .from("preference_profiles")
        .delete()
        .eq("anonymous_id", anonymousId)
        .is("profile_id", null);
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return error instanceof RequestSecurityError
      ? NextResponse.json({ error: error.code }, { status: error.status })
      : NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
