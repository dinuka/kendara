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
  ],
};

export default withNextIntl(nextConfig);
