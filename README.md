# Stonevora-ERP

Multi-tenant ERP for Marble, Granite, Natural Stone and Tile businesses —
Trading/Distribution, Block/Slab Factory, Stone Fabrication, Tile Manufacturing,
Showroom/Reservation, Accounting, QR/Mobile scanning, cross-module reporting, and
offline-capable desktop/mobile shells.

Built with Next.js (App Router) + Supabase (Postgres, Auth, Storage), deployed on
Vercel. See `PHASES.md` for the full roadmap and what's shipped in each phase.

## Getting started

```bash
npm install
cp .env.local.example .env.local   # fill in your Supabase project URL/keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database

Migrations live in `supabase/migrations/` and are applied via the Supabase CLI or
the Supabase MCP tooling. Every tenant-scoped table enforces isolation with Postgres
Row-Level Security — see `supabase/migrations/0009_rls_policies.sql`.

## Testing

```bash
npm test
```

RLS/integration tests in `tests/rls/` need `SUPABASE_SERVICE_ROLE_KEY` set (test
setup only, never used at runtime) and skip gracefully without it. The offline
sync engine's own tests (`tests/offline/`) run against a real in-memory
IndexedDB (`fake-indexeddb`) and need no external service.

## Offline support

Data entry for sales orders, purchase orders, goods receipts (GRN), deliveries, and
invoice generation queues locally (IndexedDB via `lib/offline/`) and syncs
automatically when connectivity returns — see `PHASES.md`'s Phase 9 entry for the
full design and its documented boundaries (which screens are wired, and what's not
yet offline-capable).

## Desktop app (Tauri)

The desktop shell bundles the app's own server locally — it doesn't just open a
browser window to a hosted URL — so it keeps working with no internet connection to
reach anything beyond Supabase itself.

```bash
npm run dev              # in one terminal
npm run tauri dev        # in another — opens the native window against the dev server
```

To build a release binary:

```bash
npm run tauri build      # runs build:desktop internally (see package.json)
```

`build:desktop` (1) stages a Node.js binary as the app's sidecar
(`scripts/prepare-tauri-node-sidecar.mjs` — copies whatever `node` is on the build
machine's `PATH`; a real release pipeline for a platform other than the one you're
building on should instead fetch the official Node.js binary for that target), (2)
runs `next build` with `output: "standalone"`, and (3) assembles that standalone
build plus static assets into `src-tauri/resources/server`
(`scripts/prepare-tauri-server.mjs`), which the shell runs locally on launch. To
regenerate the app icon set from `app/icon.tsx`'s design after a rebrand:
`npm run generate:app-icon`.

## Mobile app (Capacitor / Android)

Currently a native shell pointed at the hosted app (`capacitor.config.ts`'s
`server.url`, driven by `NEXT_PUBLIC_SITE_URL`) — not yet the same bundled-local-server
architecture as desktop; see `PHASES.md` for why and what a fully offline-capable
mobile build would need.

```bash
NEXT_PUBLIC_SITE_URL=https://your-deployed-app.example npx cap sync android
npx cap open android      # opens Android Studio; requires the Android SDK installed
```
