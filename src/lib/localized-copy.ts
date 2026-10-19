import "server-only";

import type { Locale } from "@/lib/config";
import {
  CATALOGUE_TRANSLATION_VERSION,
  catalogueTextHash,
  deterministicCatalogueTranslation,
  polishCatalogueTranslation,
  type CatalogueText,
  type CatalogueTranslationContext,
  type VenueCatalogueDocument,
} from "@/lib/venue-catalogue";

type LocalizedPair = { es: string; en: string };

type LibreTranslateResponse = {
  translatedText?: string | string[];
  error?: string;
};

function translationEndpoints() {
  const configured = process.env.AKIPASA_TRANSLATION_URL?.trim();
  const publicMirrors = [
    "https://translate.terraprint.co/translate",
    "https://translate.foxhaven.cyou/translate",
    "https://trans.zillyhuhn.com/translate",
    "https://lt.psf.lt/translate",
    "https://translate.argosopentech.com/translate",
  ];
  return { configured, publicMirrors };
}

async function translateOneAtEndpoint(
  endpoint: string,
  sourceLocale: Locale,
  targetLocale: Locale,
  value: string,
): Promise<string> {
  const body = new URLSearchParams({
    q: value,
    source: sourceLocale,
    target: targetLocale,
    format: "text",
  });
  const apiKey = process.env.AKIPASA_TRANSLATION_API_KEY?.trim();
  if (apiKey) body.set("api_key", apiKey);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(5_000),
  });

  const result = (await response
    .json()
    .catch(() => ({}))) as LibreTranslateResponse;
  if (!response.ok) {
    throw new Error(
      result.error || `LibreTranslate request failed (${response.status})`,
    );
  }

  const translated = Array.isArray(result.translatedText)
    ? result.translatedText[0]
    : result.translatedText;

  if (typeof translated !== "string" || !translated.trim()) {
    throw new Error("LibreTranslate returned an unexpected response");
  }

  return translated.trim();
}

async function translateValuesAtEndpoint(
  endpoint: string,
  sourceLocale: Locale,
  targetLocale: Locale,
  values: string[],
): Promise<string[]> {
  const translated: string[] = [];
  const concurrency = 4;

  for (let index = 0; index < values.length; index += concurrency) {
    const chunk = values.slice(index, index + concurrency);
    translated.push(
      ...(await Promise.all(
        chunk.map((value) =>
          translateOneAtEndpoint(endpoint, sourceLocale, targetLocale, value),
        ),
      )),
    );
  }

  return translated;
}

type ApertiumResponse = {
  responseStatus?: number;
  responseData?: { translatedText?: string };
  responseDetails?: string | null;
};

async function translateOneWithApertium(
  sourceLocale: Locale,
  targetLocale: Locale,
  value: string,
): Promise<string> {
  const languageCode = (locale: Locale) => (locale === "en" ? "eng" : "spa");
  const body = new URLSearchParams({
    q: value,
    langpair: `${languageCode(sourceLocale)}|${languageCode(targetLocale)}`,
    markUnknown: "no",
    format: "txt",
  });
  const response = await fetch("https://apertium.org/apy/translate", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(8_000),
  });
  const result = (await response.json().catch(() => ({}))) as ApertiumResponse;
  const translated = result.responseData?.translatedText;
  if (
    !response.ok ||
    result.responseStatus !== 200 ||
    typeof translated !== "string" ||
    !translated.trim()
  ) {
    throw new Error(result.responseDetails || "Apertium translation failed");
  }
  return translated.trim();
}

async function apertiumTranslateBatch(
  sourceLocale: Locale,
  targetLocale: Locale,
  values: string[],
): Promise<string[]> {
  const translated: string[] = [];
  const concurrency = 4;
  for (let index = 0; index < values.length; index += concurrency) {
    const chunk = values.slice(index, index + concurrency);
    translated.push(
      ...(await Promise.all(
        chunk.map((value) =>
          translateOneWithApertium(sourceLocale, targetLocale, value),
        ),
      )),
    );
  }
  return translated;
}

