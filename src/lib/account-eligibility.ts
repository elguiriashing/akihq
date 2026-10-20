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

/** Existing known-minor demographics restrict tracking only, never paid access. */
export async function accountTrackingAllowed(
  db: SupabaseClient,
  userId: string,
) {
  if (!(await accountFeaturesAllowed(db))) return false;
  const { data, error } = await db
    .from("profiles")
    .select("birth_year")
    .eq("id", userId)
    .maybeSingle();
  if (error) return false;
  const year = data?.birth_year;
  return !(
    typeof year === "number" &&
    Number.isInteger(year) &&
    year >= 1900 &&
    new Date().getUTCFullYear() - year < 18
  );
}
