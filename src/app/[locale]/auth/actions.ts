"use server";
import {
  accountFeaturesAllowed,
  accountCompletionUrl,
} from "@/lib/account-eligibility";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { config, isLocale } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  passwordSchema,
  safeAuthDestinationForOrigin,
} from "@/lib/auth-security";
import { publicRequestOrigin } from "@/lib/public-request-origin";

function requestOrigin(headerStore: Awaited<ReturnType<typeof headers>>) {
  return publicRequestOrigin(new Headers(headerStore), config.siteUrl);
}
function authDestination(
  locale: "es" | "en",
  requested: string | undefined,
  origin: string,
) {
  return safeAuthDestinationForOrigin(locale, requested, origin);
}

async function authReturnUrl(
  locale: "es" | "en",
  mode: "signin" | "signup" | "magic" | "recover",
  formData: FormData,
  notice: Record<string, string>,
) {
  const requested = formData.get("next");
  const next = authDestination(
    locale,
    typeof requested === "string" ? requested : undefined,
    requestOrigin(await headers()),
  );
  const query = new URLSearchParams({ mode, ...notice, next });
  return `/${locale}/auth?${query.toString()}`;
}

export async function requestMagicLink(formData: FormData) {
  const fallbackLocale = formData.get("locale") === "en" ? "en" : "es";
  const parsed = z
    .object({
      email: z.string().email(),
      locale: z.string(),
      next: z.string().optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success || !isLocale(parsed.data.locale))
    redirect(
      await authReturnUrl(fallbackLocale, "magic", formData, {
        error: "invalid",
      }),
    );
  const locale = parsed.data.locale;
  const headerStore = await headers();
  const origin = requestOrigin(headerStore);
  const next = authDestination(locale, parsed.data.next, origin);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${origin}/${locale}/auth/callback?next=${encodeURIComponent(next)}`,
      shouldCreateUser: false,
    },
  });
  if (error)
    redirect(await authReturnUrl(locale, "magic", formData, { error: "send" }));
  redirect(await authReturnUrl(locale, "magic", formData, { sent: "1" }));
}

export async function requestPasswordReset(formData: FormData) {
  const parsed = z
    .object({
      email: z.string().email(),
      locale: z.enum(["es", "en"]),
      next: z.string().optional(),
    })
    .safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  if (!parsed.success)
    redirect(
      await authReturnUrl(locale, "recover", formData, { error: "invalid" }),
    );
  const origin = requestOrigin(await headers());
  const next = authDestination(locale, parsed.data.next, origin);
  const recover = `/${locale}/auth/recover?${new URLSearchParams({ next })}`;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    {
      redirectTo: `${origin}/${locale}/auth/callback?next=${encodeURIComponent(recover)}`,
    },
  );
  if (error)
    redirect(
      await authReturnUrl(locale, "recover", formData, { error: "send" }),
    );
  redirect(
    await authReturnUrl(locale, "recover", formData, { recovery: "sent" }),
  );
}

export async function signUpWithPassword(formData: FormData) {
  const parsed = z
    .object({
      email: z.string().email(),
      password: passwordSchema,
      confirmPassword: z.string(),
      acceptTerms: z.literal("accepted"),
      locale: z.enum(["es", "en"]),
      next: z.string().optional(),
    })
    .refine((value) => value.password === value.confirmPassword, {
      path: ["confirmPassword"],
    })
    .safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  if (!parsed.success)
    redirect(
      await authReturnUrl(locale, "signup", formData, {
        error: "password-policy",
      }),
    );
  const origin = requestOrigin(await headers());
  const next = authDestination(locale, parsed.data.next, origin);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/${locale}/auth/callback?next=${encodeURIComponent(next)}`,
      data: {
        preferred_locale: locale,
        terms_version: config.currentTermsVersion,
      },
    },
  });
  if (error)
    redirect(
      await authReturnUrl(locale, "signup", formData, { error: "signup" }),
    );
  if (data.session) {
    if (!(await accountFeaturesAllowed(supabase)))
      redirect(accountCompletionUrl(locale));
    redirect(next);
  }
  redirect(
    await authReturnUrl(locale, "signup", formData, { registered: "1" }),
  );
}

export async function signInWithPassword(formData: FormData) {
  const parsed = z
    .object({
      email: z.string().email(),
      password: z.string().min(1).max(128),
      locale: z.enum(["es", "en"]),
      next: z.string().optional(),
    })
    .safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  if (!parsed.success)
    redirect(
      await authReturnUrl(locale, "signin", formData, { error: "signin" }),
    );
  const next = authDestination(
    locale,
    parsed.data.next,
    requestOrigin(await headers()),
  );
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error)
    redirect(
      await authReturnUrl(locale, "signin", formData, { error: "signin" }),
    );
  if (!(await accountFeaturesAllowed(supabase)))
    redirect(accountCompletionUrl(locale));
  redirect(next);
}

export async function signInWithGoogle(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "es";
  if (formData.get("acceptTerms") !== "accepted")
    redirect(
      await authReturnUrl(locale, "signin", formData, { error: "terms" }),
    );
  const origin = requestOrigin(await headers());
  const next = authDestination(
    locale,
    String(formData.get("next") || ""),
    origin,
  );
  const cookieStore = await cookies();
  cookieStore.set("akipasa_terms_ack", config.currentTermsVersion, {
    httpOnly: true,
    maxAge: 600,
    path: "/",
    sameSite: "lax",
    secure: origin.startsWith("https://"),
  });
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/${locale}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });
  if (error || !data.url)
    redirect(
      await authReturnUrl(locale, "signin", formData, { error: "google" }),
    );
  redirect(data.url);
}

export async function signOut(formData: FormData) {
  const locale = String(formData.get("locale"));
  const safeLocale = isLocale(locale) ? locale : "es";
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect(`/${safeLocale}`);
}
