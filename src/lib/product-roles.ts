/** Build-time release switch. Enable only with the coordinated domain cutover.
 * Historical business/CRM capability keys do not change with public brands.
 */
export const roleSwapEnabled =
  process.env.NEXT_PUBLIC_AKISUITE_ROLE_SWAP === "true";
export const managementProduct = {
  name: roleSwapEnabled ? "AkiHQ" : "AkiBusiness",
  origin: roleSwapEnabled ? "https://akihq.app" : "https://akibusiness.com",
  logo: roleSwapEnabled ? "hq" : "business",
} as const;
export const operationsProduct = {
  name: roleSwapEnabled ? "AkiBusiness" : "AkiHQ",
  origin: roleSwapEnabled ? "https://akibusiness.com" : "https://akihq.app",
  logo: roleSwapEnabled ? "business" : "hq",
} as const;

/** Keep validated explicit preview overrides; remap only known old defaults. */
export function roleOrigin(
  value: string | undefined,
  legacy: string,
  target: string,
) {
  if (!value || value === legacy) return target;
  try {
    const url = new URL(value);
    if (
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      return target;
    if (
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname))
    )
      return url.origin;
  } catch {
    /* Invalid public configuration fails to the canonical origin. */
  }
  return target;
}