async function libreTranslateBatch(
  sourceLocale: Locale,
  targetLocale: Locale,
  values: string[],
): Promise<string[]> {
  if (!values.length) return [];

  const { configured, publicMirrors } = translationEndpoints();
  let lastError = "No translation endpoint responded";

  if (configured) {
    try {
      return await translateValuesAtEndpoint(
        configured,
        sourceLocale,
        targetLocale,
        values,
      );
    } catch (error) {
      lastError =
        error instanceof Error ? error.message : "translation_request_failed";
    }
  }

  // LibreTranslate/Argos handles conversational menu copy better than
  // Apertium's word-by-word fallbacks ("nuts" -> hardware nuts, "can" -> verb).
  // Keep Apertium as the last open-source fallback rather than the first choice.
  for (const endpoint of publicMirrors) {
    if (endpoint === configured) continue;
    try {
      return await translateValuesAtEndpoint(
        endpoint,
        sourceLocale,
        targetLocale,
        values,
      );
    } catch (error) {
      lastError =
        error instanceof Error ? error.message : "translation_request_failed";
    }
  }

  try {
    return await apertiumTranslateBatch(sourceLocale, targetLocale, values);
  } catch (error) {
    lastError =
      error instanceof Error ? error.message : "translation_request_failed";
  }

  throw new Error(lastError);
}

export async function translateLocalizedFields(
  sourceLocale: Locale,
  fields: Record<string, string>,
  actorId: string,
): Promise<Record<string, LocalizedPair>> {
  void actorId;
  const entries: Array<[string, string]> = Object.entries(fields).map(
    ([key, value]) => [key, value.trim()],
  );
  const nonEmptyEntries = entries.filter(([, value]) => value.length > 0);
  const emptyKeys = entries
    .filter(([, value]) => value.length === 0)
    .map(([key]) => key);

  if (nonEmptyEntries.length === 0) {
    return Object.fromEntries(
      entries.map(([key]) => [key, { es: "", en: "" }]),
    );
  }

  const targetLocale: Locale = sourceLocale === "es" ? "en" : "es";
  let translatedValues: string[];

  try {
    translatedValues = await libreTranslateBatch(
      sourceLocale,
      targetLocale,
      nonEmptyEntries.map(([, value]) => value),
    );
  } catch (error) {
    console.error("AkiPasa translation unavailable; preserving source copy", {
      sourceLocale,
      targetLocale,
      fieldCount: nonEmptyEntries.length,
      error: error instanceof Error ? error.message : "unknown_error",
    });

    // Translation should improve the experience, never block a business owner
    // from saving. If the open-source service is unavailable, keep the source
    // text in both locales so the listing remains usable and editable.
    translatedValues = nonEmptyEntries.map(([, value]) => value);
  }

  const translated: Record<string, LocalizedPair> = {};
  nonEmptyEntries.forEach(([key, source], index) => {
    const target = translatedValues[index]?.trim() || source;
    translated[key] =
      sourceLocale === "es"
        ? { es: source, en: target }
        : { es: target, en: source };
  });

  for (const key of emptyKeys) translated[key] = { es: "", en: "" };
  return translated;
}

