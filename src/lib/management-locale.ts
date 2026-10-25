/** Shared language resolution for root marketing, login and request chrome. */
export function managementLocale(
  path: string,
  query: { lang?: unknown; locale?: unknown },
): "en" | "es" {
  const segment = path.match(/^\/(en|es)(?=\/|$)/)?.[1];
  if (segment === "en" || segment === "es") return segment;
  if (query.lang === "en" || query.lang === "es") return query.lang;
  return query.locale === "es" ? "es" : "en";
}
