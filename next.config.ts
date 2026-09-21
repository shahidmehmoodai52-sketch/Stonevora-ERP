import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" produces a self-contained .next/standalone/server.js (its
  // own minimal node_modules, no reliance on a full `npm install` on the
  // target machine) -- this is what the Tauri desktop shell bundles and
  // runs locally as its server, so the app's own UI is served from disk,
  // not fetched over the network, on every launch.
  //
  // Gated behind NEXTJS_STANDALONE_BUILD (set only by the build:desktop
  // script) -- NOT harmless for an ordinary Vercel deployment, despite
  // what an earlier version of this comment claimed: standalone mode
  // changes what `next build` emits into `.next/` (bundling into
  // `.next/standalone/` instead), which omits `.next/next-server.js.nft.json`
  // that Vercel's own build pipeline's onBuildComplete step reads --
  // confirmed live, a real Vercel deployment of this exact commit failed
  // with `ENOENT: .next/next-server.js.nft.json` at that step, after
  // `next build` itself had already compiled and generated all pages
  // successfully. Vercel's own deployment format is already optimized
  // and was never meant to receive standalone output.
  output: process.env.NEXTJS_STANDALONE_BUILD === "true" ? "standalone" : undefined,
};

export default nextConfig;
