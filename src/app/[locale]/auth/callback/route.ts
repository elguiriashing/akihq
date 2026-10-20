import {
  accountFeaturesAllowed,
  accountCompletionUrl,
} from "@/lib/account-eligibility";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { config, isLocale } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { publicRequestOrigin } from "@/lib/public-request-origin";
import {
  safeAuthDestinationForOrigin,
  taskFromAuthCallback,
} from "@/lib/auth-security";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  const safeLocale = isLocale(locale) ? locale : "es";
  const url = new URL(request.url);
  const publicOrigin = publicRequestOrigin(request.headers, url.origin);
  const code = url.searchParams.get("code");
  const requested = url.searchParams.get("next");
  const next = safeAuthDestinationForOrigin(
    safeLocale,
    requested ?? undefined,
    publicOrigin,
  );
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const cookieStore = await cookies();
      if (
        cookieStore.get("akipasa_terms_ack")?.value ===
        config.currentTermsVersion
      ) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { error: acceptanceError } = await supabase.rpc(
            "accept_current_terms",
            {
              p_version: config.currentTermsVersion,
              p_locale: safeLocale,
            },
          );
          if (acceptanceError)
            return NextResponse.redirect(
              new URL(`/${safeLocale}/auth?error=terms`, publicOrigin),
            );
        }
        cookieStore.delete("akipasa_terms_ack");
      }
      if (
        !/^\/(en|es)\/auth\/recover(?:\?|$)/.test(next) &&
        !(await accountFeaturesAllowed(supabase))
      )
        return NextResponse.redirect(accountCompletionUrl(safeLocale, next));
      return NextResponse.redirect(new URL(next, publicOrigin));
    }
  }
  return NextResponse.redirect(
    new URL(
      `/${safeLocale}/auth?${new URLSearchParams({
        error: "callback",
        next: taskFromAuthCallback(
          safeLocale,
          requested ?? undefined,
          publicOrigin,
        ),
      })}`,
      publicOrigin,
    ),
  );
}
