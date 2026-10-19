"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { roleSwapEnabled } from "@/lib/product-roles";
const input = z.object({
  locale: z.enum(["en", "es"]),
  requestId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
});
export async function createPrivateLocation(form: FormData) {
  const locale = form.get("locale") === "en" ? "en" : "es";
  const path = `/${locale}/business/locations`;
  const parsed = input.safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect(`${path}?error=validation`);
  const { supabase } = await requireUser(locale, path);
  const retry = new URLSearchParams({
    requestId: parsed.data.requestId,
    name: parsed.data.name,
  });
  if (
    !roleSwapEnabled ||
    process.env.AKISUITE_PRIVATE_LOCATIONS_READY !== "true"
  ) {
    retry.set("error", "unavailable");
    redirect(`${path}?${retry}`);
  }
  let result: { data: unknown; error: { code?: string } | null };
  try {
    result = await supabase.rpc("create_private_operating_location", {
      p_request_id: parsed.data.requestId,
      p_name: parsed.data.name,
    });
  } catch {
    retry.set("error", "unavailable");
    redirect(`${path}?${retry}`);
  }
  const { data, error } = result;
  if (error || typeof data !== "string" || !data) {
    retry.set("error", error?.code === "PT409" ? "conflict" : "unavailable");
    redirect(`${path}?${retry}`);
  }
  redirect(`${path}?created=${encodeURIComponent(data)}`);
}
