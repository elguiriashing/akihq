export const euAllergens = [
  ["gluten", "🌾", "Gluten", "Gluten"],
  ["crustaceans", "🦐", "Crustáceos", "Crustaceans"],
  ["eggs", "🥚", "Huevos", "Eggs"],
  ["fish", "🐟", "Pescado", "Fish"],
  ["peanuts", "🥜", "Cacahuetes", "Peanuts"],
  ["soy", "🫘", "Soja", "Soy"],
  ["milk", "🥛", "Leche", "Milk"],
  ["nuts", "🌰", "Frutos de cáscara", "Tree nuts"],
  ["celery", "🌿", "Apio", "Celery"],
  ["mustard", "🟡", "Mostaza", "Mustard"],
  ["sesame", "⚪", "Sésamo", "Sesame"],
  ["sulphites", "🍷", "Sulfitos", "Sulphites"],
  ["lupin", "🌼", "Altramuces", "Lupin"],
  ["molluscs", "🦪", "Moluscos", "Molluscs"],
] as const;

export type AllergenKey = (typeof euAllergens)[number][0];
export type AllergenState =
  | "unknown"
  | "contains"
  | "may_contain"
  | "not_in_recipe";

export const CATALOGUE_TRANSLATION_VERSION = 2;

export type CatalogueTranslationContext =
  | "general"
  | "section_title"
  | "item_name"
  | "item_description"
  | "variant_label"
  | "ingredients"
  | "notes";

export type CatalogueText = {
  es: string;
  en: string;
  _translation?: {
    version?: number;
    sourceLocale: "es" | "en";
    sourceHash: string;
    esHash?: string;
    enHash?: string;
  };
};
export type CatalogueLayout =
  | "menu"
  | "cards"
  | "services"
  | "rentals"
  | "experiences";
export type CatalogueItemKind =
  | "food"
  | "drink"
  | "product"
  | "service"
  | "rental"
  | "experience"
  | "ticket"
  | "package";

export type CatalogueItem = {
  id: string;
  name: CatalogueText;
  description: CatalogueText;
  kind: CatalogueItemKind;
  visible: boolean;
  mediaId?: string | null;
  containsFood: boolean;
  availability: "available" | "sold_out" | "seasonal" | "on_request";
  priceMode: "fixed" | "from" | "on_request";
  priceCents: number | null;
  unit:
    | "each"
    | "person"
    | "session"
    | "hour"
    | "day"
    | "night"
    | "month"
    | "kg";
  durationMinutes?: number | null;
  capacity?: number | null;
  variants: Array<{
    id: string;
    label: CatalogueText;
    priceCents: number;
    unit: CatalogueItem["unit"];
  }>;
  allergens: {
    states: Record<AllergenKey, AllergenState>;
    cereals: string[];
    nuts: string[];
    crossContact: "unknown" | "possible" | "assessed";
    ingredients: CatalogueText;
    notes: CatalogueText;
    reviewedAt?: string | null;
    reviewConfirmed?: boolean;
  };
};

export type VenueCatalogueDocument = {
  schemaVersion: "1";
  title: CatalogueText;
  description: CatalogueText;
  layout: CatalogueLayout;
  sections: Array<{
    id: string;
    title: CatalogueText;
    items: CatalogueItem[];
  }>;
};

export function catalogueTextHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function normalizedCataloguePhrase(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("en")
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ");
}

