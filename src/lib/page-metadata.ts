import { notFound } from "next/navigation";
import { isLocale } from "./config";
import { localizedMetadata, type publicPagePaths } from "./seo";

const copy = {
  "": {
    es: [
      "Descubre eventos cercanos",
      "Descubre eventos, locales y planes en toda España. Encuentra qué hacer cerca de ti con AkiPasa.",
    ],
    en: [
      "Discover nearby events",
      "Discover events, venues and things to do across Spain. Find your next local plan with AkiPasa.",
    ],
  },
  "/map": {
    es: [
      "Mapa de eventos y locales",
      "Explora el mapa de AkiPasa y encuentra eventos y locales cerca de ti en España.",
    ],
    en: [
      "Map of events and venues",
      "Explore the AkiPasa map to find nearby events and venues across Spain.",
    ],
  },
  "/membership": {
    es: [
      "Planes y membresías",
      "Compara los planes personales y de negocio de AkiPasa para explorar, publicar y gestionar tu negocio.",
    ],
    en: [
      "Plans and memberships",
      "Compare AkiPasa personal and business plans for local discovery, publishing and managing your business.",
    ],
  },
  "/passports": {
    es: [
      "Pasaportes y recompensas",
      "Explora los pasaportes locales, sellos y recompensas disponibles en AkiPasa.",
    ],
    en: [
      "Passports and rewards",
      "Explore local passports, stamp cards and rewards available on AkiPasa.",
    ],
  },
  "/privacy": {
    es: [
      "Privacidad",
      "Consulta cómo AkiPasa trata tus datos y cómo gestionar tu privacidad.",
    ],
    en: [
      "Privacy",
      "Learn how AkiPasa handles your data and how to manage your privacy.",
    ],
  },
  "/terms": {
    es: [
      "Condiciones de uso",
      "Consulta las condiciones de uso de AkiPasa para contenido, reservas y recompensas.",
    ],
    en: [
      "Terms of use",
      "Read the AkiPasa terms of use for content, bookings and rewards.",
    ],
  },
} as const;

export function publicPageMetadata(path: (typeof publicPagePaths)[number]) {
  return async ({ params }: { params: Promise<{ locale: string }> }) => {
    const { locale } = await params;
    if (!isLocale(locale)) notFound();
    const [title, description] = copy[path][locale];
    return localizedMetadata(locale, path, title, description);
  };
}
