/** Available workspace picker assets consume no quota until this venue uses them. */
export function listingMediaUsage(
  owned: string[],
  placements: Array<string | undefined>,
  other: string[] = [],
) {
  return new Set(
    [...owned, ...placements, ...other].filter((id): id is string =>
      Boolean(id),
    ),
  ).size;
}
