import { AIAccessError } from "./auth";

export async function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = new URL(request.url).origin;
  if (origin === expected) return;

  const proxySecret = request.headers.get("x-akipasa-ai-crm") || "";
  const expectedProxySecret = process.env.AI_CRM_PROXY_SECRET || "";
  const hasBearer = /^Bearer\s+\S+/i.test(
    request.headers.get("authorization") || "",
  );
  if (
    hasBearer &&
    expectedProxySecret &&
    (await timingSafeSecretEqual(proxySecret, expectedProxySecret))
  ) {
    return;
  }

  throw new AIAccessError(
    "Same-origin or trusted CRM proxy request required",
    403,
    "invalid_origin",
  );
}

export async function timingSafeSecretEqual(value: string, expected: string) {
  const encoder = new TextEncoder();
  const [valueDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(value)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const left = new Uint8Array(valueDigest);
  const right = new Uint8Array(expectedDigest);
  let difference = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    difference |= (left[index] || 0) ^ (right[index] || 0);
  }
  return difference === 0;
}
