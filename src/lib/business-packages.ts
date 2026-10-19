export const businessPackageTools = {
  business: [
    "crm",
    "employees",
    "dashboard",
    "tasks",
    "calendar",
    "sales",
    "knowledge",
  ],
  business_pro: [
    "crm",
    "crm-social",
    "employees",
    "dashboard",
    "tasks",
    "calendar",
    "sales",
    "knowledge",
    "inventory",
    "inbox",
    "pos",
    "collaboration",
  ],
} as const;

export type BusinessPlan = keyof typeof businessPackageTools;
export type BusinessTool = (typeof businessPackageTools)[BusinessPlan][number];

export const businessCategories = [
  {
    key: "food",
    en: "Food & hospitality",
    es: "Gastronomía y hostelería",
    focus: ["pos", "inventory", "sales"],
  },
  {
    key: "music",
    en: "Music & nightlife",
    es: "Música y ocio nocturno",
    focus: ["calendar", "employees", "collaboration"],
  },
  {
    key: "social",
    en: "Social venue",
    es: "Local social",
    focus: ["crm", "inbox", "calendar"],
  },
  {
    key: "workshop",
    en: "Classes & workshops",
    es: "Clases y talleres",
    focus: ["employees", "tasks", "knowledge"],
  },
  {
    key: "family",
    en: "Family activities",
    es: "Actividades familiares",
    focus: ["calendar", "knowledge", "inbox"],
  },
  {
    key: "sport",
    en: "Sport & fitness",
    es: "Deporte y fitness",
    focus: ["employees", "calendar", "sales"],
  },
] as const;

export function getBusinessPackageHighlights(
  category: (typeof businessCategories)[number],
  plan: BusinessPlan,
): BusinessTool[] {
  const included: readonly BusinessTool[] = businessPackageTools[plan];
  return [...new Set<BusinessTool>([...category.focus, ...included])]
    .filter((tool) => included.includes(tool))
    .slice(0, 3);
}

export const businessExtras = [
  {
    key: "extra_seat",
    en: "Extra dashboard seat",
    es: "Usuario adicional",
    price: "€0.99/month",
    priceEs: "0,99 €/mes",
  },
  {
    key: "integrations",
    en: "Integrations",
    es: "Integraciones",
    price: "€3.99/month",
    priceEs: "3,99 €/mes",
  },
  {
    key: "profile_boost",
    en: "Profile boost credit",
    es: "Crédito de impulso de perfil",
    price: "€15 each",
    priceEs: "15 € / unidad",
  },
] as const;

export const internalOnlyTools = [
  "sites",
  "analytics",
  "telegram",
  "marketing",
] as const;