export async function translateSubmittedLocalizedFields(
  sourceLocale: Locale,
  fields: Record<string, string>,
  actorId: string,
  current: Record<string, LocalizedPair | null | undefined> = {},
): Promise<Record<string, LocalizedPair>> {
  const targetLocale: Locale = sourceLocale === "es" ? "en" : "es";
  const keep: Record<string, LocalizedPair> = {};
  const translateFromSource: Record<string, string> = {};
  const translateFromFallback: Record<string, string> = {};

  for (const [key, rawValue] of Object.entries(fields)) {
    const value = rawValue.trim();
    const existing = current[key];
    if (!existing) {
      translateFromSource[key] = value;
      continue;
    }

    const existingSource = existing[sourceLocale]?.trim() || "";
    const existingFallback = existing[targetLocale]?.trim() || "";
    const displayedValue = existingSource || existingFallback;

    if (value !== displayedValue) {
      translateFromSource[key] = value;
      continue;
    }

    if (existingSource) {
      if (existingFallback && existingFallback === existingSource) {
        // A previous translator outage may have copied the source into both
        // locales. Retry it instead of treating that fallback as translated.
        translateFromSource[key] = value;
      } else {
        keep[key] = {
          es: existing.es || "",
          en: existing.en || "",
        };
      }
      continue;
    }

    if (existingFallback) {
      translateFromFallback[key] = existingFallback;
      continue;
    }

    translateFromSource[key] = value;
  }

  const [fromSource, fromFallback] = await Promise.all([
    Object.keys(translateFromSource).length
      ? translateLocalizedFields(sourceLocale, translateFromSource, actorId)
      : Promise.resolve({} as Record<string, LocalizedPair>),
    Object.keys(translateFromFallback).length
      ? translateLocalizedFields(targetLocale, translateFromFallback, actorId)
      : Promise.resolve({} as Record<string, LocalizedPair>),
  ]);

  for (const [key, pair] of Object.entries(fromSource)) {
    const existingTarget = current[key]?.[targetLocale]?.trim();
    if (
      pair[sourceLocale].trim() === pair[targetLocale].trim() &&
      existingTarget &&
      existingTarget !== pair[sourceLocale].trim()
    ) {
      // If every translator is temporarily down, do not destroy a previously
      // valid translated copy just because the source language was edited.
      pair[targetLocale] = existingTarget;
    }
  }

  return {
    ...keep,
    ...fromSource,
    ...fromFallback,
  };
}

type CatalogueTranslationTarget = {
  pair: CatalogueText;
  maxLength: number;
  context: CatalogueTranslationContext;
  sourceLocale: Locale;
  targetLocale: Locale;
  source: string;
  hash: string;
};

function clampTranslatedValue(value: string, maxLength: number) {
  const clean = value.trim();
  if (clean.length <= maxLength) return clean;
  const clipped = clean.slice(0, maxLength);
  const lastSpace = clipped.lastIndexOf(" ");
  return (
    lastSpace > maxLength * 0.7 ? clipped.slice(0, lastSpace) : clipped
  ).trimEnd();
}

