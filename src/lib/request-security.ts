export class RequestSecurityError extends Error {
  constructor(
    message: string,
    readonly status = 403,
    readonly code = "invalid_origin",
  ) {
    super(message);
  }
}

export function requireSameOriginRequest(request: Request) {
  const expected = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  if (origin) {
    if (origin === expected) return;
    throw new RequestSecurityError("Same-origin request required");
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "same-origin" || fetchSite === "same-site") return;

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      if (new URL(referer).origin === expected) return;
    } catch {
      // Fall through to the same generic rejection.
    }
  }
  throw new RequestSecurityError("Same-origin request required");
}

export async function readBoundedText(request: Request, maximumBytes: number) {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes)
    throw new RequestSecurityError(
      "Payload too large",
      413,
      "payload_too_large",
    );

  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let byteLength = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > maximumBytes) {
        await reader.cancel();
        throw new RequestSecurityError(
          "Payload too large",
          413,
          "payload_too_large",
        );
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } catch (error) {
    if (error instanceof RequestSecurityError) throw error;
    throw new RequestSecurityError(
      "Invalid UTF-8 payload",
      400,
      "invalid_payload",
    );
  }
}

export async function readBoundedFormData(
  request: Request,
  maximumBytes: number,
) {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes)
    throw new RequestSecurityError(
      "Payload too large",
      413,
      "payload_too_large",
    );

  if (!request.body)
    throw new RequestSecurityError("Invalid multipart payload", 400);
  const reader = request.body.getReader();
  let byteLength = 0;
  // Count the actual stream before handing each chunk to the multipart parser.
  // Do not trust a missing/understated length or decode binary image bytes.
  const boundedBody = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        byteLength += value.byteLength;
        if (byteLength > maximumBytes) {
          const error = new RequestSecurityError(
            "Payload too large",
            413,
            "payload_too_large",
          );
          await reader.cancel().catch(() => {});
          controller.error(error);
          return;
        }
        controller.enqueue(value);
      } catch (error) {
        controller.error(error);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
  return new Response(boundedBody, {
    headers: {
      "Content-Type": request.headers.get("content-type") || "",
    },
  }).formData();
}
