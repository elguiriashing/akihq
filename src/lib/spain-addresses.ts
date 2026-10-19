import { z } from "zod";

const SPAIN_BOUNDS = {
  minLatitude: 27,
  maxLatitude: 44.5,
  minLongitude: -19,
  maxLongitude: 5,
} as const;

export const addressSearchModeSchema = z.enum(["address", "locality"]);

const cartoCiudadCandidateSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  province: z.string().nullable().optional(),
  muni: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  postalCode: z.string().nullable().optional(),
  poblacion: z.string().nullable().optional(),
  lat: z.coerce.number().optional().default(0),
  lng: z.coerce.number().optional().default(0),
  countryCode: z.string().nullable().optional(),
});

const cartoCiudadResponseSchema = z.array(cartoCiudadCandidateSchema).max(30);

export type SpainAddressSuggestion = {
  id: string;
  label: string;
  address: string;
  locality: string;
  province: string;
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
  kind: "address" | "locality";
  provider: "cartociudad";
};

function hasSpainCoordinates(latitude: number, longitude: number) {
  return (
    latitude >= SPAIN_BOUNDS.minLatitude &&
    latitude <= SPAIN_BOUNDS.maxLatitude &&
    longitude >= SPAIN_BOUNDS.minLongitude &&
    longitude <= SPAIN_BOUNDS.maxLongitude
  );
}

function tidy(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function normalizedLabel(parts: string[]) {
  const unique = parts.filter(
    (part, index, values) =>
      part &&
      values.findIndex(
        (candidate) =>
          candidate.localeCompare(part, "es", { sensitivity: "base" }) === 0,
      ) === index,
  );
  return [...unique, "España"].join(", ");
}

export async function searchSpainAddresses(
  query: string,
  mode: z.infer<typeof addressSearchModeSchema>,
): Promise<SpainAddressSuggestion[]> {
  const url = new URL(
    "https://www.cartociudad.es/geocoder/api/geocoder/candidates",
  );
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "15");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "AkiPasa address search/1.0",
      },
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) throw new Error(`CartoCiudad returned ${response.status}`);
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > 256_000)
    throw new Error("CartoCiudad response too large");

  const parsed = cartoCiudadResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("Unexpected CartoCiudad response");

  const localityCoordinates = new Map<
    string,
    { latitude: number; longitude: number }
  >();
  for (const candidate of parsed.data) {
    if (!hasSpainCoordinates(candidate.lat, candidate.lng)) continue;
    const municipality = tidy(candidate.muni).toLocaleLowerCase("es");
    const province = tidy(candidate.province).toLocaleLowerCase("es");
    const key = `${municipality}|${province}`;
    if (municipality && province && !localityCoordinates.has(key)) {
      localityCoordinates.set(key, {
        latitude: candidate.lat,
        longitude: candidate.lng,
      });
    }
  }

  const seen = new Set<string>();
  return parsed.data
    .flatMap((candidate): SpainAddressSuggestion[] => {
      if (candidate.countryCode && candidate.countryCode !== "011") return [];
      const type = tidy(candidate.type).toLocaleLowerCase("es");
      const locality = tidy(candidate.muni || candidate.poblacion);
      const province = tidy(candidate.province);
      const address = tidy(candidate.address);
      const postalCode = tidy(candidate.postalCode);
      const hasCoordinates = hasSpainCoordinates(candidate.lat, candidate.lng);

      if (mode === "locality") {
        if (
          type === "portal" ||
          !province ||
          (type !== "municipio" && !hasCoordinates)
        )
          return [];
        const place = tidy(
          type === "municipio"
            ? locality
            : candidate.poblacion || candidate.address || locality,
        );
        if (!place) return [];
        const key = `${place}|${province}`.toLocaleLowerCase("es");
        if (seen.has(key)) return [];
        seen.add(key);
        const fallbackCoordinates = localityCoordinates.get(
          `${locality.toLocaleLowerCase("es")}|${province.toLocaleLowerCase("es")}`,
        );
        return [
          {
            id: candidate.id,
            label: normalizedLabel([place, province]),
            address: place,
            locality: place,
            province,
            postalCode,
            latitude: hasCoordinates
              ? candidate.lat
              : (fallbackCoordinates?.latitude ?? null),
            longitude: hasCoordinates
              ? candidate.lng
              : (fallbackCoordinates?.longitude ?? null),
            kind: "locality",
            provider: "cartociudad",
          },
        ];
      }

      if (!hasCoordinates || !address || !locality || !province) return [];
      if (!new Set(["portal", "toponimo"]).has(type)) return [];
      const key = `${address}|${postalCode}|${province}`.toLocaleLowerCase(
        "es",
      );
      if (seen.has(key)) return [];
      seen.add(key);
      return [
        {
          id: candidate.id,
          label: normalizedLabel([address, postalCode, province]),
          address: normalizedLabel([address, postalCode, province]),
          locality,
          province,
          postalCode,
          latitude: candidate.lat,
          longitude: candidate.lng,
          kind: "address",
          provider: "cartociudad",
        },
      ];
    })
    .slice(0, 8);
}
