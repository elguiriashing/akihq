import {
  managementProduct,
  operationsProduct,
  roleOrigin,
} from "./product-roles";
import { spainLocations } from "./locations";

export const config = {
  productName: managementProduct.name,
  wordmark: "AkiPasa",
  handle: "akipasa",
  domain: "akipasa.com",
  siteUrl: roleOrigin(
    process.env.NEXT_PUBLIC_SITE_URL,
    "https://akibusiness.com",
    managementProduct.origin,
  ),
  consumerUrl: "https://akipasa.com",
  crmUrl: roleOrigin(
    process.env.NEXT_PUBLIC_CRM_URL || process.env.NEXT_PUBLIC_AKIHQ_URL,
    "https://akihq.app",
    operationsProduct.origin,
  ),
  businessUrl: roleOrigin(
    process.env.NEXT_PUBLIC_BUSINESS_URL,
    "https://akibusiness.com",
    managementProduct.origin,
  ),
  tagline: { es: "Sal. Explora. Disfruta.", en: "Go out. Explore. Enjoy." },
  dataProvider: process.env.NEXT_PUBLIC_DATA_PROVIDER || "fixtures",
  mapStyleUrl:
    process.env.NEXT_PUBLIC_MAP_STYLE_URL ||
    "https://tiles.openfreemap.org/styles/liberty",
  googleAuthEnabled: process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true",
  currentTermsVersion: "2026-07-23",
  defaultLocale: "es" as const,
  locales: ["es", "en"] as const,
  timeZone: "Europe/Madrid",
  localities: spainLocations,
};

export type Locale = (typeof config.locales)[number];
export function isLocale(value: string): value is Locale {
  return config.locales.includes(value as Locale);
}
