/** AkiSuite navigation contract v1; synchronized source, no sibling imports. */
export type SuiteProduct = "pasa" | "duermo" | "coches" | "hq" | "business";
export type SuiteLocale = "en" | "es";
const origins: Record<SuiteProduct, string> = {
  pasa: "https://akipasa.com",
  duermo: "https://akiduermo.com",
  coches: "https://akicoches.com",
  hq: "https://akihq.app",
  business: "https://akibusiness.com",
};

/** Only a path is accepted: never forward auth tokens, next/return URLs or arbitrary queries. */
export function suiteHref(
  product: SuiteProduct,
  locale: SuiteLocale,
  options: { path?: string; referralCode?: string; workspaceId?: string } = {},
): string {
  if (!Object.hasOwn(origins, product))
    throw new Error("Unknown AkiSuite product.");
  const language = locale === "es" ? "es" : "en";
  const path = options.path || (product === "hq" ? "/business" : "/");
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    /[\\?#%\s]/.test(path)
  ) {
    throw new Error("AkiSuite destination must be a plain local path.");
  }
  if (path.split("/").some((part) => part === "." || part === "..")) {
    throw new Error("AkiSuite destination cannot traverse paths.");
  }
  const url = new URL(origins[product]);
  if (product === "pasa" || product === "hq") {
    const unprefixed = path.replace(/^\/(en|es)(?=\/|$)/, "");
    url.pathname = `/${language}${unprefixed === "/" ? "" : unprefixed}`;
  } else {
    url.pathname = path;
    url.searchParams.set(product === "business" ? "locale" : "lang", language);
  }
  if (options.referralCode && /^[A-Z0-9]{8,24}$/.test(options.referralCode)) {
    url.searchParams.set("ref", options.referralCode);
  }
  if (
    product === "business" &&
    options.workspaceId &&
    /^[A-Za-z0-9_-]{1,128}$/.test(options.workspaceId)
  ) {
    url.searchParams.set("workspace", options.workspaceId);
  }
  return url.toString();
}
