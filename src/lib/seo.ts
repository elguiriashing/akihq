import type { Metadata } from "next";
import { config, type Locale } from "./config";

// Always advertise the public canonical host, including from preview deployments.
export const siteOrigin = "https://akipasa.com";
export const publicPagePaths = [
  "",
  "/map",
  "/membership",
  "/passports",
  "/privacy",
  "/terms",
] as const;

export function languageUrls(path: string) {
  return {
    es: `${siteOrigin}/es${path}`,
    en: `${siteOrigin}/en${path}`,
    "x-default": `${siteOrigin}/es${path}`,
  };
}

export function localizedMetadata(
  locale: Locale,
  path: string,
  title: string,
  description: string,
): Metadata {
  const languages = languageUrls(path);
  const summary = description.replace(/\s+/g, " ").trim().slice(0, 180);
  return {
    title,
    description: summary,
    alternates: { canonical: languages[locale], languages },
    openGraph: {
      type: "website",
      siteName: config.productName,
      url: languages[locale],
      title,
      description: summary,
      locale: locale === "es" ? "es_ES" : "en_GB",
      alternateLocale: locale === "es" ? "en_GB" : "es_ES",
    },
    twitter: { card: "summary", title, description: summary },
  };
}

export function shouldNoindex(pathname: string) {
  return (
    /^\/pals(?:\/|$)/.test(pathname) ||
    /^\/api(?:\/|$)/.test(pathname) ||
    /^\/(es|en)\/(account|admin|staff|owner|business|moderation|auth|community|check-in)(?:\/|$)/.test(
      pathname,
    ) ||
    /^\/(es|en)\/terms\/accept(?:\/|$)/.test(pathname)
  );
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
