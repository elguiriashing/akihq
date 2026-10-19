import { z } from "zod";

export const compactMarkerSchema = z.tuple([
  z.string().uuid(),
  z.number().finite().min(-180).max(180),
  z.number().finite().min(-90).max(90),
  z.union([z.literal(0), z.literal(1)]),
  z.union([z.literal(0), z.literal(1)]),
]);
export const mapSnapshotSchema = z
  .object({
    version: z.literal(2),
    generatedAt: z.string(),
    count: z.number().int().nonnegative(),
    markers: z.array(compactMarkerSchema),
  })
  .refine((value) => value.count === value.markers.length);
export type MapMarkerSnapshot = z.infer<typeof mapSnapshotSchema>;
export type CompactMapMarker = z.infer<typeof compactMarkerSchema>;

export async function loadMapSnapshot(
  signal: AbortSignal,
  request: typeof fetch = fetch,
) {
  const response = await request("/api/map/snapshot?v=2&policy=relevance-6", {
    signal,
  });
  if (!response.ok) throw new Error("Map unavailable");
  const data = mapSnapshotSchema.parse(await response.json());
  signal.throwIfAborted();
  return data;
}

export const mapVenueDetailSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  address: z.string().nullable(),
  claimStatus: z.enum(["claimed", "unclaimed"]),
  discoveryVertical: z.enum(["activities", "accommodation"]),
});
export type MapVenueDetail = z.infer<typeof mapVenueDetailSchema>;
