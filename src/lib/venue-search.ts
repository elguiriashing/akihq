export type VenueSearchResult = {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  locality?: string | null;
  discovery_vertical?: string;
};

const searchStopWords = new Set([
  "a",
  "al",
  "and",
  "at",
  "de",
  "del",
  "el",
  "en",
  "la",
  "las",
  "los",
  "of",
  "the",
  "y",
]);

export function normalizeVenueSearch(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 120);
}

export function escapeVenueSearchPattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

export function comparableVenueSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-ES")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function venueSearchTokens(query: string) {
  return comparableVenueSearch(query)
    .split(" ")
    .filter(
      (token) =>
        token.length >= 2 &&
        (!searchStopWords.has(token) || /^\d+$/.test(token)),
    );
}

function singleAccentVariants(value: string) {
  const variants = new Set([value]);
  const replacements: Record<string, string> = {
    a: "á",
    e: "é",
    i: "í",
    o: "ó",
    u: "ú",
    n: "ñ",
  };

  [...value].forEach((character, index) => {
    const replacement = replacements[character.toLocaleLowerCase("es-ES")];
    if (!replacement) return;
    const accented =
      character === character.toUpperCase()
        ? replacement.toUpperCase()
        : replacement;
    variants.add(value.slice(0, index) + accented + value.slice(index + 1));
  });

  return [...variants];
}

export function venueSearchProbes(query: string) {
  const normalized = normalizeVenueSearch(query);
  const segments = normalized
    .split(/[,;|]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
  const tokens = normalized
    .split(/[^\p{L}\p{N}]+/u)
    .map((part) => part.trim())
    .filter(
      (part) => part.length >= 3 && !searchStopWords.has(part.toLowerCase()),
    );

  const base = [...segments, ...tokens]
    .sort((a, b) => b.length - a.length)
    .slice(0, 6);

  const probes = new Set<string>(base);
  for (const part of base) {
    for (const variant of singleAccentVariants(part)) {
      probes.add(variant);
      if (probes.size >= 18) return [...probes];
    }
  }
  return [...probes];
}

function searchCoverage(row: VenueSearchResult, tokens: string[]) {
  if (tokens.length === 0) return 0;
  const haystack = comparableVenueSearch(
    `${row.name} ${row.locality || ""} ${row.address || ""}`,
  );
  return (
    tokens.filter((token) => haystack.includes(token)).length / tokens.length
  );
}

function rowScore(row: VenueSearchResult, query: string) {
  const normalizedQuery = comparableVenueSearch(query);
  const name = comparableVenueSearch(row.name);
  const locality = comparableVenueSearch(row.locality || "");
  const address = comparableVenueSearch(row.address || "");
  const haystack = `${name} ${locality} ${address}`.trim();
  const tokens = venueSearchTokens(query);
  const segments = normalizeVenueSearch(query)
    .split(/[,;|]+/)
    .map(comparableVenueSearch)
    .filter(Boolean);

  if (name === normalizedQuery) return 0;
  if (name.startsWith(normalizedQuery)) return 1;
  if (name.includes(normalizedQuery)) return 2;
  if (address.includes(normalizedQuery)) return 3;
  if (haystack.includes(normalizedQuery)) return 4;

  if (
    segments.length > 1 &&
    segments.every((segment) => haystack.includes(segment))
  )
    return 5;

  const coverage = searchCoverage(row, tokens);
  const nameMatches = tokens.filter((token) => name.includes(token)).length;
  const localityMatches = tokens.filter((token) =>
    locality.includes(token),
  ).length;
  const addressMatches = tokens.filter((token) =>
    address.includes(token),
  ).length;

  return (
    20 -
    coverage * 10 -
    nameMatches * 1.5 -
    localityMatches * 0.9 -
    addressMatches * 0.35
  );
}

export function rankVenueSearchResults(
  rows: VenueSearchResult[],
  query: string,
  limit = 8,
) {
  const tokens = venueSearchTokens(query);
  const minimumCoverage =
    tokens.length <= 3 ? 1 : tokens.length <= 5 ? 0.8 : 0.7;

  return [...rows]
    .filter((row) => {
      if (tokens.length === 0) return false;
      return searchCoverage(row, tokens) >= minimumCoverage;
    })
    .sort(
      (a, b) =>
        rowScore(a, query) - rowScore(b, query) ||
        a.name.localeCompare(b.name, "es", { sensitivity: "base" }),
    )
    .slice(0, limit);
}
