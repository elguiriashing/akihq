import { z } from "zod";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { normalizeVenueSearch } from "@/lib/venue-search";

const querySchema = z.object({
  q: z.string().max(160).optional().default(""),
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
});
const pageSize = 25;
export async function GET(request: Request) {
  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success)
    return Response.json({ error: "Invalid search" }, { status: 400 });
  const query = normalizeVenueSearch(parsed.data.q);
  if (query.length < 2)
    return Response.json({ rows: [], total: 0, nextOffset: null });
  const { data, error } = await createSupabasePublicClient().rpc(
    "search_public_venues",
    {
      p_query: query,
      p_offset: parsed.data.offset,
      p_limit: pageSize,
    },
  );
  if (error)
    return Response.json(
      { error: "Venue search temporarily unavailable" },
      { status: 503 },
    );
  const rows = data || [];
  const total = Number(rows[0]?.total || 0);
  const next = parsed.data.offset + rows.length;
  return Response.json(
    { rows, total, nextOffset: next < total ? next : null },
    {
      headers: { "Cache-Control": "public, max-age=20, s-maxage=60" },
    },
  );
}
