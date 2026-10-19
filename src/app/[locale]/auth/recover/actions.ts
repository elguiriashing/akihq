"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import {
  passwordSchema,
  safeAuthDestinationForOrigin,
} from "@/lib/auth-security";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { publicRequestOrigin } from "@/lib/public-request-origin";
import { config } from "@/lib/config";

export async function updateRecoveredPassword(formData: FormData) {
  const parsed = z
    .object({
      locale: z.enum(["es", "en"]),
      next: z.string().optional(),
      password: passwordSchema,
      confirmPassword: z.string(),
    })
    .refine((value) => value.password === value.confirmPassword, {
      path: ["confirmPassword"],
    })
    .safeParse(Object.fromEntries(formData));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const requestHeaders = await headers();
  const origin = publicRequestOrigin(
    new Headers(requestHeaders),
    config.siteUrl,
  );
  const requested = formData.get("next");
  const next = safeAuthDestinationForOrigin(
    locale,
    typeof requested === "string" ? requested : undefined,
    origin,
  );
  const recoveryUrl = `/${locale}/auth/recover?${new URLSearchParams({ next })}`;
  if (!parsed.success) redirect(`${recoveryUrl}&error=password-policy`);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    redirect(
      `/${locale}/auth?${new URLSearchParams({ error: "recovery", next })}`,
    );
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) redirect(`${recoveryUrl}&error=save`);
  // A completed password change deliberately revokes all account sessions.
  await supabase.auth.signOut({ scope: "global" });
  redirect(`/${locale}/auth?${new URLSearchParams({ reset: "1", next })}`);
}
