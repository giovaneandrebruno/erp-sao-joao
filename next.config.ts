import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // a importação manda a planilha inteira para o servidor de uma vez
    serverActions: { bodySizeLimit: "20mb" },
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
