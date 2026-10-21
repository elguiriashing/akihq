import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const isDevelopment = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  typedRoutes: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
  allowedDevOrigins: ["127.0.0.1"],
  webpack: (webpackConfig, { isServer }) => {
    if (isServer) {
      webpackConfig.resolve.alias["maplibre-gl"] = false;
    }
    return webpackConfig;
  },
  images: {
    // Preserve the pre-upgrade one-minute image-cache minimum.
    minimumCacheTTL: 60,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "akipasa.supabase.co",
        pathname: "/storage/v1/object/sign/event-media/**",
      },
      {
        protocol: "https",
        hostname: "vhpbvcfkcteswlsdjrfl.supabase.co",
        pathname: "/storage/v1/object/sign/event-media/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self), payment=()",
          },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "base-uri 'self'",
              "form-action 'self' https://accounts.google.com",
              "frame-ancestors 'none'",
              "object-src 'none'",
              `script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://static.cloudflareinsights.com/beacon.min.js https://static.cloudflareinsights.com/beacon.min.js/${
                isDevelopment ? " 'unsafe-eval'" : ""
              }`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://akipasa.supabase.co https://vhpbvcfkcteswlsdjrfl.supabase.co https://tiles.openfreemap.org https://tile.openstreetmap.org https://*.google-analytics.com https://*.analytics.google.com https://pagead2.googlesyndication.com https://www.googleadservices.com https://www.google.com https://www.google.es",
              "font-src 'self' data:",
              "connect-src 'self' https://akipasa.supabase.co wss://akipasa.supabase.co https://vhpbvcfkcteswlsdjrfl.supabase.co wss://vhpbvcfkcteswlsdjrfl.supabase.co https://tiles.openfreemap.org https://tile.openstreetmap.org https://*.google-analytics.com https://*.analytics.google.com https://pagead2.googlesyndication.com https://www.googleadservices.com https://www.google.com https://www.google.es",
              "manifest-src 'self'",
              "worker-src 'self' blob:",
              "upgrade-insecure-requests",
            ].join("; "),
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
