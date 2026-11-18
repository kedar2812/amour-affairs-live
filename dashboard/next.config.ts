import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dashboard deploys to cPanel shared hosting (no Node server),
  // so the build must be a fully static export served by Apache.
  output: "export",

  // Emit /albums/index.html instead of /albums.html so Apache serves
  // deep links and refreshes without any rewrite rules.
  trailingSlash: true,

  // This repo nests the dashboard inside the website repo (two
  // lockfiles); pin the workspace root to silence the inference warning.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
