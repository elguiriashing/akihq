import type { Locale } from "./config";

const serviceLabels = new Map<string, Record<Locale, string>>([
  ["featured_listing", { en: "Featured event", es: "Evento destacado" }],
  [
    "social_campaign",
    { en: "Social media campaign", es: "Campaña en redes sociales" },
  ],
  [
    "content_package",
    { en: "VIP content package", es: "Paquete de contenido VIP" },
  ],
  ["other", { en: "Other / Custom", es: "Otro / Personalizado" }],
  // Read-only legacy aliases; these do not become accepted request values.
  ["featured_event", { en: "Featured event", es: "Evento destacado" }],
  ["sponsored_event", { en: "Sponsored event", es: "Evento patrocinado" }],
  ["sponsored_listing", { en: "Sponsored listing", es: "Local patrocinado" }],
]);

export const promotionStates = [
  "new",
  "contacted",
  "qualified",
  "won",
  "lost",
] as const;

const stateLabels = new Map<string, Record<Locale, string>>([
  ["new", { en: "New", es: "Nueva" }],
  ["contacted", { en: "Contacted", es: "Contactada" }],
  ["qualified", { en: "Qualified", es: "Cualificada" }],
  ["won", { en: "Won", es: "Ganada" }],
  ["lost", { en: "Lost", es: "Perdida" }],
]);

// Display only: callers keep original machine values and their unknown-value fallback.
export function promotionServiceLabel(
  value: string,
  locale: Locale,
  fallback = value,
) {
  return serviceLabels.get(value)?.[locale] ?? fallback;
}

export function promotionStateLabel(
  value: string,
  locale: Locale,
  fallback = value,
) {
  return stateLabels.get(value)?.[locale] ?? fallback;
}
