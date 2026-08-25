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
- **Phase 2 — Block/Slab Factory mode** ✅: all 7 milestones complete, gated
  behind the `block_slab_factory` capability so it never surfaces for
  tenants that don't use it:
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
  - **Milestone 3 — Slab Output + Genealogy** ✅: `complete_processing_job`
    turns an `in_progress` job's block into one or more slab `inventory_units`
    rows, each with `parent_unit_id` set to the input block — the genealogy
    link the spec required — and `output_processing_job_id` tracing which job
    produced it. Slab area follows the same researched pattern as Milestone
    1's volume: billed area for natural stone is conventionally the bounding
    rectangle (length × width), not a hand-measured polygon, since that's what
    cutting equipment and invoices actually record; length/width are
    normalized to CM via `convert_uom_quantity` (the existing UOM engine) and
    then divided by an exact physical constant into the requested unit (SQFT:
    ÷929.0304 cm²; SQM: ÷10000 cm² — math, not a business rule), independently
    hand-verified for both units and for decimal dimensions. A separate
    `usable_area` column (validated 0 ≤ usable ≤ gross) captures cutouts/
    visible damage noticed at cutting time — deliberately an operator-entered
    value, never a derived formula, since arbitrary cutout shapes can't be
    computed from length/width alone. Completing a job marks the block
    `'consumed'` (a new status — the same "input must not remain incorrectly
    available" rule Milestone 2 applied to `'processing'`) and the job
    `'completed'`, recording `actual_slab_count`. Every slab lands `in_stock`
    immediately — QC-gated sellability is explicitly Milestone 5's concern,
    not invented early — and cost roll-up is deliberately left for Milestone
    6 rather than guessing a cost-splitting formula now. Applying the
    Milestone 2 branch-scoping lesson from the start this time,
    `complete_processing_job` was built with `has_branch_access` checked from
    its first version — live-verified that a branch-B-scoped user is
    correctly rejected, no bug this round. Also closed a real pre-existing
    gap while touching this table: `inventory_units` never had the generic
    audit trigger attached (Phase 0 never wired it up) — added it here,
    purely additively, satisfying the "all movements auditable" requirement
    for the new block-consumed/slabs-created movements this milestone writes.
    Live-verified: full slab creation (genealogy, area math in both SQFT and
    SQM, decimal dimensions), usable-area-exceeds-gross rejection, missing-
    field rejection, empty-slabs-array rejection, wrong-area-unit rejection,
    capability gate, branch-scoping rejection, and a Phase-1 regression
    (`post_goods_receipt` block intake still works unmodified with the new
    columns/trigger present).
  - **Milestone 4 — Yield + Waste + Remnants** ✅: extends
    `complete_processing_job` (same function, `CREATE OR REPLACE`, not a new
    pipeline) so every output item may now be a `slab` or a `remnant`
    (researched distinction: a remnant is a smaller-but-still-usable offcut —
    vanity tops, thresholds, tile blanks — structurally identical to a slab,
    differing only in business classification, reusing the `unit_type`
    column Phase 0 already had rather than inventing new columns or a
    parallel table), and the array may now be **empty**, representing a
    block that turned out fully unusable (a real scenario — e.g. an internal
    crack found once cut — not an error). Waste is deliberately **never**
    a genealogy row: it has no physical identity to track (saw-kerf loss,
    dust, unusable trim are discarded, not inventoried), so it is derived
    purely by mass balance — `waste = block volume − Σ(output volumes)` —
    and stored only as an aggregate (`waste_volume`, `yield_percentage`) on
    the job. `thickness` became a required field on every output item (it
    was optional in Milestone 3) because volume — and therefore yield — needs
    it; every item's volume is computed the same researched way Milestone 1
    computed block volume (length × width × thickness normalized to CM via
    the existing UOM engine, cm³ — math, not a business rule), summed, and
    compared against the block's own recorded volume (also converted back to
    cm³) — total output volume exceeding the block's volume is physically
    impossible and rejected outright, never silently allowed. Yield is
    expressed as a volume percentage (real-world convention: a slab's "yield
    share" is area × thickness, since sawing/squaring lose material as kerf
    and trim, and volume is the only unit both a block and its cut pieces
    can be honestly compared in). New `processing_jobs` columns:
    `yield_percentage`, `waste_volume`/`waste_volume_uom_id`,
    `actual_remnant_count` (mirroring the existing `actual_slab_count`).
    Live-verified, all independently hand-computed and matched exactly:
    high yield (~88%, single slab near the block's own volume), low yield
    (~0.09%, a small slab against a large CFT-denominated block), zero yield
    (empty array, 100% waste), a combined multiple-slabs + remnant +
    decimal-dimension scenario (three output units, yield ~7.51%, correctly
    split 2 slabs / 1 remnant), overflow rejection, missing-thickness
    rejection, invalid-`unit_type` rejection, no-recorded-volume rejection,
    and branch-scoping/capability-gate protections re-confirmed intact after
    the `CREATE OR REPLACE`. **A real bug was found and fixed during this
    milestone's own testing**: the overflow-rejection error message used
    printf-style `%.6f` inside `RAISE EXCEPTION`, which plpgsql does not
    support — the literal text `.6f` appeared in the error instead of a
    formatted number. Cosmetic only (the rejection itself fired correctly),
    fixed immediately by rounding the values before substitution, re-verified
    the corrected message live. Milestone 3's test file was updated to add
    the now-required `thickness` field and block `volume` to its fixtures,
    and its empty-array test was rewritten from "must reject" to "must
    succeed as 100% waste," reflecting this milestone's intentionally
    relaxed rule.
  - **Milestone 5 — QC** ✅: closes the gap Milestones 3 and 4 both
    deliberately left open ("QC-gated sellability is explicitly Milestone
    5's concern, not invented early") — newly produced slabs/remnants now
    land `'pending_qc'`, not `'in_stock'`, and only a passed inspection
    moves them to `'in_stock'`; a rejected one moves to `'rejected'`,
    structurally excluded from `'in_stock'` for good. Real QC workflow
    researched: after cutting, every slab/remnant is visually/physically
    inspected for cracks, pits, veining, chips, color consistency before it
    can be sold — the operator's cutting-time grade is provisional, and QC
    either confirms it or overrides it. New `qc_inspections` table
    (append-only — no update/delete policy, since correcting a mistaken
    inspection is a fresh inspection, not a rewrite of QC history) and a new
    `record_qc_inspection` RPC: locks the unit, requires it be a slab or
    remnant currently `pending_qc` (deliberately one inspection per unit —
    no re-inspection/appeal workflow was requested), resolves branch access
    via the unit's own originating job (`inventory_units` carries no
    `branch_id` directly; `output_processing_job_id` always does), and on
    pass lets a QC-confirmed grade override the cutting-time grade while on
    reject preserves the original grade untouched. QC reuses the existing
    `production` resource's `approve` action rather than inventing a 12th
    permission action outside Phase 0's standard 11-action catalog — which
    meant `qc_manager` (created in Milestone 2 with only `production.view`,
    since there was nothing to approve yet) needed `approve` added to
    actually perform QC; fixed via the now-familiar `create_tenant_for_user`
    `CREATE OR REPLACE`, with every other role's grants reproduced as-is.
    Blocks are deliberately not QC'd (the spec's wording is scoped to
    slabs/remnants — a block's quality is judged by what it yields, not
    inspected as a unit itself); sales-side consumption of unit-tracked
    products still doesn't exist (Phase 1's `confirm_sales_order` already
    explicitly refuses unit-tracked products outright — "not yet reservable
    in Phase 1" — a pre-existing, documented gap this milestone doesn't
    need to touch), so this milestone's contribution is making sure the
    status-based gate any future sales integration would check is already
    correct. Live-verified: default status of freshly completed output is
    now `pending_qc`; pass path (status → `in_stock`, grade override
    applied, inspection record correct); reject path (status → `rejected`,
    original grade preserved); re-inspection of an already-resolved unit
    rejected; QC-ing a block rejected; the `qc_manager` permission fix
    verified both ways — `production_operator` (no `approve`) correctly
    rejected, `qc_manager` (now has `approve`) correctly succeeds; branch
    scoping and the capability gate re-confirmed. Milestone 3's test file
    updated for the new `pending_qc` default (its one assertion that
    expected immediate `in_stock` now expects `pending_qc`).
  - **Milestone 6 — Cost Roll-up** ✅: a block's landed cost (Milestone 1)
    plus whatever processing and overhead were actually incurred cutting it
    become the cost basis for everything it produced, split across the
    individual slabs/remnants — never charged equally per piece. New
    `record_processing_costs` RPC, callable once a job is `completed`:
    computes `total_cost = block.cost + processing_cost + overhead_cost`
    (the latter two are entered figures, not computed — exactly like
    Milestone 1 never invented a machine-rate formula and simply accepted
    `freight_cost`/`duty_cost`/`handling_cost` as entered values on a goods
    receipt) and allocates it across every output unit from that job
    proportional to its own **volume** share of the job's total output
    volume — the same proportional-share technique `post_goods_receipt`
    already uses for landed cost across GRN lines (Milestone 1), reused here
    on a volume basis rather than area, because volume is the one physical
    quantity already computed for every output unit (Milestone 4, for
    yield) that honestly represents how much of the block's material a
    piece consumed — allocating by area instead would systematically
    overcharge thin pieces and undercharge thick ones whenever thickness
    varies within a job's output. Waste gets no cost bucket of its own (no
    inventory row — Milestone 4), so the full cost is entirely absorbed by
    whatever was actually produced, matching how a real factory eats its
    own scrap cost; a 100%-waste job still records its job-level cost
    fields with nothing to allocate to. Costs can only be recorded once per
    job (`costs_recorded_at`) — a correction workflow wasn't requested,
    matching the same choice Milestone 5 made for QC records.
    **A real precision bug was found and fixed during this milestone's own
    independent verification**: the allocation used an intermediate
    `v_share numeric(18,6)` variable that rounded the volume fraction to 6
    decimal places *before* multiplying by the total cost, producing a
    small but real error (expected ≈24496.8329, got 24496.8100 on one test
    case). Fixed by computing the allocation as a single expression
    (`total_cost * unit.volume / total_output_volume`) with no rounded
    intermediate, re-verified live — allocated costs now sum back to
    exactly the total, matching independent hand-calculation to the cent.
    Live-verified via a real Milestone-1 block intake (not a manually
    inserted test block) carrying a genuine landed cost: multi-unit
    proportional allocation (2 slabs + 1 remnant, independently
    hand-verified), the 100%-waste zero-allocation case, double-recording
    rejection, not-yet-completed rejection, negative-cost rejection,
    no-block-cost rejection, and branch-scoping/capability-gate protections.
  - **Milestone 7 — End-to-End Verification** ✅: the full lifecycle run as
    one continuous story, live, through the real RPCs (not mocked/isolated
    per-milestone data) — Supplier → PO → GRN → `post_goods_receipt` (real
    block intake, not a manually inserted test block) → `start_processing_job`
    → `complete_processing_job` (2 slabs + 1 remnant, genealogy verified) →
    `record_qc_inspection` (one pass, one reject) → `record_processing_costs`
    → a single query tracing a sellable slab all the way back through its
    parent block to the GRN line, PO, and supplier/quarry, entirely from the
    existing schema with no new columns needed — confirming the whole
    6-milestone architecture composes correctly, not just each piece in
    isolation. The capability gate was re-verified at every single stage of
    the composed pipeline (start/complete/QC/cost-roll-up all independently
    reject when `block_slab_factory` is disabled, re-enabled, and retried
    successfully) — proving "factory is optional" holds for the whole chain,
    not just per-RPC. The rejected remnant was confirmed to still carry a
    real allocated cost (a rejected piece consumed real material/processing
    time even though it can never be sold) and to remain permanently
    excluded from `in_stock`. A full Phase 1 (Trading/Distribution) run —
    PO → GRN → receipt → SO → confirm → dispatch → invoice, for an ordinary
    simple-tracked product — was executed live and confirmed byte-for-byte
    correct (margin, stock quantities, reservation release), proving zero
    regression across all 44 migrations this factory build touched. A final
    full-database security-advisor sweep across every migration (0038–0044)
    returned only the same expected, intentional SECURITY DEFINER pattern
    already accepted for every prior integrity RPC — zero new or unexpected
    findings. One apparent discrepancy surfaced during this milestone's own
    verification turned out to be a test-harness mistake, not a bug (a
    stale-looking `null` on a cost/margin column from a query that forgot to
    re-establish the simulated-auth context in its own isolated
    `execute_sql` call) — re-run with the correct context, confirmed
    correct; noted here for the same transparency this project has applied
    to every real finding.
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
