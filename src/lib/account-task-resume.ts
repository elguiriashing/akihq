/** Shared AkiSuite completion-resume contract v1. Contains navigation only. */
import {
  suiteHref,
  suiteReferralCode,
  type SuiteProduct,
} from "./suite-navigation";

const products = ["pasa", "duermo", "coches", "hq", "business"] as const;
const roots: Record<SuiteProduct, string> = {
  pasa: "/account",
  duermo: "/account",
  coches: "/account",
  hq: "/business",
  business: "/",
};
const routes: Record<SuiteProduct, RegExp> = {
  pasa: /^\/(?:account|passports|bookings|business)(?:\/[A-Za-z0-9_-]+)*\/?$/,
  duermo: /^\/(?:account|saved|bookings|stays(?:\/[A-Za-z0-9_-]+)?)\/?$/,
  coches: /^\/(?:account|saved|bookings|rentals(?:\/[A-Za-z0-9_-]+)?)\/?$/,
  hq: /^\/business(?:\/[A-Za-z0-9_-]+)*\/?$/,
  business: /^\/$/,
};
const taskKeys = new Set([
  "view",
  "tab",
  "venueId",
  "locationId",
  "propertyId",
  "branchId",
  "companyId",
  "organisationId",
  "workspace",
  "vehicle",
  "start",
  "end",
  "page",
]);

export function accountTaskResume(
  product: unknown,
  locale: "en" | "es",
  requested?: string,
) {
  if (
    typeof product !== "string" ||
    !products.includes(product as SuiteProduct)
  )
    return null;
  const target = product as SuiteProduct;
  let path = roots[target];
  const task = new URLSearchParams();
  if (
    requested &&
    requested.length <= 1024 &&
    requested.startsWith("/") &&
    !/[\\%#\u0000-\u0020]/.test(requested) &&
    !requested.startsWith("//")
  ) {
    const [pathname, query = ""] = requested.split("?");
    const relative = pathname.replace(/^\/(?:en|es)(?=\/|$)/, "") || "/";
    const incoming = new URLSearchParams(query);
    const referral =
      incoming.getAll("ref").length === 1
        ? suiteReferralCode(incoming.get("ref"))
        : undefined;
    const referralLanding = target === "pasa" && relative === "/referrals";
    if (routes[target].test(relative) || (referralLanding && referral)) {
      path = relative;
      if (referral) task.set("ref", referral);
      for (const [key, value] of incoming) {
        if (
          incoming.getAll(key).length === 1 &&
          taskKeys.has(key) &&
          /^[A-Za-z0-9_-]{1,128}$/.test(value)
        )
          task.set(key, value);
      }
    }
  }
  const canonical = new URL(suiteHref(target, locale, { path }));
  for (const [key, value] of task) canonical.searchParams.set(key, value);
  const local = path + (task.size ? `?${task}` : "");
  return { product: target, path: local, url: canonical.toString() };
}

/** Server pages pass only bounded task keys, never an arbitrary return URL. */
export function accountTaskFromSearch(
  product: unknown,
  locale: "en" | "es",
  pathname: string,
  query: Record<string, string | string[] | undefined>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value !== "string") continue;
    if (key === "ref") {
      const referral = suiteReferralCode(value);
      if (referral) params.set(key, referral);
    } else if (taskKeys.has(key) && /^[A-Za-z0-9_-]{1,128}$/.test(value)) {
      params.set(key, value);
    }
  }
  return accountTaskResume(
    product,
    locale,
    pathname + (params.size ? `?${params}` : ""),
  )?.path;
}

/** A local next URL survives host-local email/OAuth auth without exporting a token. */
export function accountResumeNext(
  product: unknown,
  locale: "en" | "es",
  requested?: string,
) {
  const task = accountTaskResume(product, locale, requested);
  if (!task) return `/${locale}/account`;
  return `/${locale}/account-resume?${new URLSearchParams({ product: task.product, path: task.path })}`;
}

export function suiteAccountCompletionUrl(
  product: unknown,
  locale: "en" | "es",
  requested?: string,
) {
  return `https://akipasa.com/${locale}/onboarding?${new URLSearchParams({ next: accountResumeNext(product, locale, requested) })}`;
}
