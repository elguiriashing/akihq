/** Owner-approved monthly EUR catalogue, synchronized across the five products.
 * Historical plan identifiers and existing subscription terms are retained. */
import catalogue from "../../config/approved-pricing.json";
export const approvedPricing = catalogue;
export function monthlyPrice(cents: number, locale: "en" | "es") {
  return new Intl.NumberFormat(locale === "es" ? "es-ES" : "en-IE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}
export function premiumName(
  product: "akipasa" | "akiduermo" | "akicoches",
  audience: "individual" | "business",
  locale: "en" | "es",
) {
  const audienceName =
    audience === "individual"
      ? locale === "es"
        ? "para particulares"
        : "for individuals"
      : locale === "es"
        ? "para empresas"
        : "for businesses";
  return `${catalogue.discovery[product].name} (${audienceName})`;
}
