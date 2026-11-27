import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  serverExternalPackages: [
      "mongoose",
      "swisseph-v2",
      "jyotish-calculations",
      "@xenova/transformers",
      "@qdrant/js-client-rest",
      "@resvg/resvg-js",
  ],
  allowedDevOrigins: ['192.168.8.103'],
  // Files read from disk at runtime aren't found by output tracing, so Vercel functions would ship
  // without them: the pre-compiled chart renderer (loaded with a runtime require), the rasterizer
  // fonts and the zodiac icons it inlines (public/ is served from the CDN, not the function), and the
  // native Swiss Ephemeris binary (swisseph-v2 loads it with a computed require(__dirname + ...)).
  outputFileTracingIncludes: {
      "/**": [
          ".chart-renderer/index.cjs",
          "assets/fonts/*.ttf",
          "public/zodiac/*.png",
          "node_modules/.pnpm/swisseph-v2@*/node_modules/swisseph-v2/build/Release/swisseph.node",
      ],
  },
  // Transformers.js (+ onnxruntime, sharp) is only used for Qdrant vector search, which is skipped
  // when QDRANT_URL is unset (src/lib/search/embedding.ts); tracing it in would push the search and
  // horoscope functions past Vercel's 250 MB size limit.
  outputFileTracingExcludes: {
      "/**": ["node_modules/@xenova/**", "node_modules/onnxruntime-*/**", "node_modules/.pnpm/onnxruntime-*/**", "node_modules/.pnpm/@xenova+*/**", "node_modules/.pnpm/sharp@*/**", "node_modules/.pnpm/@img+*/**"],
  },
};

export default withNextIntl(nextConfig);
