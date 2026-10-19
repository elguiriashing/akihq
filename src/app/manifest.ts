import type { MetadataRoute } from "next";
import { managementProduct, roleSwapEnabled } from "../lib/product-roles";
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  return {
    // Preserve the installed management application identity across releases.
    id: "/akibusiness",
    name: managementProduct.name,
    short_name: managementProduct.name,
    description: `Gestiona locales, alojamientos y flotas con ${managementProduct.name}.`,
    start_url: "/es/business",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#111111",
    lang: "es",
    scope: "/",
    categories: ["business"],
    icons: roleSwapEnabled
      ? [
          {
            src: "/brand/hq-mark.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "/brand/hq-v2-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/brand/hq-v2-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/brand/hq-v2-maskable-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/brand/hq-v2-maskable-512.png",
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
