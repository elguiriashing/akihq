import { z } from "zod";
import { normalizeAddressLabel } from "@/lib/maps";
import { createSupabasePublicClient } from "@/lib/supabase/public";

// Claim deep links only need published catalogue fields; ownership stays private.
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const parsed = z
    .string()
    .uuid()
    .safeParse((await context.params).id);
  const headers = { "Cache-Control": "private, no-store" };
  if (!parsed.success)
    return Response.json({ error: "Invalid venue" }, { status: 400, headers });

  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("venues")
    .select("id,slug,name,address,discovery_vertical")
    .eq("id", parsed.data)
    .eq("status", "published")
    .maybeSingle();
  if (error)
    return Response.json(
      { error: "Venue temporarily unavailable" },
      { status: 503, headers },
    );
  if (!data)
    return Response.json(
      { error: "Venue no longer available" },
      { status: 404, headers },
    );

  const { data: claimed, error: ownershipError } = await supabase.rpc(
    "public_venue_is_claimed",
    { p_venue: parsed.data },
  );
  if (ownershipError || typeof claimed !== "boolean")
    return Response.json(
      { error: "Venue ownership temporarily unavailable" },
      { status: 503, headers },
    );

  return Response.json(
    {
      id: data.id,
      slug: data.slug,
      name: data.name,
      address: data.address
        ? normalizeAddressLabel(data.address)
        : data.address,
      discoveryVertical: data.discovery_vertical,
      claimStatus: claimed ? "claimed" : "unclaimed",
    },
    { headers },
  );
}
