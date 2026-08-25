# Roadmap

Stonevora-ERP is being built step by step. Each phase is scoped, implemented, and
verified before the next begins.

- **Phase 0 — Foundation** ✅: multi-tenant core (tenants, branches,
  warehouses/storage locations), auth/roles/permissions, product master, universal
  UOM engine, country/currency/tax/fiscal-year config, audit trail infrastructure.
  Row-Level Security enforces tenant isolation at the database level. Public
  landing page.
- **Phase 1 — Trading/Distribution mode** ✅: Suppliers → Purchase Orders → Goods
  Receipts (with landed-cost allocation across lines by value/quantity basis and
  weighted-average cost) → Sales Orders (with a "never oversell" reservation
  guarantee against available stock) → Deliveries (dispatch, COGS capture) →
  Invoices (margin redacted per role) → Payments → Customer/Supplier ledgers.
  Not included yet (deferred, see below): Returns/Credit-Debit notes, manual stock
  adjustments, barcode/QR scanning UI, multi-currency invoicing.
- **Phase 1.x — deferred from Phase 1** (should-have, not yet built): Returns and
  Credit/Debit notes; manual stock adjustment workflow.
- **Business capability model** ✅: Stonevora is a configurable multi-business-profile
  platform, not a factory-only one. `business_capabilities` (global catalog) +
  `tenant_capabilities` (per-tenant junction, RLS-gated on `company_settings.edit`)
  let a tenant turn on only the operating modes it actually uses (Trading/
  Distribution, Wholesale/Dealer, Retail Shop, Showroom Reservation, Block/Slab
  Factory, Stone Fabrication, Tile Manufacturing, Multi-Branch/Multi-Godown) —
  reusing the existing global-catalog + tenant-junction pattern from the Phase 0
  product-attribute engine and the existing `company_settings` permission resource
  rather than adding new infrastructure. New tenants get Trading/Distribution
  (the only mode with real UI today) auto-enabled by `create_tenant_for_user`;
  every other capability is opt-in metadata via Settings → Business capabilities,
  and is marked "module UI not yet built" until its phase ships. This is the
  prerequisite the next phases build on, not a phase in itself.
- **Factory-Ready Foundation** ✅: four prerequisite fixes identified by
  `docs/PRE_FACTORY_ARCHITECTURE_AUDIT.md`, implemented and live-verified before
  any Block/Slab code:
  1. **UOM conversion engine wired in** — `convert_uom_quantity()` resolves a
     product-specific → tenant → global conversion factor and is now applied
     inside `post_goods_receipt`/`confirm_sales_order`/`dispatch_delivery`
     before any quantity touches `qty_on_hand`/`reserved_qty`. Fixes a real,
     live defect: receiving/selling in a non-base UOM (e.g. BOX against a
     PCS-tracked product) previously corrupted stock quantities silently.
     `base_quantity` columns on the affected line tables preserve the entered
     UOM alongside the converted amount.
  2. **Branch-level RLS enforcement** — `has_branch_access()` makes
     `user_roles.branch_id` (present since Phase 0 but never enforced) an
     actual database-layer restriction on every branch-scoped table
     (purchase/sales/GRN/delivery/invoice/payment headers+lines, warehouses).
     Backward compatible: a role with no branch scope keeps full access.
  3. **Category/attribute templates** — `category_attribute_templates` +
     `product_numeric_attributes`, additive tables reusing the existing
     lookup-value pattern; the `products` table itself was not rewritten.
  4. **Stock transfers** — `stock_transfers`/`stock_transfer_lines` with a
     draft → requested → in_transit → received/cancelled state machine,
     atomic `ship_stock_transfer`/`receive_stock_transfer`/
     `cancel_stock_transfer` RPCs, partial receipt, batch/lot/shade/caliber
     genealogy preserved across a transfer, and branch-aware RLS.
  Deferred, documented, not silently dropped: true per-row branch scoping of
  `inventory_stock`/`inventory_batches` (no `branch_id` column exists there;
  a bigger schema change than this task warranted), sales-side multi-currency
  completion, localization/IP-detection.
