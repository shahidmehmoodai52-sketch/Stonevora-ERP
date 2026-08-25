# Stonevora ERP — Pre-Factory Architecture Audit

Status: research/audit only. No Block/Slab Factory code was written for this
document. No Phase 0/Phase 1 table, RLS policy, RPC, or business rule was
changed while producing it — every finding below was obtained by reading the
actual migrations (`supabase/migrations/0001`–`0031`), the actual application
code (`actions/`, `components/`, `app/`), and by running live, read-only (or
self-cleaning) queries against the real Supabase project
(`kfxjdgijquselbfprxxv`), not by assumption.

---

## 1. Executive Summary

Phase 0 (multi-tenant foundation) and Phase 1 (Trading/Distribution) are
intact, RLS is enabled on all 45 tables in `public`, and the business
capability gate added in the previous session correctly restricts itself to
metadata — it does not yet unlock any factory behavior, because none exists.

The architecture has a genuinely strong foundation to build Block/Slab on:
a universal UOM/conversion engine, a lookup-value product attribute pattern,
a Warehouse → Zone → Row → Rack → Position location hierarchy, and — already
sitting in `inventory_units` since migration `0017` — the exact block → slab
→ remnant genealogy columns (`unit_type`, `parent_unit_id`, `sequence_number`,
`actual_area`, `qr_code_value`, `cost`, `selling_price`) the factory phase will
need. This was deliberately laid down as schema-only groundwork in Phase 0 and
is still unused by any UI or RPC.

However, this audit found **one defect that is not factory-specific and
already reachable in production Phase 1 today**: none of the four Phase 1
integrity functions (`post_goods_receipt`, `confirm_sales_order`,
`dispatch_delivery`, `generate_sales_invoice_from_delivery`) convert a line's
UOM before touching `qty_on_hand`/`reserved_qty`, and the UI lets a user pick
*any* UOM on a PO/SO line, not just the product's base UOM. If a tile shop
ever receives or sells in `BOX` while stock is tracked in `PCS`, the box
count is added/subtracted from `qty_on_hand` as if it were pieces. It is
latent (harmless as long as every user happens to always pick the base UOM)
but real, and it gets strictly worse once Block/Slab introduces volume ↔
count ↔ area conversions. Section 14 recommends this be fixed as its own
task **before** Block/Slab work begins — not as part of Block/Slab, and not
in this audit.

