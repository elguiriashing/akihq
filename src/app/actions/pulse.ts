"use server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
const input = z
  .object({
    company: z.string().uuid(),
    workspace: z.string().min(3).max(80).nullable(),
    locale: z.enum(["en", "es"]),
  })
  .strict();
export async function saveRentalPulseWorkspace(
  value: unknown,
): Promise<{ ok: boolean; error?: string }> {
  if (process.env.AKIPULSE_EXPLICIT_SCOPE_ADAPTERS_READY !== "true")
    return { ok: false, error: "unavailable" };
  const parsed = input.safeParse(value);
  if (!parsed.success) return { ok: false, error: "invalid" };
  try {
    const db = await createSupabaseServerClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return { ok: false, error: "sign_in" };
    const { error } = await db.rpc("set_akipulse_rental_workspace", {
      p_company: parsed.data.company,
      p_workspace: parsed.data.workspace,
    });
    if (error)
      return {
        ok: false,
        error: error.code === "42501" ? "forbidden" : "unavailable",
      };
    revalidatePath(`/${parsed.data.locale}/business`);
    return { ok: true };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}
