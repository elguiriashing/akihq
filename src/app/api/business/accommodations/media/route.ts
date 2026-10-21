import {
  storeAccommodationUpload,
  discardAccommodationUpload,
  AccommodationUploadError,
} from "@/lib/accommodation-upload";
import { accommodationApiTerms } from "@/lib/accommodation-api-terms";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { accommodationPropertyId } from "@/lib/independent-accommodation";
import {
  readBoundedFormData,
  readBoundedText,
  RequestSecurityError,
} from "@/lib/request-security";
import { z } from "zod";
const bucket = "accommodation-media";
const reply = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
const mutation = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("place"),
      property: accommodationPropertyId,
      id: z.string().uuid(),
      position: z.number().int().min(0).max(249).nullable(),
    })
    .strict(),
  z
    .object({
      action: z.literal("remove"),
      property: accommodationPropertyId,
      id: z.string().uuid(),
    })
    .strict(),
]);
async function access(property: string) {
  const db = await createSupabaseServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { response: reply({ error: "sign_in" }, 401) };
  const terms = await accommodationApiTerms(db, user.id);
  if (terms)
    return {
      response: reply({ error: terms }, terms === "unavailable" ? 503 : 403),
    };
  const { data, error } = await db.rpc("can_manage_accommodation_property", {
    p_property: property,
  });
  if (error) return { response: reply({ error: "unavailable" }, 503) };
  if (data !== true) return { response: reply({ error: "forbidden" }, 403) };
  return { db };
}
export async function GET(request: Request) {
  if (process.env.AKISUITE_ACCOMMODATION_READY !== "true")
    return reply({ error: "unavailable" }, 503);
  const property = accommodationPropertyId.safeParse(
    new URL(request.url).searchParams.get("property"),
  );
  if (!property.success) return reply({ error: "invalid" }, 400);
  const authorized = await access(property.data);
  if (!authorized.db) return authorized.response;
  const db = authorized.db;
  const { data, error } = await db
    .from("accommodation_property_media")
    .select("id,storage_path,alt_text,public_position")
    .eq("property_id", property.data)
    .order("created_at", { ascending: false })
    .limit(251);
  if (error) return reply({ error: "unavailable" }, 503);
  const limits = await db.rpc("accommodation_listing_info", {
    p_property: property.data,
  });
  if (limits.error) return reply({ error: "unavailable" }, 503);
  const rows = data || [];
  const signed = rows.length
    ? await db.storage.from(bucket).createSignedUrls(
        rows.map((r) => r.storage_path),
        600,
      )
    : { data: [], error: null };
  if (signed.error) return reply({ error: "unavailable" }, 503);
  const urls = new Map(
    (signed.data || [])
      .filter((s) => !s.error && s.path)
      .map((s) => [s.path, s.signedUrl]),
  );
  return reply({
    limits: limits.data,
    media: rows.map((r) => ({
      id: r.id,
      altText: r.alt_text,
      position: r.public_position,
      url: urls.get(r.storage_path) ?? null,
    })),
  });
}
export async function POST(request: Request) {
  if (process.env.AKISUITE_ACCOMMODATION_READY !== "true")
    return reply({ error: "unavailable" }, 503);
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return reply({ error: "origin" }, 403);
  try {
    if (
      request.headers.get("content-type")?.startsWith("multipart/form-data")
    ) {
      const form = await readBoundedFormData(request, 11 * 1024 * 1024);
      const property = accommodationPropertyId.safeParse(form.get("property"));
      const file = form.get("file");
      const alt = form.get("altText");
      if (
        !property.success ||
        !(file instanceof File) ||
        file.size < 12 ||
        file.size > 10 * 1024 * 1024 ||
        (alt !== null && (typeof alt !== "string" || alt.length > 300))
      )
        return reply({ error: "invalid_file" }, 400);
      const authorized = await access(property.data);
      if (!authorized.db) return authorized.response;
      const db = authorized.db;
      const stored = await storeAccommodationUpload(db, property.data, file);
      const id = crypto.randomUUID();
      const inserted = await db.from("accommodation_property_media").insert({
        id,
        property_id: property.data,
        storage_path: stored.path,
        mime_type: file.type,
        size_bytes: file.size,
        alt_text: alt || "",
      });
      if (inserted.error) {
        await discardAccommodationUpload(db, stored);
        return reply({ error: "unavailable" }, 503);
      }
      return reply({ id }, 201);
    }
    const parsed = mutation.safeParse(
      JSON.parse(await readBoundedText(request, 4096)),
    );
    if (!parsed.success) return reply({ error: "invalid" }, 400);
    const p = parsed.data;
    const authorized = await access(p.property);
    if (!authorized.db) return authorized.response;
    const db = authorized.db;
    if (p.action === "place") {
      const updated = await db
        .from("accommodation_property_media")
        .update({ public_position: p.position })
        .eq("property_id", p.property)
        .eq("id", p.id)
        .select("id");
      return updated.error
        ? reply({ error: "unavailable" }, 409)
        : updated.data?.length
          ? reply({ ok: true })
          : reply({ error: "not_found" }, 404);
    }
    const selected = await db
      .from("accommodation_property_media")
      .select("storage_path")
      .eq("property_id", p.property)
      .eq("id", p.id)
      .maybeSingle();
    if (selected.error) return reply({ error: "unavailable" }, 503);
    if (!selected.data) return reply({ error: "not_found" }, 404);
    const removed = await db.storage
      .from(bucket)
      .remove([selected.data.storage_path]);
    if (removed.error) return reply({ error: "unavailable" }, 503);
    const deleted = await db
      .from("accommodation_property_media")
      .delete()
      .eq("property_id", p.property)
      .eq("id", p.id);
    return deleted.error
      ? reply({ error: "unavailable" }, 503)
      : reply({ ok: true });
  } catch (error) {
    if (error instanceof AccommodationUploadError)
      return reply(
        { error: error.code },
        error.code === "quota" || error.code === "resolution"
          ? 402
          : error.code === "invalid-file"
            ? 400
            : 503,
      );
    return reply(
      { error: "invalid" },
      error instanceof RequestSecurityError ? error.status : 400,
    );
  }
}
