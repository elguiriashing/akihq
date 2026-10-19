import type { StayLocale } from "./akiduermo-i18n";
export const stayOrigin = "https://akiduermo.com";
export const stayMemberPaths = [
  "/map",
  "/saved",
  "/account",
  "/bookings",
  "/settings",
];
export function safeStayDestination(requested?: string) {
  if (!requested || requested.startsWith("//") || /[\\\r\n]/.test(requested))
    return "/account";
  try {
    const url = new URL(requested, stayOrigin);
    if (url.origin !== stayOrigin) return "/account";
    if (
      stayMemberPaths.includes(url.pathname) ||
      /^\/stays\/[^/]+\/?$/.test(url.pathname) ||
      /^\/(en|es)\/auth\/recover\/?$/.test(url.pathname)
    )
      return `${url.pathname}${url.search}`;
  } catch {}
  return "/account";
}
export function stayHref(slug: string, locale: StayLocale) {
  return `${stayOrigin}/stays/${encodeURIComponent(slug)}?lang=${locale}`;
}
export function stayHostRoute(pathname: string) {
  if (/^\/(?:en|es)\/duermo\/memberships\/?$/.test(pathname))
    return { kind: "public" as const, path: pathname };
  const legacy = pathname.match(/^\/(en|es)\/venues\/([^/]+)\/?$/);
  if (legacy)
    return {
      kind: "legacy" as const,
      path: `/stays/${legacy[2]}`,
      locale: legacy[1],
    };
  if (pathname === "/" || pathname === "/akiduermo")
    return { kind: "rewrite" as const, path: "/akiduermo" };
  if (/^\/stays\/[^/]+\/?$/.test(pathname))
    return { kind: "rewrite" as const, path: `/akiduermo${pathname}` };
  if (stayMemberPaths.includes(pathname))
    return { kind: "rewrite" as const, path: `/akiduermo${pathname}` };
  if (
    /^\/(en|es)\/auth(?:\/|$)/.test(pathname) ||
    /^\/(en|es)\/terms\/accept\/?$/.test(pathname)
  )
    return { kind: "public" as const, path: pathname };
  if (pathname.startsWith("/akiduermo/"))
    return {
      kind: "canonical" as const,
      path: pathname.slice("/akiduermo".length),
    };
  if (
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname === "/offline.html" ||
    pathname === "/api/stays" ||
    pathname === "/api/stays/bookings" ||
    pathname === "/api/stays/saved" ||
    pathname === "/api/v1/personalisation/consent" ||
    pathname.startsWith("/api/map/") ||
    pathname.startsWith("/_next/")
  )
    return { kind: "public" as const, path: pathname };
  if (pathname.startsWith("/api/"))
    return { kind: "reject" as const, path: pathname };
  return { kind: "primary" as const, path: pathname };
}

export function stayHostMethodAllowed(pathname: string, method: string) {
  return (
    ["GET", "HEAD"].includes(method) ||
    ((pathname === "/api/stays/bookings" || pathname === "/api/stays/saved") &&
      method === "POST") ||
    (pathname === "/api/v1/personalisation/consent" && method === "POST") ||
    (method === "POST" &&
      (/^\/(en|es)\/auth(?:\/|$)/.test(pathname) ||
        /^\/(en|es)\/terms\/accept\/?$/.test(pathname) ||
        ["/account", "/bookings", "/settings"].includes(pathname)))
  );
}
