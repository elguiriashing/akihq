import { z } from "zod";

const paramsSchema = z.object({
  z: z.coerce.number().int().min(0).max(19),
  x: z.coerce.number().int().min(0),
  y: z.coerce.number().int().min(0),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ z: string; x: string; y: string }> },
) {
  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success) return new Response(null, { status: 400 });

  const { z, x, y } = parsed.data;
  const max = 2 ** z;
  if (x >= max || y >= max) return new Response(null, { status: 400 });

  const upstream = await fetch(
    `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
    {
      headers: {
        "User-Agent": "AkiPasa/1.0 (https://akipasa.com)",
        Accept: "image/png,image/*;q=0.8,*/*;q=0.5",
      },
      cf: { cacheTtl: 86400, cacheEverything: true },
    } as RequestInit & { cf?: { cacheTtl: number; cacheEverything: boolean } },
  );

  if (!upstream.ok) return new Response(null, { status: upstream.status });

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "image/png",
      "Cache-Control": "public, max-age=86400, s-maxage=604800",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
