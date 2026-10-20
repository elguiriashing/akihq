import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { listingImageDimensions } from "@/lib/listing-image-policy";

const bucket = "event-media";
export type StoredListingUpload = {
  path: string;
  reservationId: string | null;
};
export class ListingUploadError extends Error {
  constructor(
    public readonly code:
      | "resolution"
      | "quota"
      | "storage"
      | "unavailable"
      | "invalid-file",
  ) {
    super(code);
  }
}
async function digest(bytes: Uint8Array) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
/** Cleanup checks committed state before deleting, including ambiguous insert responses. */
export async function discardListingUpload(
  db: SupabaseClient,
  upload: StoredListingUpload,
  serviceFactory = createSupabaseServiceClient,
) {
  if (!upload.reservationId) {
    await db.storage.from(bucket).remove([upload.path]);
    return;
  }
  const service = serviceFactory();
  const { data, error } = await service.rpc("cancel_listing_upload", {
    p_reservation: upload.reservationId,
  });
  if (!error && data === true)
    await service.storage.from(bucket).remove([upload.path]);
}
export async function storeListingUpload(
  db: SupabaseClient,
  venue: string,
  file: File,
  event: string | null = null,
  serviceFactory = createSupabaseServiceClient,
): Promise<StoredListingUpload> {
  const extension = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  }[file.type];
  if (!extension || file.size < 1 || file.size > 10485760)
    throw new ListingUploadError("invalid-file");
  const path = `${venue}/${event ? `events/${event}/` : ""}${crypto.randomUUID()}.${extension}`;
  let enforced = false;
  if (process.env.AKISUITE_LISTING_UPLOADS_READY === "true") {
    const info = await db.rpc("listing_limits_info", { p_venue: venue });
    if (info.error) throw new ListingUploadError("unavailable");
    enforced = info.data?.uploads_enforced === true;
  }
  if (!enforced) {
    const { error } = await db.storage
      .from(bucket)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw new ListingUploadError("storage");
    return { path, reservationId: null };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const dimensions = listingImageDimensions(bytes, file.type);
  if (!dimensions) throw new ListingUploadError("invalid-file");
  const sha = await digest(bytes);
  const reserved = await db.rpc("reserve_listing_upload", {
    p_venue: venue,
    p_digest: sha,
    p_mime: file.type,
    p_bytes: bytes.byteLength,
    p_width: dimensions.width,
    p_height: dimensions.height,
    p_event: event,
  });
  if (reserved.error)
    throw new ListingUploadError(
      reserved.error.code === "PT402"
        ? reserved.error.message.includes("resolution")
          ? "resolution"
          : "quota"
        : "unavailable",
    );
  if (!reserved.data?.id || !reserved.data?.path)
    throw new ListingUploadError("unavailable");
  const upload = {
    path: String(reserved.data.path),
    reservationId: String(reserved.data.id),
  };
  const service = serviceFactory();
  try {
    const written = await service.storage
      .from(bucket)
      .upload(upload.path, bytes, {
        contentType: file.type,
        upsert: false,
        metadata: { listing_upload_id: upload.reservationId, sha256: sha },
      });
    if (written.error) throw new ListingUploadError("storage");
    // Read back exact stored bytes before issuing the service-only verification receipt.
    const downloaded = await service.storage.from(bucket).download(upload.path);
    if (
      downloaded.error ||
      !downloaded.data ||
      downloaded.data.size !== bytes.byteLength
    )
      throw new ListingUploadError("storage");
    const stored = new Uint8Array(await downloaded.data.arrayBuffer());
    const storedDimensions = listingImageDimensions(stored, file.type);
    if (
      (await digest(stored)) !== sha ||
      storedDimensions?.width !== dimensions.width ||
      storedDimensions?.height !== dimensions.height
    )
      throw new ListingUploadError("storage");
    const verified = await service.rpc("complete_listing_upload", {
      p_reservation: upload.reservationId,
      p_digest: sha,
    });
    if (verified.error || verified.data !== true)
      throw new ListingUploadError("unavailable");
    return upload;
  } catch (error) {
    await discardListingUpload(db, upload, serviceFactory);
    throw error instanceof ListingUploadError
      ? error
      : new ListingUploadError("unavailable");
  }
}
