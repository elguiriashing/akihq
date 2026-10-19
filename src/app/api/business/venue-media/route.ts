import { uploadVenueImage } from "@/app/[locale]/business/venue/[id]/actions";
import {
  readBoundedFormData,
  RequestSecurityError,
} from "@/lib/request-security";

const reply = (body: unknown, status: number) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return reply({ ok: false, error: "origin" }, 403);
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data"))
    return reply({ ok: false, error: "invalid-file" }, 415);
  let formData: FormData;
  try {
    // Include multipart framing while the image itself remains capped at 10 MB.
    formData = await readBoundedFormData(request, 11 * 1024 * 1024);
  } catch (error) {
    return reply(
      { ok: false, error: "invalid-file" },
      error instanceof RequestSecurityError && error.status === 413 ? 413 : 400,
    );
  }
  formData.set("inline", "1");
  try {
    const result = await uploadVenueImage(formData);
    return reply(result, result.ok ? 200 : 422);
  } catch (error) {
    // Keep the response private and do not expose storage or Auth details.
    console.error(
      "venue_media_upload_failed",
      error instanceof Error ? error.name : "unknown",
    );
    return reply({ ok: false, error: "unavailable" }, 503);
  }
}
