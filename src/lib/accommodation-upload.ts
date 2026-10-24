/** Adapted from the verified listing-upload contract; native property reservations never use venue identity. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { listingImageDimensions } from "@/lib/listing-image-policy";

const bucket = "accommodation-media";
export type StoredAccommodationUpload = {
  path: string;
  reservationId: string;
};
export class AccommodationUploadError extends Error {
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
export async function discardAccommodationUpload(
  db: SupabaseClient,
  upload: StoredAccommodationUpload,
  serviceFactory = createSupabaseServiceClient,
) {
  const service = serviceFactory();
  const { data, error } = await service.rpc("cancel_accommodation_upload", {
    p_reservation: upload.reservationId,
  });
  if (!error && data === true)
    await service.storage.from(bucket).remove([upload.path]);
}
export async function storeAccommodationUpload(
  db: SupabaseClient,
  property: string,
  file: File,
  serviceFactory = createSupabaseServiceClient,
): Promise<StoredAccommodationUpload> {
  const extension = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  }[file.type];
  if (!extension || file.size < 1 || file.size > 10485760)
    throw new AccommodationUploadError("invalid-file");
  // No native authenticated-Storage fallback: rollout activates the owner reservation path atomically.
  if (process.env.AKISUITE_ACCOMMODATION_MEDIA_READY !== "true")
    throw new AccommodationUploadError("unavailable");
  const info = await db.rpc("accommodation_listing_info", {
    p_property: property,
  });
  if (info.error || info.data?.uploads_enforced !== true)
    throw new AccommodationUploadError("unavailable");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const dimensions = listingImageDimensions(bytes, file.type);
  if (!dimensions) throw new AccommodationUploadError("invalid-file");
  const sha = await digest(bytes);
  const reserved = await db.rpc("reserve_accommodation_upload", {
    p_property: property,
    p_digest: sha,
    p_mime: file.type,
    p_bytes: bytes.byteLength,
    p_width: dimensions.width,
    p_height: dimensions.height,
  });
  if (reserved.error)
    throw new AccommodationUploadError(
      reserved.error.code === "PT402"
        ? reserved.error.message.includes("resolution")
          ? "resolution"
          : "quota"
        : "unavailable",
    );
  if (!reserved.data?.id || !reserved.data?.path)
    throw new AccommodationUploadError("unavailable");
  const upload = {
    path: String(reserved.data.path),
    reservationId: String(reserved.data.id),
  };
  let service: SupabaseClient;
  try {
    service = serviceFactory();
  } catch {
    throw new AccommodationUploadError("unavailable");
  }
  try {
    const written = await service.storage
      .from(bucket)
      .upload(upload.path, bytes, {
        contentType: file.type,
        upsert: false,
        metadata: {
          accommodation_upload_id: upload.reservationId,
          sha256: sha,
        },
      });
    if (written.error) throw new AccommodationUploadError("storage");
    // Read back exact stored bytes before issuing the service-only verification receipt.
    const downloaded = await service.storage.from(bucket).download(upload.path);
    if (
      downloaded.error ||
      !downloaded.data ||
      downloaded.data.size !== bytes.byteLength
    )
      throw new AccommodationUploadError("storage");
    const stored = new Uint8Array(await downloaded.data.arrayBuffer());
    const storedDimensions = listingImageDimensions(stored, file.type);
    if (
      (await digest(stored)) !== sha ||
      storedDimensions?.width !== dimensions.width ||
      storedDimensions?.height !== dimensions.height
    )
      throw new AccommodationUploadError("storage");
    const verified = await service.rpc("complete_accommodation_upload", {
      p_reservation: upload.reservationId,
      p_digest: sha,
    });
    if (verified.error || verified.data !== true)
      throw new AccommodationUploadError("unavailable");
    return upload;
  } catch (error) {
    await discardAccommodationUpload(db, upload, serviceFactory);
    throw error instanceof AccommodationUploadError
      ? error
      : new AccommodationUploadError("unavailable");
  }
}
