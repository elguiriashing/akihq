import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const parsed = z
    .object({
      company: z.string().uuid(),
      page: z.coerce.number().int().min(1).max(50000),
      filter: z.enum([
        "live",
        "current",
        "upcoming",
        "requested",
        "history",
        "all",
        "pickups",
        "returns",
      ]),
      q: z.string().trim().max(80),
    })
    .safeParse({
      company: q.get("company"),
      page: q.get("page") || 1,
      filter: q.get("filter") || "live",
      q: q.get("q") || "",
    });
  if (!parsed.success)
    return Response.json({ error: "invalid_query" }, { status: 400 });
  const db = await createSupabaseServerClient(),
    { data: auth } = await db.auth.getUser();
  if (!auth.user)
    return Response.json({ error: "sign_in_required" }, { status: 401 });
  const { data: allowed, error: accessError } = await db.rpc(
    "can_manage_rental_company",
    { p_company: parsed.data.company },
  );
  if (accessError || !allowed)
    return Response.json({ error: "not_authorized" }, { status: 403 });
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  let query = db
    .from("car_rental_bookings")
    .select(
      "id,vehicle_id,start_date,end_date,status,contact_name,contact_email,contact_phone,note,quoted_total_cents,created_at,vehicle:car_rental_vehicles!inner(name,company_id)",
      { count: "exact" },
    )
    .eq("vehicle.company_id", parsed.data.company);
  const filter = parsed.data.filter;
  if (filter === "live")
    query = query.eq("status", "confirmed").gte("end_date", today);
  if (filter === "current")
    query = query
      .eq("status", "confirmed")
      .lte("start_date", today)
      .gt("end_date", today);
  if (filter === "pickups")
    query = query.eq("status", "confirmed").eq("start_date", today);
  if (filter === "returns")
    query = query.eq("status", "confirmed").eq("end_date", today);
  if (filter === "upcoming")
    query = query.eq("status", "confirmed").gt("start_date", today);
  if (filter === "requested") query = query.eq("status", "requested");
  if (filter === "history")
    query = query.or(
      `status.in.(completed,cancelled,declined),and(status.eq.confirmed,end_date.lt.${today})`,
    );
  if (parsed.data.q)
    query = query.ilike(
      "contact_name",
      `%${parsed.data.q.replace(/[\\%_]/g, "\\$&")}%`,
    );
  const [result, summary] = await Promise.all([
    query
      .order("start_date", { ascending: filter !== "history" })
      .order("id")
      .range((parsed.data.page - 1) * 8, parsed.data.page * 8 - 1),
    db.rpc("rental_branch_booking_summary", { p_company: parsed.data.company }),
  ]);
  if (result.error || summary.error || result.count === null)
    return Response.json(
      { error: "bookings_unavailable" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  return Response.json(
    {
      rows: result.data || [],
      total: result.count,
      summary: summary.data,
      today,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
