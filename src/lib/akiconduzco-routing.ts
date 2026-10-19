export const conduzcoOrigin = "https://akicoches.com";
export const conduzcoMemberPaths = ["/map", "/account", "/bookings"];

export function safeConduzcoDestination(requested?: string) {
  if (!requested || requested.startsWith("//") || /[\\\r\n]/.test(requested))
    return "/account";
  try {
    const url = new URL(requested, conduzcoOrigin);
    if (url.origin !== conduzcoOrigin) return "/account";
    if (
      conduzcoMemberPaths.includes(url.pathname) ||
      /^\/rentals\/[a-z0-9-]+\/?$/.test(url.pathname) ||
      /^\/(en|es)\/auth\/recover\/?$/.test(url.pathname)
    )
      return `${url.pathname}${url.search}`;
  } catch {}
  return "/account";
}

export function conduzcoHostRoute(pathname: string) {
  if (pathname === "/" || pathname === "/akiconduzco")
    return { kind: "rewrite" as const, path: "/akiconduzco" };
  if (
    pathname === "/map" ||
    pathname === "/account" ||
    pathname === "/bookings" ||
    /^\/rentals\/[a-z0-9-]+\/?$/.test(pathname)
  )
    return { kind: "rewrite" as const, path: `/akiconduzco${pathname}` };
  if (pathname.startsWith("/akiconduzco/"))
    return {
      kind: "canonical" as const,
      path: pathname.slice("/akiconduzco".length),
    };
  if (
    /^\/(en|es)\/auth(?:\/|$)/.test(pathname) ||
    /^\/(en|es)\/terms\/accept\/?$/.test(pathname)
  )
    return { kind: "public" as const, path: pathname };
  if (
    [
      "/manifest.webmanifest",
      "/sw.js",
      "/offline.html",
      "/robots.txt",
      "/sitemap.xml",
    ].includes(pathname) ||
    pathname.startsWith("/sitemaps/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/pwa/") ||
    pathname.startsWith("/brand/") ||
    pathname === "/icon.svg" ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/api/car-rentals") ||
    pathname === "/api/bookings/release" ||
    pathname === "/api/v1/personalisation/consent"
  )
    return { kind: "public" as const, path: pathname };
  if (pathname.startsWith("/api/"))
    return { kind: "reject" as const, path: pathname };
  return { kind: "primary" as const, path: pathname };
}

export function conduzcoHostMethodAllowed(pathname: string, method: string) {
  return (
    ["GET", "HEAD"].includes(method) ||
    (method === "POST" &&
      (pathname === "/api/car-rentals/bookings" ||
        pathname === "/api/v1/personalisation/consent" ||
        /^\/(en|es)\/auth(?:\/|$)/.test(pathname) ||
        /^\/(en|es)\/terms\/accept\/?$/.test(pathname)))
  );
}