A second, narrower gap: `user_roles.branch_id` (added in Phase 0 to "scope a
role to one branch") is not read by `has_permission()` or by any RLS policy
today — branch-level restriction is schema-present but not enforced at the
database layer, contradicting the standing rule that branch isolation must
be enforced server-side. This matters once a tenant runs more than one
branch, which several of the target business types (multi-branch retailer,
central warehouse + shops) require.

Everything else below is either confirmed working, or an explicit, scoped
research recommendation for a future task — never a "we should probably..."
guess.

---

## 2. Supported Business Types

Traced against the actual schema/RLS/permission model, not against
aspiration:

| Business type | Supported today | Gap for full support |
|---|---|---|
| Small tile retailer (single shop) | Products, simple stock, suppliers/POs/GRN, customers/SOs/deliveries/invoices/payments, ledgers | No POS-style single-screen flow; sale still goes through the SO→Delivery→Invoice pipeline built for wholesale |
| Tile wholesaler/distributor | Price lists per customer, credit-ready (`customers.credit_limit` exists), multi-warehouse reservation | No stock-transfer module (does not exist); no dealer-tier pricing beyond flat price lists; branch isolation not DB-enforced |
| Marble/granite trader (slab-level) | `inventory_units` schema (unit_type/dimensions/area/photo/QR) | Zero UI/RPC uses `inventory_units` yet; `unit`-tracked products are explicitly rejected by all four Phase 1 RPCs today |
| Marble/granite factory | `inventory_units.parent_unit_id` genealogy column exists | No block intake, cutting, QC, yield, or cost-roll-up workflow exists |
| Multi-branch / multi-godown | `branches`, `warehouses.branch_id`, `user_roles.branch_id` column | Branch scoping is not enforced by `has_permission()`/RLS — see §11 |
| Hybrid (factory + wholesale + retail) | `tenant_capabilities` lets these coexist as flags | Depends on all of the above being built; the flag itself is not a functional gate for anything but UI, since no factory UI exists to gate |

**Sources for retail/wholesale/distribution/factory workflow patterns:**
[ERPLax Granite ERP](https://erplax.com/granite-industry-erp-software),
[DONOZ — Why Generic Systems Fail](https://donoz.in/blogs/erp-systems-granite-marble-industries),
[SlabWise — Software for the Granite Industry](https://slabwise.com/guide/software-granite-industry),
[Bizowie — Distribution ERP multi-warehouse](https://bizowie.com/distribution-erp-software-the-complete-guide-for-wholesale-and-distribution-companies),
[Xorosoft — Customer-Specific Wholesale Pricing](https://xorosoft.com/customer-specific-wholesale-pricing/).

---

## 3. Recommended Tenant/Branch/Location Architecture

Current model (confirmed in `0001_tenancy_core.sql`, `0002_hierarchy.sql`):

```
tenant (business)
  └─ branch (physical company location: shop/office/yard site)
       └─ warehouse (type: warehouse | yard | showroom)
            └─ storage_location (zone → row → rack → position, self-referential)
```

This four-level model is the right shape and matches the multi-location ERP
research pattern of organizing "by region, market, or any structure that
reflects the business" with roll-up reporting
([Bizowie — Multi-Location Businesses](https://bizowie.com/cloud-erp-for-multi-location-businesses-managing-complexity-without-managing-servers)).
Recommendation: **keep it — do not add a fifth level.** What needs to change
is not the hierarchy depth but two things:

1. **`warehouse_type` enum is too narrow.** Today: `warehouse | yard |
   showroom`. The master rules ask for retail shop, godown, factory,
   processing area, and transit as distinct concepts. `godown` is a regional
   synonym for `warehouse` and does not need its own value. `retail_shop`,
   `factory`, and `processing_area` are genuinely distinct operational
   contexts (a POS-style retail counter vs. a production floor behave
   differently) and are missing. **`transit` should NOT become a
   `warehouse_type`** — see next point.
2. **"In transit" is a transfer state, not a place.** Research on
   multi-location inventory (§ "Real-Time Visibility" in the Bizowie source
   above) treats in-transit stock as a status on the movement record, with
   quantity held in a transfer-specific bucket, not as inventory physically
   sitting "at" a location called Transit. Recommendation: model this via a
   `stock_transfers` table with a status enum (`draft → in_transit →
   received`/`cancelled`), not via a `storage_location_type` or
   `warehouse_type` value. This also matches the existing precedent in this
   codebase: `reserved_qty` is already a *state on the stock row*, not a
   separate "Reserved" location — in-transit should follow the same pattern.

**What belongs at which level** (answering the audit's explicit question):

| Concern | Level | Why |
|---|---|---|
| Users, roles, permissions | Tenant, with an optional branch scope | A user's permission *grants* are tenant-wide by resource (Phase 0 design); the existing but unenforced `user_roles.branch_id` is the right place to add a branch *restriction* on top — not a redesign |
| Products, categories, price lists | Tenant | A SKU means the same thing everywhere in one business; branch-specific pricing is a price-list dimension, not a separate product |
| Customers, suppliers | Tenant | Same customer can transact with any branch |
| Stock (`inventory_stock`/`_batches`/`_units`) | Location (down to `storage_location_id` where set, else `warehouse_id`) | Already true today |
| Sales orders, purchase orders, deliveries, GRNs | Branch (+ a specific fulfilling warehouse) | Already true today (`branch_id` + `warehouse_id` columns exist on all of these) |
| Ledgers/reporting | Computed per tenant, filterable by branch | The existing `customer_ledger`/`supplier_ledger` views already compute at tenant scope; adding a branch filter is additive, not a redesign |

---

## 4. Category Architecture

Current schema: `product_categories` is already a self-referential tree
(`parent_id`) — arbitrary depth is supported today, no change needed there.

Research on product taxonomy
([Earley — 5 Key Product Taxonomies](https://www.earley.com/insights/5-key-product-taxonomies-and-how-they-drive-your-business),
[AtroPIM — Building Scalable Product Taxonomy](https://www.atropim.com/en/blog/product-taxonomy))
converges on: *a taxonomy alone is not enough — it must be paired with an
attribute schema that says what data each branch of the tree requires.*
That pairing is exactly what's missing today (see §5).

**Recommended top-level categories** for this industry (not final — to be
confirmed with the user before implementation, per the "document the
reasoning" instruction):

- **Tile** (ceramic, porcelain, vitrified — distinguished by material lookup
  value, not separate categories, matching [tile classification
  research](https://happho.com/classification-tiles/))
- **Marble** / **Granite** / **Natural Stone (other)** — kept as siblings
  rather than one "Natural Stone" parent, because marble and granite differ
  enough in grading/finish vocabulary that merging them would force the
  attribute engine to carry irrelevant fields for one or the other
- **Blocks** and **Slabs** — separate from finished Marble/Granite products
  because they use `inventory_tracking_mode = 'unit'` and carry genealogy;
  keeping them as distinct categories lets the product form show
  block/slab-only fields (dimensions, block number) without polluting the
  regular Marble/Granite retail-product form
- **Remnants** — distinct because pricing/discovery rules differ (sold by
  irregular area, not by SKU-list-price)
- **Sanitaryware, Adhesives & Grout, Chemicals & Sealers, Tools &
  Accessories** — the consumables/hardware long tail every tile/stone shop
  actually stocks alongside the core product; low attribute complexity
  (mostly `simple` tracking mode, no shade/caliber/genealogy)
- **Services** — installation/fabrication labor lines, for shops that also
  fabricate; `simple` tracking, no physical stock at all

Each category needs to answer, per the audit's own checklist: relevant
attributes, relevant UOMs, and tracking method. §5–§6 give the mechanism;
this section only proposes the tree.

---

## 5. Product Attribute Architecture

**Finding:** the current `products` table (`0005_product_master.sql`) is a
hybrid, not the full flexible engine the master rules describe. It already
avoids the worst anti-pattern — raw text duplication — by routing attribute
values through `product_lookup_values` (a tenant-scoped catalog per
`product_attribute_types`), which is the right primitive. But it then wires
exactly **eleven fixed FK columns** onto `products` (`material_type_id`,
`variety_id`, `brand_id`, `collection_id`, `color_id`, `pattern_id`,
`origin_id`, `grade_id`, `finish_id`, `surface_id`, `application_id`) —
every product row carries all eleven slots whether or not its category uses
them. A bag of adhesive gets `variety_id`/`pattern_id`/`finish_id` columns
it will never populate; a tile doesn't yet have a column for "pieces per
box" or "area per box" at all, because those aren't lookup values — they're
plain numbers, and the fixed-column pattern has no numeric attribute slot.

This is short of "hundreds of nullable fields" but is the same shape of
problem, and it will not scale to block/slab-specific fields (block number,
supplier block reference) without either (a) adding more fixed nullable
columns forever, or (b) the redesign below.

**Recommendation — two changes, additive, no data migration needed since
both tables are still effectively unused for anything beyond the 11
existing lookup columns:**

1. **`category_attribute_templates`** (`category_id`, `attribute_type_id`,
   `is_required`, `sort_order`): declares which of the existing
   `product_attribute_types` are relevant to a given category. The product
   *form* reads this to decide which of the 11 lookup pickers to show —
   this alone solves "don't overwhelm a consumables SKU with stone
   attributes" without touching the `products` table at all.
2. **`product_numeric_attributes`** (`product_id`, `attribute_type_id`,
   `value numeric(18,4)`, `uom_id`): an EAV-style table for the genuinely
   variable *numeric* facts a lookup-value can't represent — tile's pieces-
   per-box, area-per-box, boxes-per-pallet; marble's block-number-reference.
   Reuses the existing `product_attribute_types` catalog (add rows like
   `pieces_per_box`, `boxes_per_pallet`) instead of inventing a parallel
   catalog.

Both are additive tables; the existing 11 FK columns and `product_dimensions`
(thickness/length/width/weight) stay exactly as they are — they cover the
attributes common enough across categories to earn a fixed column, per the
same principle the current schema already applies to `product_dimensions`.

---

## 6. UOM & Calculation Engine

The **engine itself is sound and needs no redesign**: `uom` (global +
tenant-custom) and `uom_conversions` (global, tenant, *or product-specific*
factors — the `product_id` column already exists precisely for cases like
"this specific tile SKU converts 1 BOX = 1.5 SQM") is exactly the
"controlled conversion rules" pattern the research calls for
([tile box/SqFt conversion](https://tileprocalculator.com/guides/how-many-boxes-of-tile-do-i-need)).
`products.base_uom_id` / `purchase_uom_id` / `sales_uom_id` already give the
Purchase/Stock/Sales UOM distinction the audit asks about. A Reporting UOM is
not a separate stored field — it's a query-time conversion using the same
`uom_conversions` table, and needs no new schema.

**The defect (already flagged in §1, repeated here with the receipts):**

- `LineItemsEditor.tsx` defaults the UOM `<select>` to `product.base_uom_id`
  but lets the user pick *any* UOM in the full list — nothing constrains it
  to UOMs that actually have a conversion row for that product.
- `post_goods_receipt`, `confirm_sales_order`, `dispatch_delivery`, and
  `generate_sales_invoice_from_delivery` (all in
  `0025_phase1_integrity_functions.sql`) use `v_line.quantity` directly
  against `qty_on_hand`/`reserved_qty` in every branch, with **zero**
  reference to `uom_conversions` anywhere in the file (confirmed by direct
  grep — no match).

**Why it hasn't surfaced yet:** every tenant so far has always transacted in
each product's base UOM, so the missing conversion has never been exercised.
It is a live latent defect, not a hypothetical one — the reachable path is
"user picks BOX on a PO line for a PCS-tracked product," today, in
production.

**Recommended fix (its own task, not this audit — see §15):** before any
line's quantity is applied to `qty_on_hand`/`reserved_qty`/COGS, resolve the
applicable `uom_conversions` row (product-specific → tenant → global,
falling back to erroring if none exists and the line UOM ≠ base UOM) and
convert. Store both `quantity` (as entered) and `base_quantity` (converted)
on each line so the entered unit is preserved for display/printing while all
downstream math operates on `base_quantity`. This is the same "never lose
the original, always compute from a normalized value" principle already
used for landed cost (`goods_receipt_lines.total_unit_cost` is derived, not
overwritten onto `unit_cost`).

**Tile calculation formulas** (piece ↔ box ↔ area, research-confirmed
[here](https://measureit.net/tile/calculator/) and
[here](https://www.calculatesquarefeet.com/for-tile/)):
`area_per_box = pieces_per_box × area_per_piece`; `boxes_needed =
ceil(required_area / area_per_box)` for a customer-facing estimator (round
up — partial boxes are a business-rule toggle per §"Partial boxes where
business rules allow" in the master rules, not a hardcoded ceiling). These
are exactly representable as a product-specific `uom_conversions` row
(BOX→SQFT, factor = `area_per_box`) plus a `pieces_per_box` numeric
attribute (§5) — no bespoke "tile engine" table needed; it's the general
UOM engine, populated correctly, applied correctly.

**Precision:** current numeric column widths are consistent and already
correct — `numeric(18,4)` for quantities/costs/amounts, `numeric(6,3)` for
percentages/tax rates, `numeric(18,6)` for conversion factors and (on
`purchase_orders`) exchange rates. No `float`/`double precision` column
exists anywhere in the schema (confirmed by grep across all 31 migrations).
Recommendation: keep `numeric(18,6)` as the standard for any new ratio-like
column (conversion factors, exchange rates, yield %), and `numeric(18,4)`
for any new money/quantity column, matching what's already there.

---

## 7. Calculation Safety Audit

Traced every `Number(...)` call in `actions/*.ts` (18 call sites across
`products.ts`, `sales.ts`, `purchasing.ts`, `settings.ts`, `payments.ts`):
**all of them parse a form-field string into a JS number purely to hand it
to a Supabase insert/update call as a parameter.** None of them add,
multiply, or otherwise combine two monetary or quantity values in
JavaScript. Confirmed no `.reduce()`, no `qty * price` pattern, anywhere
under `app/` or `components/` either. All real arithmetic — landed-cost
allocation, weighted-average cost, invoice line totals, margin — happens
inside the four `SECURITY DEFINER` Postgres functions using `numeric` typed
variables and columns end to end. Supabase also returns `numeric` columns
as strings to the JS client (verified in `phase1-trading-flow.test.ts`,
e.g. `expect(stock?.qty_on_hand).toBe("100.0000")`), so there is no
float-precision loss even on read.

**Conclusion: no unsafe floating-point financial arithmetic exists today.**
This is a real strength to preserve — any new calculation (UOM conversion,
future exchange-rate application, yield/waste %) must go into a Postgres
function using `numeric`, not into a Server Action or client component,
to keep this property.

**One caveat found:** `purchase_orders.exchange_rate` (added in
`0019_purchasing.sql`) is captured but never read anywhere — not by
`post_goods_receipt`, not by any action. `unit_cost` flows into `avg_cost`
unconverted. If a tenant ever receives the same product from suppliers
billed in two different currencies, `inventory_stock.avg_cost` would
silently blend amounts denominated in different currencies as if they were
the same currency — a real correctness risk once multi-currency purchasing
is actually used, flagged here and expanded in §8.

---

## 8. Multi-Currency Architecture

**Current state, precisely:** `purchase_orders` has both `currency_id` and
`exchange_rate numeric(18,6) not null default 1` — the right shape,
capturing a transaction-time rate. `sales_orders`, `sales_invoices`, and
`price_lists` have `currency_id` but **no `exchange_rate` column at all** —
asymmetric with purchasing. And as noted in §7, even the purchasing-side
`exchange_rate` is never actually applied to `unit_cost` before it becomes
`avg_cost`.

Research consensus
([Yonyou ERP](https://global.chanjet.com/en/news/12225e6335995f08f98aa4c1680caafe.html),
[FirstBit — Multi-Currency Accounting](https://firstbit.ae/blog/guides/multi-currency-accounting-challenges-and-best-practices/),
[NetSuite Multi-Currency Guide](https://www.netsuite.com/portal/resource/articles/accounting/multi-currency-accounting.shtml)):
record the rate in effect *at the transaction date*, never recompute an old
transaction with today's rate, and keep a distinct realized/unrealized
gain-loss workflow for revaluation — this matches the master rules exactly
and confirms the `purchase_orders.exchange_rate` column's design intent was
already correct; it just isn't finished or used.

**Recommended architecture (not implemented in this audit):**

1. Add `exchange_rate numeric(18,6) not null default 1` to `sales_orders`
   and `sales_invoices`, mirroring `purchase_orders` — captured once at
   creation, never recalculated.
2. `post_goods_receipt` must convert `unit_cost` to tenant base currency
   (`unit_cost * exchange_rate`) *before* it enters the weighted-average
   calculation — `avg_cost` and `cost_per_uom` are single-currency
   quantities by definition and cannot correctly mix currencies.
3. A currency-gain/loss workflow (§22 of the master rules) is Chart-of-
   Accounts territory — correctly out of scope until Phase 6 (Accounting
   depth), consistent with the existing roadmap in `PHASES.md`. Until then,
   base-currency-converted amounts on invoices/payments are enough for
   correct reporting without needing double-entry postings.
4. Do not add a live-rates external API without approval (§38 of the
   master rules) — a rate is just a number a user/accountant enters at
   transaction time (as `purchase_orders.exchange_rate` already does); no
   paid service is required for this to work correctly.

---

## 9. Multi-Language / Localization Architecture

**Current state:** no i18n code exists anywhere in the repository
(confirmed — a repo-wide case-insensitive search for `next-intl`, `i18n`,
`geolocation`, `x-forwarded-for`, `cf-ipcountry`, `accept-language` returned
zero files). This is an honest gap, not a partially-built feature.

**A related, more subtle finding:** every human-readable name in the
seeded catalogs — `role_templates.name`, `product_attribute_types.name`,
`business_capabilities.name` (all in `0011_seed_data.sql` /
`0031_business_capabilities.sql`) — is a single hardcoded English string
column. There is no per-locale name table. This needs to be corrected
*before* translation work starts, or every later translation effort has to
retrofit these catalogs.

**Recommended architecture**, based on 2026 Next.js App Router practice
([next-intl docs](https://next-intl.dev/docs/getting-started/app-router),
[Next.js i18n 2026 reality](https://sisl.pl/en/blog/nextjs-i18n-2026-app-router)):
`next-intl` is the de facto standard for this stack. Locale precedence
should be implemented exactly as the master rules specify — company
setting → user preference → transaction setting → browser
(`Accept-Language`) → IP suggestion — with the important architectural
point from the research: an explicit user choice is persisted (next-intl's
own pattern is a `NEXT_LOCALE` cookie) and always wins over any
subsequent browser/IP re-detection, so a returning user's choice is never
silently overwritten by a new detection on a later visit. Concretely:
`profiles.preferred_locale` (user, highest non-transaction priority) and
`tenant_settings.default_locale` (company) are the two new columns needed;
everything else is resolution logic, not schema.

Catalog translation (role/attribute/capability names) should move to a
`(table, code, locale) → translated_name` lookup table rather than adding
a column per language — this is additive and doesn't touch the existing
`code` values anywhere they're referenced (permissions, RLS, `has_permission`
calls all key off `code`/`resource`/`action` strings, never off `name`, so
this is a safe, isolated change when it happens).

---

## 10. IP-Based Locale Detection Strategy

Research confirms MaxMind GeoLite2 and Cloudflare's `CF-IPCountry` header as
the standard free options
([Linkly — Free GeoIP Databases](https://linklyhq.com/blog/free-geoip-databases),
[Cloudflare Community — Geolocation Accuracy](https://community.cloudflare.com/t/geolocation-accuracy/21756)).
**But this project's actual deployment target is Vercel, not Cloudflare**
(per the existing project setup) — and Vercel's own edge network already
injects geolocation headers (`x-vercel-ip-country`, `x-vercel-ip-country-region`,
`x-vercel-ip-city`) on every request at zero cost and zero external
dependency when deployed there. This is a better fit than adding MaxMind or
any third-party geolocation service: it requires no API key, no database
download/update cycle, no additional network call, and no paid tier —
directly satisfying the master rule against unnecessary external services
(§38). Recommendation: read Vercel's geolocation headers server-side (in a
Server Component or the existing `proxy.ts`) as the IP-suggestion input;
fall back to no suggestion at all in local dev (where those headers aren't
present) rather than adding a database/API dependency just to make dev
parity perfect — reliability and graceful degradation matter more here than
a fully-populated dev environment, per the master rule "If IP detection
fails, Stonevora must continue normally."

**Placement in the precedence chain:** IP suggestion only ever fires (a) on
first visit before any explicit setting exists, and (b) purely as a
*suggested* default the user can accept or change — never as a silent
override of an existing `tenant_settings.default_locale`,
`profiles.preferred_locale`, or an explicit currency/locale chosen during
signup. This satisfies the master rule verbatim ("IP detection must NEVER
override explicit company/user settings").

**Privacy:** country-level-only detection (no city/precise geolocation is
needed for currency/language suggestion) minimizes what's collected; Vercel
headers are derived server-side per-request and are not stored — no new
persistent PII is introduced by this design.

---

## 11. Security Findings

Live-verified this session (via direct SQL against the real project, not
assumed):

- **RLS coverage: 45/45 tables in `public` have `relrowsecurity = true`**
  (checked via `pg_class`), including every Phase 0, Phase 1, and
  business-capability table. No regression.
- **`is_tenant_member` + `has_permission` pattern is intact** and was
  correctly applied, unmodified, to the new `tenant_capabilities` table —
  confirmed live last session (owner can toggle, salesperson blocked by
  RLS with a real policy-violation error, a genuinely unrelated tenant
  sees zero rows of another tenant's capabilities).
- **Cost/margin redaction** (`products_secure`, `sales_invoice_lines_secure`)
  is unchanged and was not touched by this audit.
- **Gap — branch isolation is schema-present but not enforced.**
  `user_roles.branch_id` (`0004_roles_permissions.sql`, comment: "optional:
  scope a role to one branch") is never referenced by `has_permission()`
  (confirmed by reading its full body — the function only joins on
  `tenant_id`) and never referenced by any RLS policy on any
  branch-scoped table (`branches`, `warehouses`, `purchase_orders`,
  `sales_orders`, etc. — confirmed by grep across `0023_phase1_rls.sql`).
  A user with, say, `sales_manager` scoped to Branch A can today read and
  act on Branch B's sales orders through the exact same RLS policy that
  correctly stops them from touching a *different tenant's* data. This
  does not affect any tenant using a single branch (the majority of small
  shops in scope), but it is a real, direct violation of the master rule
  "Branch restrictions must be enforced at the database/security layer"
  for any multi-branch tenant today. **Recommended before (or alongside)
  Multi-Branch is meaningfully used**, not before Block/Slab specifically.
- **Security advisor:** re-ran after the capability migration; the only
  findings are pre-existing WARNs that every Phase 1 integrity RPC is
  callable by `authenticated` — intentional, since access is gated by the
  `has_permission()` check inside each function body (the standard pattern
  for this codebase, not a new or overlooked issue).
- **No client-side-only authorization found.** Every gate that matters
  (cost/margin visibility, capability toggling, RPC execution) is enforced
  by RLS or an explicit `has_permission()` check inside a `SECURITY
  DEFINER` function — consistent with the master rule "client-side hiding
  is not security."

---

## 12. Database Findings

**Migration hygiene:** 31 migrations, `0001`→`0031`, strictly incremental —
no resets, no destructive rewrites, no deleted files (confirmed by listing
`supabase/migrations/`). Several are explicit, well-documented bug fixes on
top of earlier ones (`0015`/`0016` audit trigger fixes, `0029`/`0030` Phase 1
fixes) rather than silently rewritten originals — this is the right pattern
and should continue (a future Block/Slab fix should be its own numbered
migration, never an edit to an already-applied one).

**Reusable as-is (no redesign needed):**
- `uom` / `uom_conversions` — sound, general, needs population + application
  fixes, not a rewrite (§6).
- `product_lookup_values` / `product_attribute_types` — the right primitive
  for category-relevant, tenant-customizable attribute values; extend with
  §5's two additive tables rather than replacing it.
- `product_categories` — self-referential tree, already supports the
  taxonomy work in §4.
- `storage_locations` — the Zone/Row/Rack/Position hierarchy with a
  materialized `path` trigger is exactly the granular location model needed
  for slab-level put-away later.
- `inventory_units` — **already has** `unit_type` (block/slab/remnant),
  `parent_unit_id` (genealogy), `sequence_number`, `actual_area`,
  `qr_code_value`, `photo_url`, `cost`, `selling_price` (all added in
  `0017_inventory_unit_genealogy_and_caliber.sql`, specifically to avoid
  redesigning this table later). This is real, usable groundwork for
  Block/Slab — not something to rebuild.
- `inventory_batches` — has `batch_number`, `lot_number`, `shade_code`,
  `caliber_code` already; ready for Tile Manufacturing's batch/QC needs.
- `audit_trigger_fn()` / `audit_log` — generic, attach-by-trigger; Block/Slab
  tables just need the same trigger attached, no new infrastructure.
- Secure-view redaction pattern (`security_invoker` + `has_permission`
  case/when) — the template for any future cost-sensitive Block/Slab view
  (e.g., a `slab_cost_secure` view).
- `tenant_capabilities` — the gate Block/Slab work should sit behind.

**Missing (confirmed absent by direct search, not by assumption):**
- UOM conversion application in the transactional RPCs (§6/§7 — the most
  urgent).
- Category-to-attribute relevance mapping and numeric product attributes
  (§5).
- `exchange_rate` on the sales side; applied `exchange_rate` anywhere (§8).
- Any i18n/locale table or code (§9).
- **A `stock_transfers` table does not exist at all** — confirmed via
  repo-wide search for "transfer"; nothing in any migration models Location
  A → Transit → Location B. This is required before Multi-Branch/Multi-
  Godown can be used safely, independent of Block/Slab.
- Branch-scoped RLS enforcement (§11).
- No block/slab-specific tables yet (`inventory_units` is the *shared*
  paradigm table from Phase 0, not a factory-specific schema) — block
  intake, cutting/processing jobs, QC records, and cost-roll-up tables are
  all genuinely unbuilt, correctly, since Block/Slab hasn't started.

**Dangerous changes to avoid:** do not alter `inventory_units`' or
`inventory_batches`' existing column meanings — Block/Slab should *add*
columns/tables, not repurpose the Phase-0-designed ones, since
`unit_type`/`parent_unit_id` were deliberately shaped with this phase in
mind. Do not touch `confirm_sales_order`'s or `dispatch_delivery`'s
`unit`-tracking-mode rejection branch as anything other than the seam where
Block/Slab's own reservation/dispatch logic will eventually plug in.

---

## 13. Phase 1 Regression Findings

**Scope of this check:** confirm Phase 1 is unmodified since its last
verified-complete state, not re-run its full integration test (which was
already executed live against real data in the Phase 1 completion session —
landed-cost math, oversell rejection, reservation/dispatch quantities, COGS
capture, and margin redaction all passed then, and nothing in Phase 1 has
changed since).

- `git status`/`git diff` for the business-capability commit (the only
  change since Phase 1 was verified) touched exactly: a new migration
  (`0031`), `actions/settings.ts` (additive function only), a settings page
  and one new component, `PHASES.md`, and regenerated types. **Zero Phase 1
  migration, RLS policy, or RPC file was touched.**
- RLS is still enabled on every Phase 1 table (§11 — same query covers both).
- Security advisor shows no new findings beyond the pre-existing,
  intentional ones.
- `npx tsc --noEmit`, `npm run lint`, and `npm run build` all pass clean as
  of this session (re-run during this audit to confirm nothing regressed;
  output: zero errors, all 31 routes including every Phase 1 route still
  compile and generate).

**What was not re-executed:** the live SQL simulation of the full
Supplier→PO→GRN→SO→Delivery→Invoice→Payment flow was not re-run in this
session, since no code that flow depends on changed. Stating this
explicitly per the standing rule against claiming an untested thing was
tested.

---

## 14. Factory Readiness

Answering the audit's specific question — is the architecture ready for
Block → Processing → Slabs → QC → Remnants/Waste → Cost Roll-up:

**Ready:**
- `inventory_units` schema (genealogy, dimensions, area, QR, cost) exists
  and needs no redesign to start.
- `storage_locations` hierarchy is granular enough for yard/processing-area
  put-away.
- `audit_trigger_fn`, secure-view redaction, and `has_permission`/RLS
  patterns are all reusable without modification.
- `tenant_capabilities.block_slab_factory` exists as the gate to build
  behind.
- Landed-cost allocation logic in `post_goods_receipt` (value/quantity
  basis) is the right pattern to extend for allocating a block's purchase
  + freight cost across its resulting slabs, once cutting/yield is known.

**Not ready — genuine gaps, in priority order:**
1. **UOM conversion is not applied anywhere in the transactional path**
   (§6/§7). Block/Slab will immediately need block volume (m³) → slab count
   → slab area (sqft/sqm) conversions; building that on top of RPCs that
   don't convert units at all would bake the defect deeper rather than
   fixing it. **This should be fixed first, as its own task.**
2. No cutting/processing job table exists (block in, N slabs + waste
   percentage out) — needs its own schema, and its own atomic
   `SECURITY DEFINER` function following the exact pattern of
   `post_goods_receipt`/`dispatch_delivery` (validate → mutate → never
   partial on failure).
3. No QC gate/record exists — needs a status field and gate check before a
   slab can move to `available` inventory status, per the inventory-
   integrity states the master rules require (on-hand/reserved/available/
   processing/finished/waste/remnant) — `inventory_units.status` exists as
   a free-text column today (`'in_stock'` default) and should become an
   enum mirroring exactly those states before Block/Slab starts writing to
   it, so "processing"/"waste"/"remnant" aren't invented ad hoc per feature.
4. No yield/waste/cost-roll-up calculation exists yet — straightforward to
   add once (1) is fixed, since it's the same weighted-allocation shape as
   landed cost.
5. `confirm_sales_order`/`dispatch_delivery`'s `unit`-tracking-mode
   rejection is a deliberate placeholder (`'not yet available'`), not a bug
   — it's exactly where Block/Slab's slab-level reservation/dispatch logic
   plugs in later.

**Bottom line: architecturally ready to start, but only after the UOM
conversion gap (§6) is closed — starting Block/Slab first would mean
building volume/area/count conversions on the one part of the system
already known to skip conversion entirely.**

---

## 15. Recommended Next Steps

In order, each its own scoped, tested, reviewed task — not bundled:

1. **Fix UOM conversion in the Phase 1 transactional RPCs** (§6/§7). Highest
   priority: it's a live defect today, not just a factory prerequisite.
   Small, well-bounded, testable in isolation with the existing
   `phase1-trading-flow.test.ts` pattern (add a case that receives/sells in
   a non-base UOM and asserts the converted quantity).
2. **Enforce branch scoping** in `has_permission()`/RLS for tenants that use
   more than one branch (§11) — needed before Multi-Branch is a real
   capability, independent of Block/Slab.
3. **Category-attribute template + numeric product attributes** (§5) — low
   risk, additive, unblocks a clean tile/marble/factory product form
   without a `products` table rewrite.
4. **`stock_transfers` module** (§3) — needed for Multi-Branch/Multi-Godown
   businesses regardless of Block/Slab.
5. **Only then: Block/Slab Factory**, starting with the category/attribute
   work already done, `inventory_units.status` becoming a proper enum, and
   the block-intake → cutting/processing job as its own atomic RPC,
   following the exact validate-then-mutate pattern of
   `post_goods_receipt`.
6. Multi-currency completion (§8), localization (§9/§10), are correctly
   lower priority than the above — they don't block Block/Slab and can be
   scheduled independently whenever the user wants them.

This document does not authorize implementation of any of the above by
itself — per the task that requested it, work stops here until the next
implementation prompt selects which of these to act on.