- **Phase 2 — Block/Slab Factory mode** (in progress, milestone by milestone;
  gated behind the `block_slab_factory` capability so it never surfaces for
  tenants that don't use it):
  - **Milestone 1 — Raw Block Intake** ✅: reuses the existing Supplier → PO →
    GRN workflow end to end (no separate intake pipeline) and the existing
    `inventory_units` table (its `unit_type`/`parent_unit_id`/genealogy/QR/cost
    columns from Phase 0 were built for exactly this). A unit-tracked GRN line
    must represent exactly one block (matching how quarry-block invoices are
    conventionally itemized per block, since size/grade vary block to block —
    this sidesteps inventing an equal-division cost split across several
    physically distinct blocks on one line). `post_goods_receipt` now creates
    a real `inventory_units` row per block: dimensions, weight, quarry source,
    supplier and GRN-line traceability, and a volume computed via exact
    physical unit-conversion constants (cm³→M3/CFT — math, not a business
    rule) into the tenant's chosen unit. The landed cost already computed by
    the existing per-line freight/duty/handling allocation becomes the
    block's `cost`; the original purchase `unit_cost` on the GRN line is left
    untouched (historical cost preserved, never overwritten). Enforced at the
    database layer, not just hidden in the UI: `has_capability()` rejects
    block intake outright if `block_slab_factory` isn't enabled for the
    tenant. Added the dimension/volume UOMs the catalog was missing (CM,
    INCH, MM, CFT, BLOCK) with exact conversions. `inventory_units.status`
    converted from free text to a real enum on its first-ever write.
    Live-verified: capability gate, quantity≠1 rejection, missing-field
    rejection, volume math (both CFT and M3, independently hand-verified),
    cost preservation, tenant isolation, and the full Phase 1 regression flow
    — zero Phase 0/Phase 1 files modified.
  - **Milestone 2 — Processing/Cutting** ✅: models the job wrapper around a
    block's cutting/squaring/polishing lifecycle (researched real gangsaw/
    multi-wire → squaring → polishing workflow), not yet the slab output
    itself (that's Milestone 3) or yield/waste (Milestone 4) — a job here only
    reaches `in_progress`/`cancelled`. New `processing_jobs` table (stage,
    machine, operator, status, start/complete/cancel timestamps) and a new
    `production` permission resource, added exactly like `purchasing`/`sales`
    were for their own domains. `start_processing_job`/`cancel_processing_job`
    are atomic, row-locked RPCs: starting moves the input block from
    `in_stock` to a new `'processing'` status (so it can't be double-consumed
    or incorrectly appear available) and the job to `in_progress`; cancelling
    an in-progress job restores the block to `in_stock`, mirroring
    `cancel_stock_transfer`'s "leave inventory exactly as it was" guarantee.
    Double-processing of the same block is blocked twice over: a partial
    unique index (`processing_jobs` on `input_unit_id` where status is draft/
    in_progress) prevents even creating a second active job at the schema
    level, and the RPC re-validates the block's live status under a row lock
    for concurrency safety.
    **A real security bug was found and fixed during this milestone's own
    live-database verification**: the first version of `start_processing_job`/
    `cancel_processing_job` checked `has_permission()`/`has_capability()` but
    never `has_branch_access()`. Because both are `SECURITY DEFINER`
    functions, `processing_jobs`' branch-scoped RLS policies do not apply
    inside their body — a user scoped only to Branch B was able to actually
    start/cancel a Branch A job outright (correctly blocked only from
    *seeing* it via a plain select), the same class of gap the Foundation
    Hardening work fixed for the transfer RPCs. Fixed in migration
    `0040_fix_processing_job_branch_scoping.sql` by adding the same explicit
    `has_branch_access(tenant_id, branch_id)` check every other branch-scoped
    integrity RPC already has; re-verified live afterward that the exact
    failing scenario now correctly rejects, that legitimate (unscoped-owner
    and same-branch) access still works, and that the capability gate and
    duplicate-active-job protections were unaffected by the fix.
  - Milestone 3 (Slab Output + Genealogy) onward: not started.
- **Phase 3 — Stone Fabrication/Projects mode**: project-based job costing
  consuming slabs, invoiced via Phase 1's engine.
- **Phase 4 — Tile Manufacturing mode**: recipes/BOM, batch production, shade/
  caliber/kiln attributes, batch-level QC.
- **Phase 5 — Showroom/Reservation mode**: reservation/hold workflow converting
  into Phase 1 sales orders.
- **Phase 6 — Accounting depth**: Chart of Accounts, double-entry ledger, P&L/
  balance sheet.
- **Phase 7 — QR/Mobile/barcode**: scanning flows for receiving, put-away,
  picking, and stocktake.
- **Phase 8 — Reporting/Dashboards**: cross-module analytics.