const enToEsCataloguePhrases = new Map<string, string>([
  ["menu & services", "Carta y servicios"],
  ["menu and services", "Carta y servicios"],
  ["burgers", "Hamburguesas"],
  ["burger", "Hamburguesa"],
  ["drinks", "Bebidas"],
  ["beverages", "Bebidas"],
  ["soft drinks", "Refrescos"],
  ["cocktails", "Cócteles"],
  ["wines", "Vinos"],
  ["wine", "Vino"],
  ["beers", "Cervezas"],
  ["beer", "Cerveza"],
  ["desserts", "Postres"],
  ["dessert", "Postre"],
  ["starters", "Entrantes"],
  ["appetizers", "Entrantes"],
  ["sides", "Guarniciones"],
  ["salads", "Ensaladas"],
  ["breakfast", "Desayunos"],
  ["breakfasts", "Desayunos"],
  ["shakes", "Batidos"],
  ["milkshakes", "Batidos"],
  ["nuts", "Frutos secos"],
  ["tree nuts", "Frutos de cáscara"],
  ["peanuts", "Cacahuetes"],
  ["almond", "Almendra"],
  ["almonds", "Almendras"],
  ["peanut", "Cacahuete"],
  ["cheeseburger", "Hamburguesa con queso"],
  ["chicken burger", "Hamburguesa de pollo"],
  ["beef burger", "Hamburguesa de ternera"],
  ["veggie burger", "Hamburguesa vegetal"],
  ["vegan burger", "Hamburguesa vegana"],
  ["fries", "Patatas fritas"],
  ["french fries", "Patatas fritas"],
  ["water", "Agua"],
  ["sparkling water", "Agua con gas"],
  ["still water", "Agua sin gas"],
  ["coffee", "Café"],
  ["tea", "Té"],
  ["orange juice", "Zumo de naranja"],
  ["apple juice", "Zumo de manzana"],
  ["lemonade", "Limonada"],
  ["cola", "Refresco de cola"],
  ["dry fruits and nuts", "Frutas deshidratadas y frutos secos"],
  ["dry fruit and nuts", "Fruta deshidratada y frutos secos"],
  ["dried fruits and nuts", "Frutas deshidratadas y frutos secos"],
  ["dried fruit and nuts", "Fruta deshidratada y frutos secos"],
  ["coke", "Coca-Cola"],
  ["coca cola", "Coca-Cola"],
  ["coca-cola", "Coca-Cola"],
  ["can of coke", "Lata de Coca-Cola"],
  ["a can of coke", "Una lata de Coca-Cola"],
  ["cold can of coke", "Lata fría de Coca-Cola"],
  ["a cold can of coke", "Una lata fría de Coca-Cola"],
  ["can of coca cola", "Lata de Coca-Cola"],
  ["a can of coca cola", "Una lata de Coca-Cola"],
  ["cold can of coca cola", "Lata fría de Coca-Cola"],
  ["a cold can of coca cola", "Una lata fría de Coca-Cola"],
  ["this is a nut", "Esto es un fruto seco"],
  ["contains nuts", "Contiene frutos secos"],
]);

const esToEnCataloguePhrases = new Map<string, string>([
  ["carta y servicios", "Menu & services"],
  ["hamburguesas", "Burgers"],
  ["hamburguesa", "Burger"],
  ["bebidas", "Drinks"],
  ["refrescos", "Soft drinks"],
  ["cócteles", "Cocktails"],
  ["vinos", "Wines"],
  ["vino", "Wine"],
  ["cervezas", "Beers"],
  ["cerveza", "Beer"],
  ["postres", "Desserts"],
  ["postre", "Dessert"],
  ["entrantes", "Starters"],
  ["guarniciones", "Sides"],
  ["ensaladas", "Salads"],
  ["desayunos", "Breakfast"],
  ["batidos", "Shakes"],
  ["frutos secos", "Nuts"],
  ["frutos de cáscara", "Tree nuts"],
  ["cacahuetes", "Peanuts"],
  ["almendra", "Almond"],
  ["almendras", "Almonds"],
  ["cacahuete", "Peanut"],
  ["hamburguesa con queso", "Cheeseburger"],
  ["hamburguesa de pollo", "Chicken burger"],
  ["hamburguesa de ternera", "Beef burger"],
  ["hamburguesa vegetal", "Veggie burger"],
  ["hamburguesa vegana", "Vegan burger"],
  ["patatas fritas", "Fries"],
  ["agua", "Water"],
  ["agua con gas", "Sparkling water"],
  ["agua sin gas", "Still water"],
  ["café", "Coffee"],
  ["té", "Tea"],
  ["zumo de naranja", "Orange juice"],
  ["zumo de manzana", "Apple juice"],
  ["limonada", "Lemonade"],
  ["refresco de cola", "Cola"],
  ["frutas deshidratadas y frutos secos", "Dried fruit and nuts"],
  ["fruta deshidratada y frutos secos", "Dried fruit and nuts"],
  ["lata de coca-cola", "Can of Coca-Cola"],
  ["una lata de coca-cola", "A can of Coca-Cola"],
  ["lata fría de coca-cola", "Cold can of Coca-Cola"],
  ["una lata fría de coca-cola", "A cold can of Coca-Cola"],
]);

