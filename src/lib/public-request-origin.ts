import { managementProduct, roleSwapEnabled } from "./product-roles";
const canonical = managementProduct.origin;
function trustedOrigin(value: string) {
  try {
    const parsed = new URL(value);
    if (
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    )
      return null;
    const local = ["localhost", "127.0.0.1"].includes(parsed.hostname);
    const previews = (process.env.AKISUITE_ALLOWED_PREVIEW_ORIGINS || "")
      .split(",")
      .map((origin) => origin.trim());
    if (local && ["http:", "https:"].includes(parsed.protocol))
      return parsed.origin;
    if (
      parsed.protocol === "https:" &&
      ([
        canonical,
        roleSwapEnabled
          ? "https://www.akihq.app"
          : "https://www.akibusiness.com",
        "https://business.akipasa.com",
      ].includes(parsed.origin) ||
        previews.includes(parsed.origin))
    )
      return parsed.origin;
  } catch {
    /* Fail closed for malformed origin. */
  }
  return null;
}
export function publicRequestOrigin(
  headers: Headers,
  _fallback: string = canonical,
) {
  void _fallback;
  const host = (headers.get("host") || "").split(",")[0].trim();
  const local = /^(localhost|127\.0\.0\.1)(:|$)/.test(host);
  return trustedOrigin(`${local ? "http" : "https"}://${host}`) || canonical;
}

export function isTrustedBusinessHost(host: string) {
  const local = /^(localhost|127\.0\.0\.1)(:|$)/.test(host);
  return trustedOrigin(`${local ? "http" : "https"}://${host}`) !== null;
}
