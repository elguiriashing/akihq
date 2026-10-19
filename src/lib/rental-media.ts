import { createSupabaseServerClient } from "@/lib/supabase/server";
export type RentalMediaRow = {
  id: string;
  company_id: string;
  storage_bucket: string;
  storage_path: string;
  alt: string;
  size_bytes: number;
  url?: string;
};
export async function rentalBranchMedia(
  db: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  companyId: string,
  importLegacy = false,
) {
  const { data, error, count } = await db
    .from("car_rental_media")
    .select("id,company_id,storage_bucket,storage_path,alt,size_bytes", {
      count: "exact",
    })
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(200);
  const rows: RentalMediaRow[] = data || [];
  let importPending = false;
  for (const row of rows) {
    if (importLegacy && row.storage_bucket === "event-media") {
      const ext = row.storage_path.split(".").pop()?.toLowerCase();
      const path = `${companyId}/${row.id}.${["jpg", "jpeg", "png", "webp"].includes(ext || "") ? ext : "jpg"}`;
      const { error: copyError } = await db.storage
        .from("event-media")
        .copy(row.storage_path, path, { destinationBucket: "rental-media" });
      if (!copyError || String(copyError.statusCode) === "409") {
        const { error: updateError } = await db
          .from("car_rental_media")
          .update({ storage_bucket: "rental-media", storage_path: path })
          .eq("id", row.id)
          .eq("company_id", companyId);
        if (!updateError) {
          row.storage_bucket = "rental-media";
          row.storage_path = path;
        } else importPending = true;
      } else importPending = true;
    }
    const { data: signed } = await db.storage
      .from(row.storage_bucket)
      .createSignedUrl(row.storage_path, 3600);
    row.url = signed?.signedUrl;
  }
  return {
    rows,
    error: Boolean(error || count === null || (count || 0) > rows.length),
    importPending,
  };
}
export function rentalImageType(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return { type: "image/jpeg", ext: "jpg" };
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b))
    return { type: "image/png", ext: "png" };
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return { type: "image/webp", ext: "webp" };
  return null;
}
