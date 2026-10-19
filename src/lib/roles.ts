export const appRoles = [
  "consumer",
  "organiser",
  "moderator",
  "administrator",
] as const;

export type AppRole = (typeof appRoles)[number];

export function roleLabel(role: string, locale: "es" | "en") {
  const labels = {
    consumer: { es: "Usuario", en: "User" },
    organiser: { es: "Negocio", en: "Business" },
    moderator: { es: "Equipo", en: "Staff" },
    administrator: { es: "Administrador", en: "Administrator" },
  } as const;
  return labels[role as AppRole]?.[locale] ?? labels.consumer[locale];
}

export function canModerate(role: string) {
  return role === "moderator" || role === "administrator";
}

export function isAdministrator(role: string) {
  return role === "administrator";
}

export function roleCapabilities(role: string) {
  return {
    useConsumerFeatures: appRoles.includes(role as AppRole),
    manageOwnedVenues: role === "organiser" || role === "administrator",
    moderatePlatform: canModerate(role),
    administerPlatform: isAdministrator(role),
  };
}
