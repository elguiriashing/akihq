import { managementProduct } from "@/lib/product-roles";
import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
    host: managementProduct.origin,
  };
}
