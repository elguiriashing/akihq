import type { MetadataRoute } from "next";
import { managementProduct, roleSwapEnabled } from "../lib/product-roles";
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  return {
    // Preserve the installed management application identity across releases.
    id: "/akihq",
    name: managementProduct.name,
    short_name: managementProduct.name,
    description: `Gestiona locales, alojamientos y flotas con ${managementProduct.name}.`,
    start_url: "/es/business",
    display: "standalone",
    background_color: "#252830",
    theme_color: "#252830",
    lang: "es",
    scope: "/",
    categories: ["business"],
    icons: roleSwapEnabled
      ? [
          {
            src: "/brand/v3/hq.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "/brand/v3/hq-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/brand/v3/hq-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/brand/v3/hq-maskable-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/brand/v3/hq-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ]
      : ([192, 512] as const).flatMap((size) => [
          {
            src: `/pwa/business-${size}.png`,
            sizes: `${size}x${size}`,
            type: "image/png",
            purpose: "any" as const,
          },
          {
            src: `/pwa/business-maskable-${size}.png`,
            sizes: `${size}x${size}`,
            type: "image/png",
            purpose: "maskable" as const,
          },
        ]),
  };
}
