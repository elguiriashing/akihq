import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  addressSearchModeSchema,
  searchSpainAddresses,
} from "@/lib/spain-addresses";

const requestSchema = z.object({
  q: z.string().trim().min(3).max(120),
  mode: addressSearchModeSchema.default("address"),
});

export async function GET(request: NextRequest) {
  const parsed = requestSchema.safeParse({
    q: request.nextUrl.searchParams.get("q"),
    mode: request.nextUrl.searchParams.get("mode") || "address",
  });
  if (!parsed.success) {
    return NextResponse.json({ suggestions: [] }, { status: 400 });
  }

  try {
    const suggestions = await searchSpainAddresses(
      parsed.data.q,
      parsed.data.mode,
    );
    return NextResponse.json(
      { suggestions },
      {
        headers: {
          "Cache-Control": "public, max-age=300, s-maxage=86400",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { suggestions: [], error: "address_provider_unavailable" },
      { status: 503 },
    );
  }
}
