"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { roleSwapEnabled } from "@/lib/product-roles";
const localeSchema = z.enum(["en", "es"]),
  uuid = z.string().uuid();
const creation = z.object({
  locale: localeSchema,
  requestId: uuid,
  name: z.string().trim().min(2).max(120),
});
const attachment = z.object({
  locale: localeSchema,
  organisation: uuid,
  workspace: z.string().regex(/^[a-z0-9][a-z0-9_-]{2,79}$/),
});
export async function createOperatingOrganisation(form: FormData) {
  const locale = form.get("locale") === "en" ? "en" : "es",
    path = `/${locale}/business/locations`;
  const parsed = creation.safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect(`${path}?companyError=validation`);
  const { supabase } = await requireUser(locale, path);
  const retry = new URLSearchParams({
    companyRequestId: parsed.data.requestId,
    companyName: parsed.data.name,
  });
  if (!roleSwapEnabled || process.env.AKISUITE_ORGANISATIONS_READY !== "true") {
    retry.set("companyError", "unavailable");
    redirect(`${path}?${retry}`);
  }
  let result;
  try {
    result = await supabase.rpc("create_operating_organisation", {
      p_request_id: parsed.data.requestId,
      p_name: parsed.data.name,
    });
  } catch {
    retry.set("companyError", "unavailable");
    redirect(`${path}?${retry}`);
  }
  if (result.error || typeof result.data !== "string") {
    retry.set(
      "companyError",
      result.error?.code === "PT409" ? "conflict" : "unavailable",
    );
    redirect(`${path}?${retry}`);
  }
  redirect(`${path}?organisation=${encodeURIComponent(result.data)}`);
}
export async function attachOperatingLocation(form: FormData) {
  const locale = form.get("locale") === "en" ? "en" : "es",
    path = `/${locale}/business/locations`;
  const parsed = attachment.safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect(`${path}?companyError=validation`);
  const { supabase } = await requireUser(locale, path);
  const target = new URLSearchParams({
    organisation: parsed.data.organisation,
  });
  if (!roleSwapEnabled || process.env.AKISUITE_ORGANISATIONS_READY !== "true") {
    target.set("companyError", "unavailable");
    redirect(`${path}?${target}`);
  }
  let result;
  try {
    result = await supabase.rpc("attach_operating_location", {
      p_organisation: parsed.data.organisation,
      p_workspace: parsed.data.workspace,
    });
  } catch {
    target.set("companyError", "unavailable");
    redirect(`${path}?${target}`);
  }
  if (result.error) {
    target.set(
      "companyError",
      result.error.code === "PT409" ? "conflict" : "unavailable",
    );
    redirect(`${path}?${target}`);
  }
  redirect(`${path}?${target}`);
}

export async function attachRentalLocation(form: FormData) {
  const locale = form.get("locale") === "en" ? "en" : "es",
    path = `/${locale}/business/locations`;
  const parsed = z
    .object({
      company: uuid,
      workspace: z.string().regex(/^[a-z0-9][a-z0-9_-]{2,79}$/),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect(`${path}?companyError=validation`);
  const { supabase } = await requireUser(locale, path);
  if (!roleSwapEnabled || process.env.AKISUITE_ORGANISATIONS_READY !== "true")
    redirect(`${path}?companyError=unavailable`);
  let result;
  try {
    result = await supabase.rpc("attach_rental_operating_location", {
      p_company: parsed.data.company,
      p_workspace: parsed.data.workspace,
    });
  } catch {
    redirect(`${path}?companyError=unavailable`);
  }
  if (result.error)
    redirect(
      `${path}?companyError=${result.error.code === "PT409" ? "conflict" : "unavailable"}`,
    );
  redirect(path);
}
