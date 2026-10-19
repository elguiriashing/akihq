import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SuiteProduct = "akipasa" | "akiduermo" | "akibusiness" | "akihq";

/** Called only after authentication; SQL ensures at most one welcome per
 * account/product and requires a verified email address. Failure must never
 * interrupt signing in or rendering the product. */
export async function queueSuitePortalWelcome(
  product: SuiteProduct,
  locale: "en" | "es",
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("queue_suite_portal_welcome", {
      p_product: product,
      p_locale: locale,
    });
    if (error) console.warn("suite_welcome_queue_unavailable", error.code);
  } catch {
    console.warn("suite_welcome_queue_unavailable");
  }
}
