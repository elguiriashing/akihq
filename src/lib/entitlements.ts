import { roleSwapEnabled } from "./product-roles";
import { redirect } from "next/navigation";
import { requireUser } from "./auth";
import type { Locale } from "./config";
import { canModerate } from "./roles";

export async function requireBusinessAccess(
  locale: Locale,
  next = `/${locale}/business`,
) {
  const context = await requireUser(locale, next);
  const { data: profile } = await context.supabase
    .from("profiles")
    .select("app_role")
    .eq("id", context.user.id)
    .maybeSingle();

  if (canModerate(profile?.app_role || "")) return context;

  // Team access belongs to the venue, not the member's personal subscription
  // or platform role. RLS/RPCs still enforce each venue role on every operation.
  const { data: membership, error: membershipError } = await context.supabase
    .from("venue_members")
    .select("venue_id")
    .eq("profile_id", context.user.id)
    .in("role", ["editor", "manager", "owner"])
    .limit(1)
    .maybeSingle();
  if (!membershipError && membership) return context;

  const { data: active, error } = await context.supabase.rpc(
    "has_active_entitlement",
    {
      p_profile: context.user.id,
      p_plan: "business",
    },
  );
  if (error || !active)
    redirect(
      `/${locale}/account/subscription?plan=business&error=business_required`,
    );

  return context;
}

export async function requireBusinessProAccess(
  locale: Locale,
  next = `/${locale}/business`,
) {
  const context = await requireBusinessAccess(locale, next);
  const { data: active, error } = await context.supabase.rpc(
    "has_active_entitlement",
    {
      p_profile: context.user.id,
      p_plan: "business_pro",
    },
  );
  if (error || !active)
    redirect(
      `/${locale}/account/subscription?plan=business_pro&error=business_pro_required`,
    );
  return context;
}

/** The free hub lists only RLS-visible resources; entering it grants no mutations.
 * Existing venue actions and rental/property RPCs retain resource authorization.
 */
export async function requireManagementHomeAccess(
  locale: Locale,
  next = `/${locale}/business`,
) {
  return roleSwapEnabled
    ? requireUser(locale, next)
    : requireBusinessAccess(locale, next);
}
