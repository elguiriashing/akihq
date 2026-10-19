import { managementProduct, roleSwapEnabled } from "@/lib/product-roles";
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json(
    {
      product: "akihq",
      role: "management",
      publicProduct: managementProduct.name,
      roleSwapEnabled,
      status: "ok",
    },
    { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
  );
}
