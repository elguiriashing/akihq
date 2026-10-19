import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(12)
  .max(128)
  .regex(/[a-z]/)
  .regex(/[A-Z]/)
  .regex(/[0-9]/);

export const safeExternalUrlSchema = z.union([
  z.literal(""),
  z
    .string()
    .url()
    .refine((value) => new URL(value).protocol === "https:"),
]);

export function safeAuthDestination(locale: "es" | "en", requested?: string) {
  return safeAuthDestinationForOrigin(
    locale,
    requested,
    "https://akibusiness.com",
  );
}

export function safeAuthDestinationForOrigin(
  locale: "es" | "en",
  requested: string | undefined,
  _origin: string,
) {
  void _origin;
  const fallback = `/${locale}/business`;
  if (
    !requested?.startsWith("/") ||
    requested.startsWith("//") ||
    /[\\\r\n]/.test(requested)
  )
    return fallback;
  try {
    const parsed = new URL(requested, "https://akibusiness.com");
    if (
      parsed.origin !== "https://akibusiness.com" ||
      parsed.pathname.includes("%") ||
      !new RegExp(`^/${locale}/(?:business|auth/recover|terms)(?:/|$)`).test(
        parsed.pathname,
      )
    )
      return fallback;
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return fallback;
  }
}

export function taskFromAuthCallback(
  locale: "es" | "en",
  requested: string | undefined,
  origin: string,
) {
  const safe = safeAuthDestinationForOrigin(locale, requested, origin);
  const url = new URL(safe, origin);
  return /^\/(en|es)\/auth\/recover\/?$/.test(url.pathname)
    ? safeAuthDestinationForOrigin(
        locale,
        url.searchParams.get("next") || undefined,
        origin,
      )
    : safe;
}
