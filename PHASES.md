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
- **Phase 1.x — deferred from Phase 1** ✅: Returns/Credit-Debit notes and a
  manual stock adjustment workflow, both always-on (no capability gate,
  matching Phase 1's own scope). Economy decision: a **posted**
  `sales_return`/`purchase_return` row **is** the credit/debit note — no
  separate document-type table — the same pattern this codebase already
  used for "a quotation is a sales order in draft status" (0020_sales.sql).
  New `stock_adjustments`/`sales_returns`/`purchase_returns` (+ line) tables;
  `sales_invoice_lines.returned_quantity`/`goods_receipt_lines
  .returned_quantity` track cumulative returns the same way
  `purchase_order_lines.received_quantity`/`sales_order_lines
  .delivered_quantity` already track cumulative fulfillment. Three RPCs:
  `post_stock_adjustment` (blends a caller-entered `unit_cost` into the
  existing weighted average on increase — never invented, never defaulted
  to the current average, matching every prior costing milestone —
  straight decrement on decrease, validated against `qty_on_hand -
  reserved_qty`), `post_sales_return` (validates against the invoice line's
  own cumulative `returned_quantity`, restocks via the exact same
  weighted-average blend `post_goods_receipt` uses because a restock *is* a
  receipt of previously-sold goods, when `restock = true`), `post_purchase_return`
  (the mirror image — decrements stock with no cost blend, matching
  `dispatch_delivery`'s own plain decrement, validated against both
  available stock and the GRN line's cumulative `returned_quantity`).
  `customer_ledger`/`supplier_ledger` (0026) are extended to include posted
  returns as negative entries — the exact mechanism by which a credit/debit
  note offsets what's owed, reusing the same sign convention payments
  already use, rather than inventing a separate allocation workflow (an
  explicitly documented boundary, not silently dropped). A new
  `sales_return_lines_secure` view mirrors `sales_invoice_lines_secure`'s
  cost/margin redaction exactly. No new permission resource: sales/purchase
  returns reuse the existing `sales`/`purchasing` resources (a return is
  just another sales/purchasing-side transaction); stock adjustments reuse
  `warehouse` (`inventory_manager`/`warehouse_staff` already hold this
  grant) — no `create_tenant_for_user` role-wiring changes needed.
  Unit-tracked (block/slab) products are explicitly out of scope for both
  returns and adjustments, for the same reason `confirm_sales_order`
  already rejects them in Phase 1, and because Factory/Stone Fabrication
  already have their own QC-driven status machine for "this piece turned
  out bad."
  **Applying the branch-scoping lesson proactively** (as Phase 3 also did):
  all three RPCs got `has_branch_access()` checks in their bodies from
  their first version — no exploit needed to be found and patched this
  time. Live-verified: full
  sales-return lifecycle (post, restock, cumulative-quantity tracking,
  ledger entry, margin redaction), full purchase-return lifecycle (post,
  decrement, cumulative-quantity tracking, ledger entry), over-return
  rejection on both sides, insufficient-stock rejection on both sides,
  stock-adjustment lifecycle (simple + batch-tracked cost blending on
  increase, plain decrement, missing-`unit_cost` rejection,
  insufficient-stock rejection, unit-tracked-product rejection), branch
  scoping on all three RPCs, and permission-denial on all three RPCs
  (salesperson blocked from `warehouse.edit`/`purchasing.edit`,
  warehouse_staff blocked from `sales.edit`). Full regression confirmed for
  Phase 1's own `post_goods_receipt`/`confirm_sales_order`/
  `dispatch_delivery`/`generate_sales_invoice_from_delivery` throughout
  this phase's own test setup.
- **Phase 1 security fix (migration 0045)** ✅: a real, exploitable
  branch-scoping gap found incidentally while researching Phase 3's own
  invoicing RPC (looking for the branch-check precedent to match).
  Migration 0033 (Factory-Ready Foundation, Branch-level RLS) added
  `has_branch_access()` to every purchasing/sales *table's* RLS policy, but
  never propagated the same check into the four `SECURITY DEFINER`
  integrity functions that actually perform the state-changing writes on
  those tables: `post_goods_receipt`, `confirm_sales_order`,
  `dispatch_delivery`, `generate_sales_invoice_from_delivery`. Exactly the
  same bug class Factory Milestone 2 found and fixed for
  `start_processing_job`/`cancel_processing_job` (migration 0040): a
  `SECURITY DEFINER` function's own body bypasses RLS entirely on the
  tables it touches, so relying on the table policy is not sufficient — the
  function itself must re-check branch access explicitly. **Live-reproduced
  before fixing**: a user scoped only to Branch B could not see a Branch-A
  goods receipt via a plain `select` (RLS correctly hid it), but calling
  `post_goods_receipt(<branch-A-receipt-id>)` directly succeeded outright —
  fully posted it (`status` → `'posted'`, real stock created) — proving the
  read-side RLS gave no protection at all against the write-side RPC.
  Fixed by inserting one `has_branch_access` check into each of the four
  functions (byte-for-byte identical bodies otherwise); all four
  re-verified live on fresh test data, each showing both a correctly
  rejected Branch-B-scoped caller and an unaffected legitimate
  (unrestricted) caller. Automated regression coverage added in
  `tests/rls/phase1-branch-scoping.test.ts`.
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
- **Phase 3 — Stone Fabrication/Projects mode** ✅ (optional capability:
  `stone_fabrication`, already present in the capability catalog since Phase 0
  — no new capability row needed): project-based job costing that consumes
  finished slabs/remnants from Phase 2's Factory (or received directly) into
  a customer project alongside labor/overhead, then invoices by **area**
  (sqft/sqm) — the universal countertop-industry billing convention —
  through Phase 1's own invoicing tables (`sales_invoices`/
  `sales_invoice_lines`), exactly as the roadmap specified, rather than a
  parallel billing engine. New `projects` (branch-scoped header) +
  `project_materials` (join table: which `inventory_units` a project
  consumed) tables; `inventory_units.consumed_by_project_id` mirrors the
  existing `output_processing_job_id` column shape (Milestone 4) so a
  slab's full life — GRN line → block → processing job → slab → project —
  stays a plain foreign-key walk, live-verified end to end. Status is
  deliberately just draft/completed/cancelled (no separate in_progress
  state — a fabrication job's day-to-day cutting/polishing work isn't
  itself a database transaction this system needs to track, unlike
  Factory's `processing_jobs`). Five new RPCs: `add_project_material`/
  `remove_project_material` (consumes/releases a slab or remnant, requiring
  `in_stock` status and a recorded cost — mirroring Milestone 6's precedent
  of never treating an uncosted unit as free — and maintaining a live
  running `material_cost`), `complete_project` (locks entered
  `labor_cost`/`overhead_cost`, `total_cost = material_cost + labor_cost +
  overhead_cost` — the same never-invented-figures discipline as every
  prior costing milestone), `cancel_project` (releases every consumed
  material back to `in_stock`, blocked once completed), and
  `generate_project_invoice` (bills by each unit's own `actual_area`/
  `area_uom_id`, caller-supplied `unit_price` per material — never invented
  — with `unit_cost` computed as the project's locked `total_cost` spread
  flat across its total consumed area; this is Milestone 6's
  proportional-by-area allocation, which collapses to a flat rate because
  every unit of area shares the same job cost pool by definition). New
  `project` permission resource (11 standard actions, matching
  `purchasing`/`sales`): `sales_manager` gets the same full grant shape as
  their existing `sales` resource; `factory_manager`/`production_manager`
  get view/create/edit only — **deliberately excluded from
  `generate_project_invoice`**, which also requires `sales`.`create`
  (needed for the RLS insert on `sales_invoices` regardless), enforcing a
  real separation of duties between production and billing — live-verified:
  a factory-manager-only user successfully added materials to and completed
  a project, then was correctly rejected invoicing it.
  **Applying the lesson found twice already** (Factory Milestone 2's
  `start_processing_job`/`cancel_processing_job`, migration 0040; the
  Phase 1 branch-scoping gap discovered during this phase's own research,
  migration 0045): every one of these five RPCs got its
  `has_branch_access()` check from its first version, in the body, from the
  start — not bolted on after a live exploit a third time. Live-verified
  the full lifecycle (multi-material project, add/remove materials,
  complete with labor/overhead, invoice by area, full traceability from
  project back through slab/job/block to GRN line/supplier/quarry via plain
  joins), every rejection path (wrong unit type, non-`in_stock` unit,
  uncosted unit, double-consumption, capability gate, branch scoping on all
  four mutating RPCs, missing permission, double-invoicing, missing
  `unit_price`), and margin redaction on `sales_invoice_lines_secure`.
  **A real schema bug was found and fixed during this phase's own
  verification**: `projects.tenant_id`/`project_materials.tenant_id` were
  created without `on delete cascade`, inconsistent with every other
  tenant-scoped table's convention — caught when this phase's own test-data
  cleanup failed a tenant delete on a leftover `projects` row; fixed via a
  follow-up migration matching the established FK convention, re-verified
  by re-running the same cleanup successfully. Full regression confirmed
  for Phase 1 (repeated live `post_goods_receipt` calls) and Phase 2
  (repeated live `start_processing_job`/`complete_processing_job`/
  `record_qc_inspection`/`record_processing_costs` calls) throughout this
  phase's own test setup.
- **Phase 4 — Tile Manufacturing mode** ✅ (optional capability:
  `tile_manufacturing`, already present in the capability catalog since Phase 0
  — no new capability row needed): recipe-driven batch production. A tile
  factory holds a bill of materials (recipe) per finished tile product —
  fixed raw-material quantities per a fixed output quantity — and runs a
  production batch that consumes those raw materials, fires the kiln, and
  produces a shade/caliber-graded **batch** of finished tiles (not
  individually serialized pieces like Factory's slabs — tiles are the
  textbook case Phase 0's `batch` inventory paradigm was built for). New
  `bill_of_materials`/`bill_of_materials_lines` (recipe; reuses the
  `product` permission resource with no branch scoping, exactly like
  `category_attribute_templates`, since a recipe is product-master data,
  not a transaction) and `production_batches`/`production_batch_consumptions`
  (the job; reuses `production`, exactly like Factory's `processing_jobs`)
  tables. **Batch-level QC gate**, mirroring Factory Milestone 5's
  unit-level gate exactly: `inventory_batches` gains a `status` enum column
  (`pending_qc`/`in_stock`/`rejected`, defaulting to `in_stock` so every
  existing batch-tracked flow — ordinary GRN receipts, Phase 1.x
  adjustments/returns — is completely unaffected), and `confirm_sales_order`
  is patched to only ever reserve/count `in_stock` batches, so a
  newly-produced, not-yet-inspected or rejected batch structurally cannot be
  sold. `qc_inspections` (0043) is reused for batch QC rather than a
  parallel table (a nullable `inventory_unit_id` + new `inventory_batch_id`
  with an exactly-one-subject check constraint), and
  `record_batch_qc_inspection` derives branch access via
  `inventory_batches.output_production_batch_id → production_batches
  .branch_id` — the same reverse-lookup shape `record_qc_inspection`
  already uses via `output_processing_job_id`, since `inventory_batches`
  carries no `branch_id` of its own. Four new RPCs:
  `start_production_batch` (consumes every BOM line's raw material, scaled
  by `planned_output_quantity / bom.output_quantity`, via the same
  FIFO-style consumption loops `confirm_sales_order`/`dispatch_delivery`
  already use for simple/batch-tracked stock — batch-tracked raw materials
  must themselves be `in_stock`; rejects unit-tracked raw materials, an
  inactive BOM, and insufficient stock), `complete_production_batch`
  (creates the finished-goods `inventory_batches` row at `pending_qc`,
  requiring a caller-supplied `p_output_location_id` validated against the
  batch's own warehouse — necessary because `confirm_sales_order`'s
  batch-tracked branch `INNER JOIN`s `storage_locations`, so a null
  `current_location_id` would make the batch permanently unsellable;
  `total_cost = raw_material_cost` (locked at start) `+` caller-entered
  `labor_cost/overhead_cost` — never invented, matching every prior costing
  milestone; rejects a non-batch-tracked finished product and a
  wrong-warehouse output location), `cancel_production_batch` (a `draft`
  batch releases nothing; an `in_progress` batch's raw materials are
  already consumed and — a real, deliberate domain difference from
  Factory, where the block stays physically whole until cutting — cannot
  be un-mixed, so cancelling records a genuine, permanent cost loss rather
  than silently reversing it; no `has_capability` check, matching
  `cancel_processing_job`'s own precedent exactly), and
  `record_batch_qc_inspection` (`passed` → `in_stock`, anything else →
  `rejected`; a rejected batch keeps its cost and quantity — the raw
  material really was consumed — it just never counts as available stock).
  **Applying the branch-scoping lesson proactively** (as Phase 3 and Phase
  1.x also did): all four RPCs got `has_branch_access()` checks in their
  bodies from their first version — no exploit needed to be found and
  patched this time.
  **A real bug was found and fixed during this phase's own verification**:
  `record_batch_qc_inspection`'s status update —
  `case when p_outcome = 'passed' then 'in_stock' else 'rejected' end` —
  failed live with `column "status" is of type inventory_batch_status but
  expression is of type text`, because Postgres infers an untyped `CASE`
  string literal as `text`, which cannot be implicitly assigned to an enum
  column. Fixed with an explicit `::inventory_batch_status` cast on the
  `CASE` expression; re-verified live (the same QC-pass call that had
  failed now correctly flipped the batch to `in_stock`) before the
  migration was ever committed.
  Live-verified: the full golden path (BOM-scaled consumption — 200 kg
  clay × $2 + 20 kg glaze × $5 = exactly 500.0000 raw-material cost;
  cost roll-up — (500 + 50 labor + 20 overhead) / 10 = exactly 57.0000
  cost/SQM; simple-tracked and batch-tracked raw-material stock decrements
  both exact), the QC gate proven **both ways** on live data (a
  `pending_qc` batch correctly invisible to `confirm_sales_order`, 0
  available; after a passed inspection the same batch correctly becomes
  `in_stock`, and the sales order that had failed now confirms and
  reserves exactly the ordered quantity; a separate rejected batch
  permanently excluded from availability), `cancel_production_batch` for
  both `draft` (trivial) and `in_progress` (no restoration, confirmed by
  stock levels unchanged) states, branch-scoping rejection on all four
  RPCs, permission-denial rejection on all four RPCs (`production.edit`
  for start/complete/cancel, `production.approve` for QC inspection), the
  capability gate on the three RPCs that check it (confirmed
  `cancel_production_batch` deliberately does not), and every remaining
  rejection path (inactive BOM, insufficient raw-material stock,
  unit-tracked raw material, wrong-warehouse output location,
  non-batch-tracked finished product). Full regression confirmed: every
  pre-existing `inventory_batches` row retained its backward-compatible
  `in_stock` default (zero nulls), and Phase 1's `confirm_sales_order`
  path is unaffected for non-batch-tracked products (the new `status`
  filter only touches the batch-tracked branch). Automated regression
  coverage added in `tests/rls/phase4-tile-manufacturing.test.ts`, mirroring
  every live-verified path above.
- **Phase 5 — Showroom/Reservation mode**: reservation/hold workflow converting
  into Phase 1 sales orders.
- **Phase 6 — Accounting depth**: Chart of Accounts, double-entry ledger, P&L/
  balance sheet.
- **Phase 7 — QR/Mobile/barcode**: scanning flows for receiving, put-away,
  picking, and stocktake.
- **Phase 8 — Reporting/Dashboards**: cross-module analytics.
- **Phase 9 — Offline-first + Desktop + Mobile + SEO** (deferred until every
  functional phase above is complete; decisions locked in with the user so
  this doesn't need re-litigating later):
  - **Desktop**: Tauri (not Electron) — lighter, lower resource use, and
    explicitly chosen for genuine offline operation, not just a browser
    shortcut.
  - **Mobile**: Capacitor wrapper around the same Next.js app, published to
    Play Store (not a bare PWA install, not a separate React Native
    codebase). Explicit user requirement, verbatim concern: the mobile
    experience must be properly responsive, not "the desktop layout just
    doesn't fit on a small screen" — every screen needs a real mobile-first
    pass (tables/wide layouts in particular), not merely wrapped.
  - **Offline scope**: full offline-first — data entry (invoices, orders,
    GRNs, etc.) must work with no connectivity at all, syncing to Supabase
    once back online. This is the deep, hard version (local database +
    background sync + conflict handling), explicitly chosen over
    read-only PWA caching.
  - **SEO**: the public landing page (Phase 0) needs a full SEO pass —
    metadata, sitemap/robots (already scaffolded), structured data,
    performance.
  - Sequencing, per explicit user instruction: nothing in this phase starts
    until the functional roadmap above (Phase 1.x through Phase 8) is
    complete.