export async function translateVenueCatalogueDocument(
  sourceLocale: Locale,
  input: VenueCatalogueDocument,
  actorId: string,
): Promise<VenueCatalogueDocument> {
  const document = JSON.parse(JSON.stringify(input)) as VenueCatalogueDocument;
  const requestedTargetLocale: Locale = sourceLocale === "es" ? "en" : "es";
  const pending: CatalogueTranslationTarget[] = [];

  const markTranslated = (
    pair: CatalogueText,
    actualSourceLocale: Locale,
    source: string,
  ) => {
    pair._translation = {
      version: CATALOGUE_TRANSLATION_VERSION,
      sourceLocale: actualSourceLocale,
      sourceHash: catalogueTextHash(source),
      esHash: catalogueTextHash(pair.es.trim()),
      enHash: catalogueTextHash(pair.en.trim()),
    };
  };

  const register = (
    pair: CatalogueText,
    maxLength: number,
    context: CatalogueTranslationContext,
    preserveSource = false,
  ) => {
    const requestedSource = pair[sourceLocale].trim();
    const fallbackSource = pair[requestedTargetLocale].trim();
    const requestedHash = catalogueTextHash(requestedSource);

    if (
      !preserveSource &&
      requestedSource &&
      pair[requestedTargetLocale].trim() &&
      pair._translation?.version === CATALOGUE_TRANSLATION_VERSION &&
      pair._translation?.[`${sourceLocale}Hash`] === requestedHash
    ) {
      return;
    }

    // Old generated catalogues already know which language was genuinely
    // authored. Keep that provenance while upgrading translation quality,
    // even if the owner happens to save from the opposite locale.
    const provenanceLocale = pair._translation?.sourceLocale;
    const actualSourceLocale: Locale =
      provenanceLocale && pair[provenanceLocale].trim()
        ? provenanceLocale
        : requestedSource
          ? sourceLocale
          : fallbackSource
            ? requestedTargetLocale
            : sourceLocale;
    const actualTargetLocale: Locale =
      actualSourceLocale === "es" ? "en" : "es";
    const source = pair[actualSourceLocale].trim();
    const hash = catalogueTextHash(source);

    if (!source) {
      pair.es = "";
      pair.en = "";
      markTranslated(pair, actualSourceLocale, "");
      return;
    }

    const deterministic = deterministicCatalogueTranslation(
      actualSourceLocale,
      actualTargetLocale,
      source,
      context,
    );
    if (deterministic) {
      pair[actualSourceLocale] = source;
      pair[actualTargetLocale] = clampTranslatedValue(deterministic, maxLength);
      markTranslated(pair, actualSourceLocale, source);
      return;
    }

    // Product/dish names are identity, not prose. Translate known generic menu
    // terms above, but preserve unknown names such as "Wonder Burger".
    if (preserveSource) {
      pair[actualSourceLocale] = source;
      pair[actualTargetLocale] = source;
      markTranslated(pair, actualSourceLocale, source);
      return;
    }

    if (
      pair._translation?.version === CATALOGUE_TRANSLATION_VERSION &&
      pair._translation.sourceLocale === actualSourceLocale &&
      pair._translation.sourceHash === hash &&
      pair[actualTargetLocale].trim()
    ) {
      markTranslated(pair, actualSourceLocale, source);
      return;
    }

    pending.push({
      pair,
      maxLength,
      context,
      sourceLocale: actualSourceLocale,
      targetLocale: actualTargetLocale,
      source,
      hash,
    });
  };

  register(document.title, 160, "general");
  register(document.description, 1200, "general");

  for (const section of document.sections) {
    register(section.title, 160, "section_title");
    for (const item of section.items) {
      register(item.name, 160, "item_name", true);
      register(item.description, 1200, "item_description");
      for (const variant of item.variants) {
        register(variant.label, 100, "variant_label");
      }
      register(item.allergens.ingredients, 1200, "ingredients");
      register(item.allergens.notes, 600, "notes");
    }
  }

  const translateBatch = async (batch: CatalogueTranslationTarget[]) => {
    if (!batch.length) return;
    const batchSourceLocale = batch[0].sourceLocale;
    if (batch.some((target) => target.sourceLocale !== batchSourceLocale)) {
      throw new Error("Mixed source locales in catalogue translation batch");
    }

    const fields = Object.fromEntries(
      batch.map((target, index) => [`field_${index}`, target.source]),
    );

    try {
      const translated = await translateLocalizedFields(
        batchSourceLocale,
        fields,
        actorId,
      );
      batch.forEach((target, index) => {
        const result = translated[`field_${index}`];
        const translatedValue = result?.[target.targetLocale];
        if (!translatedValue) {
          throw new Error(`Missing catalogue translation field_${index}`);
        }

        const polished = polishCatalogueTranslation(
          target.sourceLocale,
          target.targetLocale,
          target.source,
          translatedValue,
          target.context,
        );

        target.pair[target.sourceLocale] = target.source;
        target.pair[target.targetLocale] = clampTranslatedValue(
          polished,
          target.maxLength,
        );

        if (target.pair[target.targetLocale].trim()) {
          markTranslated(target.pair, target.sourceLocale, target.source);
        }
      });
    } catch (error) {
      if (batch.length === 1) throw error;
      const midpoint = Math.ceil(batch.length / 2);
      await translateBatch(batch.slice(0, midpoint));
      await translateBatch(batch.slice(midpoint));
    }
  };

  const translatePendingLocale = async (batchSourceLocale: Locale) => {
    let batch: CatalogueTranslationTarget[] = [];
    let batchCharacters = 0;
    for (const target of pending.filter(
      (item) => item.sourceLocale === batchSourceLocale,
    )) {
      const wouldOverflow =
        batch.length >= 24 || batchCharacters + target.source.length > 8500;
      if (wouldOverflow) {
        await translateBatch(batch);
        batch = [];
        batchCharacters = 0;
      }
      batch.push(target);
      batchCharacters += target.source.length;
    }
    await translateBatch(batch);
  };

  await translatePendingLocale("es");
  await translatePendingLocale("en");

  return document;
}
