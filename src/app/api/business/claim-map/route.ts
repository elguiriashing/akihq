import { z } from "zod";
import { createSupabasePublicClient } from "@/lib/supabase/public";

const querySchema = z.object({
  vertical: z.enum(["activities", "accommodation"]).default("activities"),
  west: z.coerce.number().finite().min(-180).max(180),
  east: z.coerce.number().finite().min(-180).max(180),
  south: z.coerce.number().finite().min(-85).max(85),
  north: z.coerce.number().finite().min(-85).max(85),
});

export async function GET(request: Request) {
  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (
    !parsed.success ||
    parsed.data.west >= parsed.data.east ||
    parsed.data.south >= parsed.data.north
  ) {
    return Response.json({ rows: [] }, { status: 400 });
  }

  const { west, east, south, north } = parsed.data;
  const { data, error } = await createSupabasePublicClient().rpc(
    parsed.data.vertical === "accommodation"
      ? "claimable_accommodation_cards_in_bounds"
      : "claimable_venue_cards_in_bounds",
    {
      p_west: west,
      p_east: east,
      p_south: south,
      p_north: north,
      p_limit: 1500,
    },
  );

  if (error) {
    return Response.json(
      { error: "Claim map temporarily unavailable" },
      { status: 503 },
    );
  }

  return Response.json(
    { rows: data || [] },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
