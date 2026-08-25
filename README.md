# Stonevora-ERP

Multi-tenant ERP for Marble, Granite, Natural Stone and Tile businesses.

Built with Next.js (App Router) + Supabase (Postgres, Auth, Storage), deployed on
Vercel. This is Phase 0 of a phased rollout — see `supabase/migrations/` for the
multi-tenant schema and `PHASES.md` for the roadmap.

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