export function deterministicCatalogueTranslation(
  sourceLocale: "es" | "en",
  targetLocale: "es" | "en",
  value: string,
  context: CatalogueTranslationContext = "general",
) {
  void context;
  if (sourceLocale === targetLocale) return null;
  const key = normalizedCataloguePhrase(value);
  return sourceLocale === "en" && targetLocale === "es"
    ? enToEsCataloguePhrases.get(key) || null
    : sourceLocale === "es" && targetLocale === "en"
      ? esToEnCataloguePhrases.get(key) || null
      : null;
}

export function polishCatalogueTranslation(
  sourceLocale: "es" | "en",
  targetLocale: "es" | "en",
  source: string,
  translated: string,
  context: CatalogueTranslationContext = "general",
) {
  const deterministic = deterministicCatalogueTranslation(
    sourceLocale,
    targetLocale,
    source,
    context,
  );
  if (deterministic) return deterministic;

  let result = translated.trim();
  if (sourceLocale === "en" && targetLocale === "es") {
    const sourceKey = normalizedCataloguePhrase(source);

    if (/\bnuts?\b/.test(sourceKey)) {
      result = result
        .replace(/\buna tuerca\b/gi, "un fruto seco")
        .replace(/\btuercas\b/gi, "frutos secos")
        .replace(/\btuerca\b/gi, "fruto seco")
        .replace(/\bnueces\b/gi, "frutos secos")
        .replace(/\bnuez\b/gi, "fruto seco");
    }
    if (/\b(?:dry|dried) fruits?\b/.test(sourceKey)) {
      result = result.replace(/\bfrutas? secas?\b/gi, (match) =>
        match.toLocaleLowerCase("es").startsWith("fruta ")
          ? "fruta deshidratada"
          : "frutas deshidratadas",
      );
    }
    if (/\b(?:coke|coca[ -]?cola)\b/.test(sourceKey)) {
      result = result
        .replace(/\bcoque\b/gi, "Coca-Cola")
        .replace(/\bcoca cola\b/gi, "Coca-Cola");
      if (/\bcan of (?:coke|coca[ -]?cola)\b/.test(sourceKey)) {
        result = result
          .replace(/\bpuede de Coca-Cola\b/gi, "lata de Coca-Cola")
          .replace(/\bpuede de cola\b/gi, "lata de Coca-Cola");
      }
    }
  }

  return result;
}

export function catalogueTextForDisplay(
  value: CatalogueText,
  locale: "es" | "en",
  context: CatalogueTranslationContext = "general",
) {
  const raw = value[locale].trim() || value.es.trim() || value.en.trim();
  const sourceLocale = value._translation?.sourceLocale;
  if (!sourceLocale) return raw;

  const source = value[sourceLocale].trim();
  if (!source) return raw;

  // Menu item names behave like product names. Translating them turned
  // "Wonder Burger" into "Maravilla Burger", which is technically language
  // conversion and practically vandalism.
  if (context === "item_name") {
    if (sourceLocale === locale) return source;
    return (
      deterministicCatalogueTranslation(
        sourceLocale,
        locale,
        source,
        context,
      ) || source
    );
  }

  if (sourceLocale === locale) return source;
  return polishCatalogueTranslation(sourceLocale, locale, source, raw, context);
}

