import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export class AIAccessError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

async function authenticatedAIUser(request?: Request) {
  const service = createSupabaseServiceClient();
  const authorization = request?.headers.get("authorization") || "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const supabase = bearer ? service : await createSupabaseServerClient();
  const {
    data: { user },
  } = bearer
    ? await service.auth.getUser(bearer)
    : await supabase.auth.getUser();
  if (!user)
    throw new AIAccessError("Authentication required", 401, "unauthorized");

  return { user, supabase, service };
}

export async function requireAIUser(request?: Request) {
  return authenticatedAIUser(request);
}

export async function requireAIAdministrator(request?: Request) {
  const { user, supabase, service } = await authenticatedAIUser(request);
  const { data: profile } = await service
    .from("profiles")
    .select("app_role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.app_role !== "administrator") {
    throw new AIAccessError("Administrator role required", 403, "forbidden");
  }

  return { user, supabase, service };
}

export function aiErrorResponse(error: unknown) {
  if (error instanceof AIAccessError) {
    return Response.json(
      { ok: false, error: error.code, message: error.message },
      { status: error.status },
    );
  }
  const message = error instanceof Error ? error.message : "AI request failed";
  const safeMessage =
    message.includes("budget") ||
    message.includes("rate limit") ||
    message.includes("concurrency") ||
    message.includes("pricing") ||
    message.includes("OpenAI authentication failed") ||
    message.includes("OpenAI authorization failed") ||
    message.includes("OpenAI rate limit or quota") ||
    message.includes("provider is not configured")
      ? message
      : "The AI request could not be completed.";
  return Response.json(
    { ok: false, error: "ai_request_failed", message: safeMessage },
    { status: 400 },
  );
}
