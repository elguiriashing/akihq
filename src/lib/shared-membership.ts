import { createSupabaseServerClient } from "@/lib/supabase/server";
export type SharedSubscription = {
  plan_code: string;
  billing_interval: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};
export async function sharedAccountBilling(
  action: "summary" | "portal",
  locale: "en" | "es",
) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error("Identity required");
  const response = await fetch("https://akipasa.com/api/account/portal", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://akihq.app",
      authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify({ action, locale, product: "hq" }),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Shared billing unavailable");
  return (await response.json()) as {
    subscriptions?: SharedSubscription[];
    hasCustomer?: boolean;
    url?: string;
  };
}
