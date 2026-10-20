import type { SupabaseClient } from "@supabase/supabase-js";
/** Shared contract: AkiPasa PR #212 owns schema and completion. No local cohort. */
export async function accountFeaturesAllowed(
  db: SupabaseClient,
): Promise<boolean> {
  if (process.env.AKISUITE_ONBOARDING_SCHEMA_READY !== "true") return true;
  const { data, error } = await db.rpc("my_account_onboarding");
  if (
    error ||
    !["exempt", "pending", "complete", "underage"].includes(data?.status)
  )
    throw new Error("Account eligibility is temporarily unavailable");
  return data.status === "complete" || data.status === "exempt";
}
/** Canonical completion uses a separate host-local session. Never pass JWTs/PKCE. */
export function accountCompletionUrl(locale: "en" | "es") {
  return `https://akipasa.com/${locale}/onboarding`;
}
