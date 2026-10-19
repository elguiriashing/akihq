function createPublicSlug(value: string, fallback: string) {
  const base =
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || fallback;
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

export function createVenueSlug(name: string) {
  return createPublicSlug(name, "local");
}

export function createEventSlug(title: string) {
  return createPublicSlug(title, "event");
}
