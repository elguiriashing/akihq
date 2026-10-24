import { stripCrossProductCredentials } from "./cross-product-query";

/** Only inspected, non-authentication context may leave this product origin. */
export function scrubBusinessHandoffQuery(query: URLSearchParams) {
  const inspected = new URL("https://akipasa.com");
  inspected.search = query.toString();
  stripCrossProductCredentials(inspected);
  const remaining = [...inspected.searchParams];
  for (const key of [...query.keys()]) query.delete(key);
  for (const [key, value] of remaining) query.append(key, value);
}

/** Product boundary applies on canonical, localhost and preview hosts alike. */
export function businessRoute(path: string, method = "GET") {
  if (path === "/" || path === "/login")
    return { kind: "local", path } as const;
  if (/^\/(en|es)\/?$/.test(path))
    return {
      kind: "redirect",
      path: `${path.replace(/\/$/, "")}/business`,
    } as const;
  if (/^\/(en|es)\/(membership|memberships)(?:\/|$)/.test(path))
    return { kind: "local", path } as const;
  if (/^\/(en|es)\/account(?:\/|$)/.test(path))
    return { kind: "local", path } as const;
  if (/^\/(en|es)\/(business|auth|terms|privacy)(?:\/|$)/.test(path))
    return { kind: "local", path } as const;
  const apis = [
    "/api/business/",
    "/api/locations/search",
    "/api/search/venues",
    "/api/support-agent/chat",
    "/api/analytics",
    "/api/v1/personalisation/consent",
    "/api/v1/behaviour/events",
    "/api/health",
  ];
  if (path.startsWith("/api/"))
    return {
      kind: apis.some((api) =>
        api.endsWith("/") ? path.startsWith(api) : path === api,
      )
        ? "local"
        : "reject",
      path,
    } as const;
  if (
    [
      "/robots.txt",
      "/manifest.webmanifest",
      "/sw.js",
      "/offline.html",
      "/pwa-icon.svg",
    ].includes(path)
  )
    return { kind: "local", path } as const;
  return {
    kind: method === "GET" || method === "HEAD" ? "primary" : "reject",
    path,
  } as const;
}
