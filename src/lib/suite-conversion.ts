import { readPrivacyChoices } from "./privacy-consent";
/** Consent-gated GA4 events only; never a billing or claim-completion authority. */
export function trackSuiteConversion(
  action: "suite_cta_impression" | "suite_cta_click" | "business_claim_start",
  locale: "en" | "es",
  product: "hq" | "business",
  category: string,
) {
  if (typeof window === "undefined" || !readPrivacyChoices().analytics) return;
  const analyticsWindow = window as Window & {
    gtag?: (...args: unknown[]) => void;
  };
  analyticsWindow.gtag?.("event", action, {
    destination_product: product,
    business_category: category,
    language: locale,
    source_host: location.hostname,
    transport_type: "beacon",
  });
}
