import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  readBoundedFormData,
  RequestSecurityError,
} from "@/lib/request-security";
import { rentalImageType } from "@/lib/rental-media";
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return Response.json({ error: "origin_mismatch" }, { status: 403 });
  const db = await createSupabaseServerClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user)
    return Response.json({ error: "sign_in_required" }, { status: 401 });
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data"))
    return Response.json({ error: "invalid_file" }, { status: 415 });
  let form: FormData;
  try {
    form = await readBoundedFormData(request, 9 * 1024 * 1024);
  } catch (error) {
    return Response.json(
      { error: "invalid_file" },
      { status: error instanceof RequestSecurityError ? error.status : 400 },
    );
  }
  const company = String(form?.get("companyId") || "");
  const file = form?.get("file");
  if (
    !/^[0-9a-f-]{36}$/i.test(company) ||
    !(file instanceof File) ||
    !file.size ||
    file.size > 8388608
  )
    return Response.json({ error: "invalid_file" }, { status: 400 });
  const { data: allowed, error: accessError } = await db.rpc(
    "can_manage_rental_company",
    { p_company: company },
  );
  if (accessError || !allowed)
    return Response.json({ error: "not_authorized" }, { status: 403 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = rentalImageType(bytes);
  if (!kind) return Response.json({ error: "image_required" }, { status: 400 });
  const id = crypto.randomUUID(),
    path = `${company}/${id}.${kind.ext}`;
  const { error: uploadError } = await db.storage
    .from("rental-media")
    .upload(path, bytes, { contentType: kind.type, upsert: false });
  if (uploadError)
    return Response.json({ error: "upload_failed" }, { status: 503 });
  const { error } = await db.from("car_rental_media").insert({
    id,
    company_id: company,
    storage_path: path,
    storage_bucket: "rental-media",
    alt: String(form?.get("alt") || file.name).slice(0, 180),
    size_bytes: bytes.length,
  });
  if (error) {
    await db.storage.from("rental-media").remove([path]);
    return Response.json({ error: "media_save_failed" }, { status: 503 });
  }
  return Response.json(
    { id },
    { status: 201, headers: { "Cache-Control": "private, no-store" } },
  );
}
