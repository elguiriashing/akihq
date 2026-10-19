import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { config, type Locale } from "./config";
import { hasSupabaseAuthCookie } from "./supabase/auth-cookie";
import { createSupabasePublicClient } from "./supabase/public";
import { createSupabaseServerClient } from "./supabase/server";

export async function optionalUser() {
  const cookieStore = await cookies();
  if (!hasSupabaseAuthCookie(cookieStore.getAll())) {
    return { supabase: createSupabasePublicClient(), user: null };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function requireUser(locale: Locale, next = `/${locale}/account`) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth?next=${encodeURIComponent(next)}`);
  const { data: profile } = await supabase
    .from("profiles")
    .select("terms_version")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.terms_version !== config.currentTermsVersion)
    redirect(`/${locale}/terms/accept?next=${encodeURIComponent(next)}`);
  return { supabase, user };
}
