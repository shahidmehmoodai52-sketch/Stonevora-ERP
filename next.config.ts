import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" produces a self-contained .next/standalone/server.js (its
  // own minimal node_modules, no reliance on a full `npm install` on the
  // target machine) -- this is what the Tauri desktop shell bundles and
  // runs locally as its server, so the app's own UI is served from disk,
  // not fetched over the network, on every launch. Harmless for the
  // ordinary Vercel deployment too (Vercel already produces its own
  // optimized output regardless of this setting).
  output: "standalone",
};

export default nextConfig;
