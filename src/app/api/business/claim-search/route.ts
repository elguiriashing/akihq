import { z } from "zod";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { normalizeVenueSearch } from "@/lib/venue-search";

const querySchema = z.object({
  vertical: z.enum(["activities", "accommodation"]).default("activities"),
  q: z.string().trim().min(2).max(160),
});

export async function GET(request: Request) {
  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success) return Response.json({ rows: [] }, { status: 400 });

  const query = normalizeVenueSearch(parsed.data.q);
  const { data, error } = await createSupabasePublicClient().rpc(
    parsed.data.vertical === "accommodation"
      ? "search_claimable_accommodations"
      : "search_claimable_venues",
    {
      p_query: query,
      p_limit: 24,
    },
  );

  if (error)
    return Response.json(
      { error: "Venue search temporarily unavailable" },
      { status: 503 },
    );

  return Response.json(
    { rows: data || [] },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
