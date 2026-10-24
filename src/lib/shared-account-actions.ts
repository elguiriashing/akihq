"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth";
import { publicRequestOrigin } from "@/lib/public-request-origin";
import { sharedProfileSchema, sharedProfileUpdate } from "@/lib/shared-profile";
import { z } from "zod";
import { sharedAccountBilling } from "@/lib/shared-membership";
function settingsPath(locale: "en" | "es") {
  return `/${locale}/account`;
}
export async function saveSharedProfile(form: FormData) {
  const locale = form.get("locale") === "es" ? "es" : "en",
    path = settingsPath(locale);
  const parsed = sharedProfileSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect(`${path}?error=validation&lang=${locale}`);
  const { supabase, user } = await requireUser(locale, path);
  // One atomic update, fixed columns and the verified identity. No caller-supplied ID or role.
  const { data, error } = await supabase
    .from("profiles")
    .update(sharedProfileUpdate(parsed.data))
    .eq("id", user.id)
    .select("id")
    .maybeSingle();
  if (error || !data) redirect(`${path}?error=profile&lang=${locale}`);
  revalidatePath(path);
  revalidatePath("/", "layout");
  redirect(`${path}?updated=1&lang=${locale}`);
}
export async function changeSharedEmail(form: FormData) {
  const locale = form.get("locale") === "es" ? "es" : "en",
    path = settingsPath(locale);
  const email = z.string().trim().email().max(254).safeParse(form.get("email"));
  if (!email.success) redirect(`${path}?error=email&lang=${locale}`);
  const { supabase, user } = await requireUser(locale, path);
  if (user.email?.toLowerCase() === email.data.toLowerCase())
    redirect(`${path}?error=email&lang=${locale}`);
  const origin = publicRequestOrigin(new Headers(await headers()));
  const next = `${path}?email=confirmed&lang=${locale}`;
  const { error } = await supabase.auth.updateUser(
    { email: email.data.toLowerCase() },
    {
      emailRedirectTo: `${origin}/${locale}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  );
  redirect(`${path}?${error ? "error=email" : "email=pending"}&lang=${locale}`);
}
export async function resetSharedPassword(form: FormData) {
  const locale = form.get("locale") === "es" ? "es" : "en",
    path = settingsPath(locale);
  const { supabase, user } = await requireUser(locale, path);
  if (!user.email) redirect(`${path}?error=password&lang=${locale}`);
  const origin = publicRequestOrigin(new Headers(await headers()));
  const recovery = `/${locale}/auth/recover?next=${encodeURIComponent(path)}`;
  const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
    redirectTo: `${origin}/${locale}/auth/callback?next=${encodeURIComponent(recovery)}`,
  });
  redirect(
    `${path}?${error ? "error=password" : "password=sent"}&lang=${locale}`,
  );
}

export async function openSharedBillingPortal(form: FormData) {
  const locale = form.get("locale") === "es" ? "es" : "en",
    path = settingsPath(locale);
  await requireUser(locale, path);
  let target: string | undefined;
  try {
    target = (await sharedAccountBilling("portal", locale)).url;
  } catch {
    redirect(`${path}?error=billing&lang=${locale}`);
  }
  if (!target || new URL(target).origin !== "https://billing.stripe.com")
    redirect(`${path}?error=billing&lang=${locale}`);
  redirect(target);
}

export async function uploadSharedProfileMedia(form: FormData) {
  const locale = form.get("locale") === "es" ? "es" : "en",
    path = settingsPath(locale);
  const kind = form.get("kind"),
    file = form.get("file");
  if (
    !["avatar", "banner"].includes(String(kind)) ||
    !(file instanceof File) ||
    file.size <= 0 ||
    file.size > 10 * 1024 * 1024 ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type)
  )
    redirect(`${path}?error=media&lang=${locale}`);
  const { supabase, user } = await requireUser(locale, path);
  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";
  const objectPath = `${user.id}/${kind}-${crypto.randomUUID()}.${ext}`;
  const bucket = supabase.storage.from("profile-media");
  const upload = await bucket.upload(objectPath, await file.arrayBuffer(), {
    contentType: file.type,
    upsert: false,
  });
  if (upload.error) redirect(`${path}?error=media&lang=${locale}`);
  const { data: url } = bucket.getPublicUrl(objectPath);
  const result = await supabase
    .from("profiles")
    .update(
      kind === "avatar"
        ? { avatar_url: url.publicUrl }
        : { banner_url: url.publicUrl },
    )
    .eq("id", user.id)
    .select("id")
    .maybeSingle();
  if (result.error || !result.data) {
    await bucket.remove([objectPath]);
    redirect(`${path}?error=media&lang=${locale}`);
  }
  revalidatePath("/", "layout");
  redirect(`${path}?updated=media&lang=${locale}`);
}
