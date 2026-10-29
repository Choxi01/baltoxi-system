import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
  // La raíz lleva a "Hoy" (el proxy manda al login si no hay sesión).
  async redirects() {
    return [{ source: "/", destination: "/hoy", permanent: false }];
  },
};

export default nextConfig;
