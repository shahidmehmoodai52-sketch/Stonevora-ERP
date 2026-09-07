import type { CapacitorConfig } from "@capacitor/cli";

// Scope for this pass, matching the offline-first foundation's own honest
// boundary: a real, buildable native app shell -- installable from the
// Play Store, no browser chrome, ready for push notifications and native
// APIs later -- pointed at the hosted app rather than bundling it locally.
// Unlike the Tauri desktop shell, this is NOT yet the deep offline
// architecture: Capacitor doesn't support spawning an arbitrary local
// server process the way a Tauri sidecar does, so genuine offline mobile
// operation needs its own follow-up design (most likely: a client-rendered
// build of the offline-critical screens, reusing lib/offline's outbox/sync
// engine, bundled as the local webDir instead of a remote server.url) --
// deliberately not attempted here rather than half-built.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const config: CapacitorConfig = {
  appId: "com.stonevora.erp",
  appName: "Stonevora ERP",
  // capacitor-www/index.html is a minimal "loading" placeholder, never the
  // real app -- webDir must point at an existing directory with real
  // content, but every case below sets server.url, so this is only ever
  // seen for the brief moment before that navigation completes.
  webDir: "capacitor-www",
  server: {
    url: siteUrl,
    cleartext: siteUrl.startsWith("http://"),
  },
};

export default config;
