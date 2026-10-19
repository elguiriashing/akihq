// Repair the exact country-label corruption observed in legacy CRM publishing.
// Do not reinterpret the whole address: its other accents are valid UTF-8.
export function normalizeAddressLabel(address: string) {
  return address.replaceAll("Espa\u00d2\u00b1a", "España");
}

export function googleMapsDirectionsUrl({
  address,
  latitude,
  longitude,
}: {
  address: string;
  latitude?: number;
  longitude?: number;
}) {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  const hasCoordinates =
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180 &&
    // The repository uses 0,0 for missing coordinates.
    (latitude !== 0 || longitude !== 0);
  const normalizedAddress = normalizeAddressLabel(address).trim();
  url.searchParams.set(
    "destination",
    hasCoordinates ? `${latitude},${longitude}` : normalizedAddress,
  );
  return url.toString();
}
