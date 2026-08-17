import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a minimal standalone server bundle for small Docker images.
  output: "standalone",
  turbopack: {
    // A stray lockfile in the home directory makes Next misdetect the
    // workspace root as $HOME, which has Turbopack watch/resolve across
    // every sibling repo instead of just this project.
    root: __dirname,
  },
  images: {
    // Champion icons are served from Riot's Data Dragon CDN.
    remotePatterns: [{ protocol: "https", hostname: "ddragon.leagueoflegends.com" }],
  },
};

export default nextConfig;