function seedTextTranslationMetadata(
  pair: CatalogueText,
  preferredLocale: "es" | "en",
) {
  const esValue = pair.es.trim();
  const enValue = pair.en.trim();

  // Exact bilingual copies are commonly the non-blocking fallback from a
  // translator outage. Do not certify them as translated or catalogue saves
  // will never retry them. Proper nouns may be retried, which is harmless.
  if (esValue && esValue === enValue) {
    if (pair._translation?.version === CATALOGUE_TRANSLATION_VERSION) return;
    delete pair._translation;
    return;
  }

  if (pair._translation?.esHash && pair._translation?.enHash) return;
  const sourceLocale =
    pair[preferredLocale].trim() ||
    !pair[preferredLocale === "es" ? "en" : "es"].trim()
      ? preferredLocale
      : preferredLocale === "es"
        ? "en"
        : "es";
  const source = pair[sourceLocale].trim();
  pair._translation = {
    sourceLocale,
    sourceHash: catalogueTextHash(source),
    esHash: catalogueTextHash(pair.es.trim()),
    enHash: catalogueTextHash(pair.en.trim()),
  };
}

export function seedCatalogueTranslationMetadata(
  input: VenueCatalogueDocument,
  preferredLocale: "es" | "en",
): VenueCatalogueDocument {
  const document = JSON.parse(JSON.stringify(input)) as VenueCatalogueDocument;
  seedTextTranslationMetadata(document.title, preferredLocale);
  seedTextTranslationMetadata(document.description, preferredLocale);

  for (const section of document.sections) {
    seedTextTranslationMetadata(section.title, preferredLocale);
    for (const item of section.items) {
      seedTextTranslationMetadata(item.name, preferredLocale);
      seedTextTranslationMetadata(item.description, preferredLocale);
      for (const variant of item.variants) {
        seedTextTranslationMetadata(variant.label, preferredLocale);
      }
      seedTextTranslationMetadata(item.allergens.ingredients, preferredLocale);
      seedTextTranslationMetadata(item.allergens.notes, preferredLocale);
    }
  }

  return document;
}

export const defaultAllergenStates = Object.fromEntries(
  euAllergens.map(([key]) => [key, "unknown"]),
) as Record<AllergenKey, AllergenState>;

export function blankCatalogue(locale: "es" | "en"): VenueCatalogueDocument {
  const title =
    locale === "es"
      ? { es: "Carta y servicios", en: "Menu & services" }
      : { es: "Carta y servicios", en: "Menu & services" };
  return {
    schemaVersion: "1",
    title,
    description: { es: "", en: "" },
    layout: "menu",
    sections: [],
  };
}

export function blankCatalogueItem(): CatalogueItem {
  return {
    id: crypto.randomUUID(),
    // A newly added item must be saveable immediately, including as a draft.
    // The database requires a non-empty localized name for every item.
    name: { es: "Nuevo elemento", en: "New item" },
    description: { es: "", en: "" },
    kind: "product",
    // The existing editor toggle explicitly opts finished items into publication.
    // Keep starter labels saveable without leaking them when other edits publish.
    visible: false,
    mediaId: null,
    containsFood: false,
    availability: "available",
    priceMode: "fixed",
    priceCents: 0,
    unit: "each",
    variants: [],
    allergens: {
      states: { ...defaultAllergenStates },
      cereals: [],
      nuts: [],
      crossContact: "unknown",
      ingredients: { es: "", en: "" },
      notes: { es: "", en: "" },
      reviewedAt: null,
      reviewConfirmed: false,
    },
  };
}

export function parseCatalogueDocument(
  value: unknown,
  locale: "es" | "en",
): VenueCatalogueDocument {
  if (!value || typeof value !== "object") return blankCatalogue(locale);
  const candidate = value as Partial<VenueCatalogueDocument>;
  if (
    candidate.schemaVersion !== "1" ||
    !Array.isArray(candidate.sections) ||
    !candidate.title ||
    !candidate.description
  )
    return blankCatalogue(locale);

  const document = candidate as VenueCatalogueDocument;
  return {
    ...document,
    sections: document.sections.map((section) => ({
      ...section,
      items: section.items.map((item) => ({
        ...item,
        allergens: {
          ...item.allergens,
          reviewConfirmed:
            Boolean(item.allergens.reviewConfirmed) ||
            Boolean(item.allergens.reviewedAt),
        },
      })),
    })),
  };
}
