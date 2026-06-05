import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a minimal standalone server bundle for small Docker images.
  output: "standalone",
  images: {
    // Champion icons are served from Riot's Data Dragon CDN.
    remotePatterns: [{ protocol: "https", hostname: "ddragon.leagueoflegends.com" }],
  },
};

export default nextConfig;
