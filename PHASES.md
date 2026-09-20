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
- **Phase 1.x UI — backfilling the screens for the RPCs above** ✅: the
  schema/RPC work above shipped with no UI, by its own explicit scope
  decision; this closes that gap with `/inventory/adjustments`,
  `/sales/returns`, `/purchasing/returns` (list/new/detail for all three).
  Draft-then-post lifecycle (unlike GRN's one-step receive-and-post):
  `actions/inventory.ts`'s `createStockAdjustmentAction`/
  `postStockAdjustmentAction` and the equivalent pair added to
  `actions/sales.ts`/`actions/purchasing.ts`, mirroring `sales_orders`'
  draft→confirm split rather than GRN's precedent — a conscious choice,
  since all three of these RPCs model an explicit `draft` status and an
  irreversible stock change earns a review step. `components/PostButton.tsx`
  generalizes `ConfirmOrderButton.tsx`'s exact pattern for all three. All
  three "create" forms are wired into the offline outbox
  (`createStockAdjustment`/`createSalesReturn`/`createPurchaseReturn` in
  `lib/offline/actionRegistry.ts`), reusing the hidden-`__xId`-field
  pattern for the two whose id is bound ahead of `formData`
  (`createSalesReturnAction(salesInvoiceId, ...)`/
  `createPurchaseReturnAction(goodsReceiptId, ...)`). Tracking-mode-aware
  line editors (batch picker vs. location picker vs. filtered-out
  unit-tracked, matching `GrnLineItemsEditor.tsx`'s established pattern);
  cost/margin redaction on the sales-return screens via
  `sales_return_lines_secure` + `view_cost`/`view_profit`, matching the
  invoice detail page (purchase returns have no such view, matching
  `ReceiveForm`'s own unredacted-cost precedent). Two bugs caught before
  live testing, both fixed: the return line editors originally gated
  identifying hidden fields (`salesInvoiceLineId`/`productId`/etc.) on a
  row's `selected` checkbox, which silently truncated the server-side
  sequential-index parser at the first unselected non-terminal row — fixed
  by always rendering identifying fields, gating only the editable ones;
  `parseAdjustmentLines` used `l.quantity` as a truthy check instead of
  `Number(l.quantity) > 0`, letting the string `"0"` slip past into a
  column with a `check (quantity_change <> 0)` constraint. Live-verified
  end to end through the exact Server-Action-shaped inserts (not just the
  RPCs in isolation, which the schema work above already covered):
  stock-adjustment post (simple-product decrement, batch-product
  weighted-average cost blend `(50×20 + 20×25)/70 = 21.4286`, `posted`
  status); full sales-return lifecycle through a real
  SO→confirm→delivery→dispatch→invoice trading loop (restock
  60→63 at unchanged `avg_cost`, invoice line `returned_quantity` → 3,
  `subtotal`/`total_amount` correct, `posted` status); full
  purchase-return lifecycle through a real PO→GRN→`post_goods_receipt`
  loop (decrement 83→78 at unchanged blended cost, GRN line
  `returned_quantity` → 5); over-return rejection on both the sales-return
  and purchase-return RPCs; the `quantity_change <> 0` and
  `purchase_return_lines.unit_cost not null` constraints rejecting bad
  data directly; RLS correctly denying a Viewer-role user's insert on all
  three new tables; and — since all three `post_*` RPCs are
  `security definer` and therefore bypass RLS, so their own in-body
  `has_permission`/`has_branch_access` checks are the only gate — a
  Viewer-role user's direct RPC call rejected with `Missing permission:
  warehouse.edit`, confirming that gate actually fires rather than just
  reading correctly in the source. `get_advisors` (security) showed only
  the same pre-existing, already-accepted `security definer` executable-by-
  authenticated warnings shared by every RPC in this app, plus one
  unrelated auth setting — nothing new. Test tenant and both test users
  fully torn down after verification (audit_log rows, tenant cascade,
  auth.users rows), confirmed empty by a final count query. One
  environment episode along the way, unrelated to the code itself: the
  Supabase project had auto-paused from inactivity mid-session
  (`execute_sql` timing out while a lighter `get_project` call still
  responded, which is what distinguished a paused project from an MCP
  outage) and needed an explicit user-approved `restore_project` before
  live testing could continue.
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
- **Phase 2 UI — backfilling the screens for all 6 Factory milestones** ✅:
  Phase 2 above shipped backend-only; this closes that gap with `/factory/*`
  (gated behind a layout-level `block_slab_factory` capability check that
  points to Settings when disabled, rather than a form that would fail at
  submit — every underlying RPC still enforces the same gate independently,
  this is purely UX). Milestone 1 (block intake) required extending the
  *existing* GRN receiving screen rather than a new page: a PO line's
  `quantity` for a unit-tracked product is a block COUNT, but
  `post_goods_receipt` requires exactly one GRN line per physical block
  (`quantity = 1` each, its own dimensions/cost) — so `GrnLineItemsEditor.tsx`
  now renders simple/batch PO lines exactly as before (one row each) plus a
  separate, independently addable/removable "blocks" list per unit-tracked
  PO line, capped at that line's outstanding block count. Every row across
  both groups still serializes into one flat, globally-indexed
  `lines[i][...]` array for the server-side parser; the per-PO-line block
  index ranges are precomputed in a single pass (not accumulated through
  JSX during render, which was the first draft and got replaced before it
  shipped — an accumulator threaded through `.map()` callbacks works
  correctly here since array construction is synchronous, but it reads like
  a bug and isn't worth the doubt). Milestones 2/3/4/5/6 got their own
  `/factory/blocks` (browse blocks, jump to "Start job"), `/factory/jobs`
  (list/new/detail), and `/factory/qc` (queue + per-unit inspection) routes,
  backed by a new `actions/factory.ts`. The output-line editor on a job's
  complete-job form deliberately allows zero rows — a block that turns out
  fully unusable (e.g. a crack found once opened) completes as 100% waste,
  matching `complete_processing_job`'s own explicit support for an empty
  `p_slabs` array; no client-side "at least one line" rule was invented to
  contradict that. `createProcessingJob`/`completeProcessingJob`/
  `recordProcessingCosts`/`recordQcInspection` are all wired into the
  offline outbox (`lib/offline/actionRegistry.ts`), reusing the established
  hidden-`__xId`-field pattern for the three bound to an id ahead of
  `formData`. Live-verified end to end through the exact UI-shaped inserts
  (a fresh tenant with the capability enabled, via `execute_sql`, not just
  re-confirming the RPCs Phase 2 already proved): block intake for two
  blocks with different dimensions (CM→CFT volume conversion correct:
  300×180×180cm → 343.2586 CFT, 280×170×170cm → 285.7663 CFT, costs
  preserved from the entered per-block unit cost); start → in_progress with
  the block moved to `processing`; complete with 2 slabs + 1 remnant
  (areas/volumes correct, yield 2.3086%, waste 335.3340 CFT, block →
  `consumed`, all three outputs → `pending_qc`); cost roll-up allocated
  6200 total (block cost 5200 + processing 800 + overhead 200) by volume
  share, confirmed the three allocated costs sum back to exactly 6200; QC
  pass (→ `in_stock`, grade overridden by the confirmed grade) and QC
  reject (→ `rejected`, permanently excluded from `in_stock`) on two
  different output units; `cancel_processing_job` restoring an in-progress
  block to `in_stock`. Edge/rejection paths: a unit-tracked GRN line with
  `quantity ≠ 1` rejected with the RPC's own explicit message; output
  volume exceeding the block's recorded volume rejected as physically
  impossible; the 100%-waste empty-array path accepted and recorded
  correctly (0% yield, full block volume as waste); re-inspecting an
  already-inspected unit rejected ("not pending QC"); a second tenant with
  the capability *not* enabled rejected at `post_goods_receipt` with the
  capability's own error message, confirming the layout-level UX gate
  matches the real backend gate exactly. Security: RLS denied a Viewer-role
  user's `processing_jobs` insert; and — since `start_processing_job`/
  `record_qc_inspection`/etc. are all `security definer` and therefore
  bypass RLS, so their in-body `has_permission` checks are the only real
  gate — a Viewer-role user's direct RPC calls to both `start_processing_job`
  and `record_qc_inspection` were confirmed rejected with `Missing
  permission: production.edit`/`production.approve` respectively, proving
  those in-body checks actually fire rather than just reading correctly in
  the source (`complete_processing_job`/`cancel_processing_job`/
  `record_processing_costs` share the identical `has_permission` call,
  verified by code review rather than re-run three more times). Branch
  scoping (`has_branch_access`) was not re-tested here: it's the exact same
  primitive already exhaustively proven across Phase 1, Phase 1.x, and
  Phase 2 itself, and every Factory RPC calls it identically — re-testing
  it again would only be checking that a function call is a function call.
  `get_advisors` (security) showed only the same pre-existing, already-
  accepted findings shared by every RPC in this app — nothing new. All
  three test tenants and their users were fully torn down after
  verification, confirmed empty by a final count query.
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
- **Phase 3 UI — backfilling the screens for Projects** ✅: Phase 3 above
  shipped backend-only; this closes that gap with `/projects` (list/new/
  detail), gated the same way `/factory` is (a layout-level
  `stone_fabrication` capability check pointing to Settings when disabled —
  every RPC still enforces the same gate independently). Materially simpler
  than the Factory UI: one header table + one join table + 4 RPCs, no new
  UOM/dimension math, so `actions/projects.ts` and the detail page's three
  sub-forms (`AddMaterialForm`/`CompleteProjectForm`/`GenerateInvoiceForm`)
  were enough — no new list/detail hierarchy beyond the single `[id]` page.
  Cost/margin (`material_cost`/`labor_cost`/`overhead_cost`/`total_cost`)
  is gated behind `project`.`view_cost`/`view_profit`, reusing the exact
  `fetchPermissionSet`/`hasPermission`/`showCost` pattern the sales invoice
  detail page established. `removeProjectMaterialAction` takes two ids
  (`projectId`, `inventoryUnitId`) rather than one, so it doesn't fit
  `PostButton`'s `(id) => Promise<ActionResult>` shape directly -- reused
  `PostButton` anyway by closing over `projectId` in an inline arrow
  (`action={(unitId) => removeProjectMaterialAction(id, unitId)}`) rather
  than writing a near-duplicate two-argument button component. Live-
  verified end to end through the exact UI-shaped RPC calls (a fresh
  tenant with the capability enabled, via `execute_sql`): adding two slabs
  to a draft project accumulated `material_cost` correctly (1000 + 600 =
  1600); removing one released it back to `in_stock` and dropped
  `material_cost` back to 1000, confirmed by re-adding it; completing with
  labor 400 + overhead 100 locked `total_cost` at 2100; generating an
  invoice with per-material sell prices (50sqft@$40, 30sqft@$35) produced
  the correct $3050 subtotal with both lines carrying the same flat
  $26.25/sqft cost rate (2100 ÷ 80 total sqft), confirming the
  proportional-by-area allocation collapsing to a constant is implemented
  correctly, not just designed that way in the comment. Edge/rejection
  paths: adding a material to an already-completed project rejected;
  generating a second invoice for an already-invoiced project rejected;
  cancelling a completed project rejected; adding a block (`unit_type =
  'block'`) as a project material rejected ("not a block"); adding a slab
  with no recorded cost rejected, matching Milestone 6's "never treat an
  un-costed unit as zero-cost" discipline. Security: RLS denied a
  Viewer-role user's `projects` insert; a Viewer-role user's direct
  `add_project_material` RPC call rejected with `Missing permission:
  project.edit`, confirming that security-definer function's in-body gate
  actually fires (`complete_project`/`cancel_project`/
  `generate_project_invoice` share the identical `has_permission` call,
  verified by code review). `get_advisors` (security) showed only the same
  pre-existing, already-accepted findings shared by every RPC in this app —
  nothing new. Test tenant and both test users fully torn down after
  verification, confirmed empty by a final count query.
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
- **Phase 4 UI — backfilling the screens for Tile Manufacturing** ✅: Phase 4
  above shipped backend-only; this closes that gap with `/manufacturing`
  (Bills of Materials, Production Batches, QC), gated the same way
  `/factory`/`/projects` are. `actions/manufacturing.ts` covers BOM
  creation (a recipe header + a dynamic add/remove raw-material line list,
  reusing the free-add/remove pattern from `AdjustmentLineItemsEditor.tsx`),
  production batch create/start/complete/cancel, and batch QC — the same
  five-RPC shape Factory's Milestones 2/3/5/6 already established, just on
  `inventory_batches` instead of `inventory_units`. The new-BOM form filters
  its finished-product picker to batch-tracked products and its raw-material
  picker to non-unit-tracked products, matching `start_production_batch`'s
  own rejection rules — convenience, not the enforcement point. Live-
  verified end to end through the exact UI-shaped RPC calls (a fresh tenant
  with the capability enabled, via `execute_sql`): starting a batch
  correctly consumed both a simple-tracked raw material (from
  `inventory_stock`) and a batch-tracked one (from `inventory_batches`) in
  the same run, computed `raw_material_cost` = 150 (50kg clay @ 2 + 10kg
  glaze @ 5); completing it produced a `pending_qc` finished-goods batch
  with `total_cost` = 190 (150 raw + 30 labor + 10 overhead) and
  `cost_per_uom` = 2.00 (190 ÷ 95 actual pieces); QC pass moved it to
  `in_stock`. Specifically re-verified the cross-phase risk this phase's
  own `confirm_sales_order` patch introduces: confirming a sales order for
  the finished tile was rejected ("available 0") while the batch was still
  `pending_qc`, then succeeded once QC passed it — the exact behavior the
  patch's own comment claims, now proven rather than just read. Edge/
  rejection paths: starting a batch whose recipe needs more raw material
  than is in stock rejected with no partial consumption (confirmed the
  untouched quantity was still there afterward — the whole start is one
  transaction); a unit-tracked product used as a raw material rejected;
  re-inspecting an already-passed batch rejected; cancelling an
  `in_progress` batch moved it to `cancelled` without restoring any
  consumed raw material (a genuine, permanent cost loss, exactly as
  documented — unlike Factory's block release on cancel, which is a real,
  deliberate domain difference this test confirms was actually implemented
  that way). Security: RLS denied a Viewer-role user's `production_batches`
  insert; a Viewer-role user's direct `record_batch_qc_inspection` RPC call
  rejected with `Missing permission: production.approve`
  (`start_production_batch`/`complete_production_batch`/
  `cancel_production_batch` share the identical `has_permission` call,
  verified by code review). `get_advisors` (security) showed only the same
  pre-existing, already-accepted findings — nothing new. Test tenant and
  both test users fully torn down after verification, confirmed empty by a
  final count query.
- **Phase 5 — Showroom/Reservation mode** ✅ (optional capability:
  `showroom_reservation`, already present in the capability catalog since
  Phase 0 — no new capability row needed): a walk-in showroom customer can
  hold specific stock while they decide/arrange payment, without yet
  committing to a full sales order. Economy of design: a reservation is its
  own lightweight header+line pair (`stock_reservations`/
  `stock_reservation_lines`, status `draft → active → converted/released`),
  not a repurposed `sales_orders` row — a reservation predates any
  commitment to buy (a customer can walk away without ever ordering), needs
  its own expiry, and its `draft` stage is even lighter than a sales
  order's (no pricing/currency required, though `unit_price` is required
  per line so the reservation itself always shows an indicative price).
  Converting an active reservation hands its already-reserved stock off
  directly into a real `sales_orders` row created straight to `confirmed`
  (deliberately **not** calling `confirm_sales_order`, since re-running its
  own reservation pass against stock this reservation already holds would
  double-reserve it) — the same "generate into Phase 1's own table" reuse
  Phase 3 already established for `generate_project_invoice` writing into
  `sales_invoices`. No new permission resource: reuses `sales`, exactly like
  Phase 1.x reused `sales`/`purchasing` for returns — no
  `create_tenant_for_user` role-wiring changes needed. Three RPCs:
  `activate_stock_reservation` (places the real hold — byte-for-byte the
  same two-pass validate-then-reserve FIFO shape `confirm_sales_order`
  already uses, so Phase 4's batch-level QC gate is respected for free
  since batch-tracked lines only ever draw from `status = 'in_stock'`
  batches; `p_hold_hours` has no default, since hold duration is a
  business-policy choice, not something to silently default),
  `release_stock_reservation` (gives the held stock back without ever
  creating a sales order — works on an `active` reservation regardless of
  expiry, so staff can free an expired-but-unreleased hold at any time; no
  `has_capability` check, matching `cancel_production_batch`/
  `cancel_processing_job` precedent — releasing is undoing one's own hold,
  gated by permission/status, not capability), and
  `convert_reservation_to_sales_order` (creates the `sales_orders`/
  `sales_order_lines` rows directly, reusing the reservation's own locked
  `base_quantity` from activation rather than recomputing it — the same
  "lock at start" discipline `raw_material_cost` established in Phase 4 —
  and refuses to convert past `expires_at`).
  **Explicit scope boundary** (mirroring the exact boundary
  `confirm_sales_order` already draws): unit-tracked products (blocks/slabs)
  are **not** reservable here, the same as they are not yet sellable through
  `confirm_sales_order`/`dispatch_delivery` at all — extending the whole
  Phase 1 sales pipeline to handle unit-tracked delivery is a separate,
  larger piece of work than this phase's own scope, left for a future
  phase rather than half-built here. **No automatic expiry sweep**: this
  codebase has no scheduled-job infrastructure yet, so `expires_at` is a
  stored, checked field, not a background process —
  `convert_reservation_to_sales_order` refuses to convert an expired hold;
  `release_stock_reservation` works on it regardless, so staff can clean it
  up manually at any time. An expired-but-unreleased reservation keeps its
  hold until someone releases it — a known, explicit limitation, not a
  silent bug. **Applying the branch-scoping lesson proactively** (as every
  phase since Phase 1.x has): all three RPCs got `has_branch_access()`
  checks in their bodies from their first version.
  Live-verified: the full golden path (activation holds stock proportionally
  across both simple- and batch-tracked products; conversion hands the hold
  off to a `confirmed` sales order without double-reserving — inventory
  `reserved_qty` unchanged across the conversion boundary; the resulting
  order dispatches cleanly through Phase 1's own unmodified
  `dispatch_delivery`, decrementing stock and zeroing `reserved_qty`
  exactly as any ordinary sales order would), `release_stock_reservation`
  correctly returning held stock without ever creating an order, an expired
  reservation correctly blocked from conversion but still releasable, every
  rejection path (unit-tracked product, insufficient stock, zero/negative
  `hold_hours`, re-activating a non-draft reservation, empty `so_number`),
  branch-scoping rejection on all three RPCs, permission-denial rejection
  on all three RPCs (`sales.edit`), and the capability gate on
  `activate`/`convert` (confirmed `release` deliberately does not check
  it). Full regression confirmed: Phase 1's own `confirm_sales_order` path
  is completely unaffected (this phase adds new tables and RPCs only — no
  existing function was modified). Automated regression coverage added in
  `tests/rls/phase5-showroom-reservations.test.ts`, mirroring every
  live-verified path above.
- **Phase 5 UI — backfilling the screens for Showroom/Reservation** ✅: Phase
  5 above shipped backend-only; this closes that gap with `/reservations`
  (list/new/detail), gated the same way `/factory`/`/projects`/
  `/manufacturing` are (`release_stock_reservation` deliberately skips the
  RPC-level capability check, matching `cancel_processing_job`/
  `cancel_production_batch`'s precedent — the layout gate is UX only either
  way). The new-reservation line picker filters out unit-tracked products,
  matching `activate_stock_reservation`'s own rejection rule. The detail
  page renders one of four bodies by `status`: `draft` gets the activate
  form; `active` gets a release button plus the convert-to-sales-order
  form; `converted` links straight to the resulting `/sales/orders/[id]`;
  `released` is a dead end with nothing left to do. Live-verified end to
  end through the exact UI-shaped RPC calls (a fresh tenant with the
  capability enabled, via `execute_sql`): activating a reservation across
  one simple-tracked and one batch-tracked line correctly reserved both
  (`reserved_qty` +10 and +5) and locked `base_quantity` per line;
  converting created a `confirmed` sales order with matching
  `reserved_quantity`/`base_quantity` on its lines while leaving
  `reserved_qty` on the underlying stock rows **completely unchanged**
  (10 and 5, not 20 and 10) — proving the "don't double-reserve" claim in
  the RPC's own comment; the resulting order was then pushed through
  Phase 1's **unmodified** `dispatch_delivery`, which correctly decremented
  `qty_on_hand` and zeroed `reserved_qty` on both rows, confirming the
  hand-off is functionally complete end to end, not just at the database
  row level. Edge/rejection paths: a unit-tracked product rejected on
  activation; `hold_hours = 0` rejected; insufficient stock rejected;
  re-activating an already-active reservation rejected; releasing an
  active reservation correctly returned its held stock to zero without
  ever creating a sales order (`sales_order_id` stayed null); an activated
  reservation with its `expires_at` moved into the past was correctly
  blocked from conversion ("has expired") while `release_stock_reservation`
  still succeeded on it regardless — proving the documented "expiry is
  checked, not swept" design actually behaves that way. Security: RLS
  denied a Viewer-role user's `stock_reservations` insert; a Viewer-role
  user's direct `activate_stock_reservation` RPC call rejected with
  `Missing permission: sales.edit` (`convert_reservation_to_sales_order`
  shares the identical `has_permission` call, verified by code review).
  `get_advisors` (security) showed only the same pre-existing,
  already-accepted findings — nothing new. Test tenant and both test users
  fully torn down after verification, confirmed empty by a final count
  query.
- **Phase 6 — Accounting depth** ✅: Chart of Accounts + a real double-entry
  ledger + P&L/Balance Sheet reporting. Unlike every prior phase (one new
  business workflow reusing an existing permission resource), accounting is
  a genuinely new domain reading across every other module — it earns its
  own `accounting` permission resource (same 11-action shape as
  `sales`/`purchasing`/`production`/`project`), with reporting gated on the
  `view_financial` action already sitting unused in the Phase 0 catalog.
  **Deliberately contained scope**: rather than retrofitting a
  journal-posting hook into every transaction RPC in the codebase (returns,
  adjustments, production costing, project invoicing — a much larger,
  riskier blast radius), this phase wires automatic posting into exactly
  the two RPCs that already carry the full Trading/Distribution loop's
  revenue/expense recognition — `post_goods_receipt` (Dr Inventory / Cr
  Accounts Payable, for the exact landed-cost value already being written
  to `inventory_stock`/`inventory_batches`/`inventory_units`, so the
  posting can never drift from the physical one) and
  `generate_sales_invoice_from_delivery` (Dr Accounts Receivable / Cr Sales
  Revenue for the invoice subtotal, plus Dr COGS / Cr Inventory for the
  exact per-line `unit_cost` `dispatch_delivery` already captured at
  dispatch) — plus the two payment tables via new triggers additive to
  their existing Phase 1 sync triggers (customer payment: Dr Cash / Cr AR;
  supplier payment: Dr AP / Cr Cash). Returns/adjustments/production/
  project-invoice auto-posting is an explicit, documented boundary for a
  future phase, exactly like Phase 5 left unit-tracked reservation out of
  scope rather than half-building it. A manual `post_journal_entry` RPC
  (accepting a `jsonb` line array, mirroring the existing
  `complete_processing_job`-style jsonb-array precedent, and rejecting an
  unbalanced entry before writing anything) covers everything else —
  opening balances, corrections, operating expenses. Posted entries are
  never edited, only reversed: `reverse_journal_entry` creates the mirror
  image (debits and credits swapped) referencing what it reverses, and
  rejects double-reversal.
  **Chart of Accounts** follows the exact `role_templates → roles` pattern
  from Phase 0: a new global `account_templates` catalog (10 standard
  accounts — Cash, AR, Inventory, AP, Tax Payable, Owner's Equity, Retained
  Earnings, Sales Revenue, COGS, Operating Expenses) copied into a new
  tenant's own `chart_of_accounts` at creation time, so every tenant can
  customize its own COA afterward without touching the global template.
  Seeded accounts are marked `is_system = true` and protected by a trigger
  (`protect_system_account`) from having their `code`/`account_type`
  changed or being deleted — auto-posting depends on looking them up by a
  stable code — while `name`/`is_active`/`parent` stay freely editable.
  **Applying the branch-scoping lesson proactively** (as every phase since
  Phase 1.x has): every new RPC checks `has_branch_access()` from its first
  version. `get_profit_and_loss`/`get_balance_sheet` are deliberately
  single-branch only (`p_branch_id` required, not optional) — a
  company-wide cross-branch aggregate would need to check every branch the
  caller has access to, which no existing report in this codebase does
  yet; left as a documented boundary rather than building an unverified
  privilege surface.
  **Two real bugs found and fixed during this phase's own live
  verification, both before the migration was ever committed**: (1)
  `get_balance_sheet` initially reported assets of 1600 against
  liabilities+equity of 1200 on a real test trading loop — off by exactly
  the 400 of net income, because this phase adds no period-close step that
  sweeps revenue/expense balances into retained earnings. Fixed by adding
  a synthetic "Current Period Earnings" equity line (revenue net minus
  expense net, cumulative to the as-of date) to the report — the standard
  way an interim (not-yet-closed) balance sheet stays balanced; re-verified
  and the accounting identity (assets = liabilities + equity) now holds
  exactly. (2) The `protect_system_account` trigger, as first written,
  blocked deleting a whole test tenant outright — the tenant's own cascade
  delete into `chart_of_accounts` tripped the same protection meant for a
  direct, standalone delete. Fixed by allowing the delete when it is part
  of the owning tenant's own cascade removal (checked by whether the
  tenant row itself still exists — Postgres removes the parent row before
  firing a cascade's child deletes), re-verified both ways: a live
  tenant still cannot have a system account deleted directly, but deleting
  the tenant itself now cleanly cascades.
  **A separate, unrelated regression was also found and fixed while
  reproducing `create_tenant_for_user` in full** (required regardless, to
  add the new `accounting` permission grants): the `insert into
  tenant_capabilities ... 'trading_distribution'` call — present in 0031,
  0039, and 0043 — went missing when Phase 3 (0046) last reproduced this
  function, so every tenant created since Phase 3 was never auto-granted
  Trading/Distribution. Nothing in the codebase actually gates on it via
  `has_capability` (the Settings → Business Capabilities screen would
  simply show it as off), so this was cosmetic rather than a functional
  break, but it's restored here now that this function had to be touched
  anyway.
  Live-verified: the full golden path on a real trading loop (GRN → Dr
  Inventory/Cr AP exactly 2000; sale confirm → dispatch → invoice → Dr
  AR/Cr Revenue exactly 1200 and Dr COGS/Cr Inventory exactly 800;
  customer payment → Dr Cash/Cr AR exactly 500, with the pre-existing
  Phase 1 payment-sync trigger firing correctly alongside the new one;
  supplier payment → Dr AP/Cr Cash exactly 800), manual
  `post_journal_entry` (balance validation rejecting an unbalanced entry,
  successful balanced posting) and `reverse_journal_entry` (correct mirror
  image, double-reversal rejection), system-account protection (delete and
  identity-change rejected, name/is_active still editable, tenant cascade
  delete unblocked), branch-scoping rejection on all four RPCs
  (`post_journal_entry`/`reverse_journal_entry`/`get_profit_and_loss`/
  `get_balance_sheet`), permission-denial rejection on all four
  (`accounting.create`/`accounting.edit`/`accounting.view_financial`), and
  the `accountant` role's grants confirmed correct
  (`create`/`edit`/`view`/`view_cost`/`view_profit`/`view_financial` on
  `accounting`). P&L and Balance Sheet cross-verified against each other
  (net income of 400 on the P&L matches the Balance Sheet's Current Period
  Earnings line exactly). Full regression confirmed: `post_goods_receipt`
  and `generate_sales_invoice_from_delivery`'s entire pre-existing behavior
  (landed-cost allocation, stock updates, PO/SO status transitions,
  invoice line creation) reproduced byte-for-byte correct throughout this
  phase's own test setup. Automated regression coverage added in
  `tests/rls/phase6-accounting.test.ts`, mirroring every live-verified path
  above.
- **Phase 6 UI — backfilling the screens for Accounting** ✅: `/accounting`
  layout with no capability gate (unlike Factory/Projects/Manufacturing/
  Reservations, accounting is always-on core, not an opt-in
  `business_capabilities` module — same reasoning as Trading/Distribution).
  `/accounting/chart-of-accounts` lists every account (code/name/type/
  system/active) and a `NewAccountForm` to add a custom one.
  `/accounting/journal-entries` lists entries (flagging `(reversal)` when
  `reverses_entry_id` is set) and links to `/new`, whose
  `NewJournalEntryForm` is a dynamic debit/credit line editor (starting at
  2 rows, matching the RPC's own "at least 2 lines" requirement) with a
  live client-side running balance indicator (green once total debit =
  total credit and > 0) and a same-row debit/credit mutual-exclusion
  `onChange` (typing in one clears the other). The detail page
  (`/accounting/journal-entries/[id]`) shows posted lines with a computed
  total row, and a `ReverseJournalEntryForm` — hidden once a query for
  `reverses_entry_id = this id` finds a match, so an already-reversed entry
  shows "already reversed" instead of a form that would just fail
  server-side. Both report pages
  (`/accounting/reports/profit-and-loss`, `.../balance-sheet`) are
  GET-form-driven (branch + date range/as-of-date, defaulting to
  month-to-date and today respectively) calling `get_profit_and_loss`/
  `get_balance_sheet` directly via `supabase.rpc`; the balance sheet page
  also renders a live "Balanced — Assets = Liabilities + Equity" / "Out of
  balance" indicator computed client-side from the same synthetic Current
  Period Earnings row Phase 6's backend added.
  **Offline wiring decision**: unlike the Settings screens (deliberately
  excluded — "no realistic no-signal scenario... silently deferring a
  permission/role change is the wrong default"), chart-of-account creation
  and manual journal-entry posting *were* wired into the offline outbox
  (`createChartOfAccount`/`postJournalEntry` in
  `lib/offline/actionRegistry.ts`, both "straight through" — no bound id to
  extract). The distinguishing question isn't "is this Settings" but "is
  there a realistic no-signal scenario for this action" — recording a
  transaction at a site with poor connectivity is exactly the scenario the
  offline outbox exists for (the same reasoning that already put customer/
  supplier payment recording in the outbox back in Phase 1.x), whereas a
  permission/role change is not.
  A TypeScript type mismatch surfaced only at compile time, not in code
  review: the generated Supabase RPC types mark `post_journal_entry`'s
  `p_entry_date`/`p_description` and `reverse_journal_entry`'s `p_reason`
  as required `string` (not `string | null`), even though the SQL function
  bodies accept `null` (`coalesce(p_entry_date, current_date)`) — the
  opposite of the `|| undefined` pattern hit in Phase 2's
  `recordQcInspectionAction` for a genuinely optional param. Fixed by
  defaulting `entryDate` to today's date client-side (matching what the
  RPC would default to anyway) rather than fighting the generated type.
  A `react-hooks/static-components` lint error (a JSX component function
  defined inline inside the balance sheet page's render body, one that
  ESLint correctly flags as re-created — and so losing any state — on every
  render) was fixed by hoisting it to a module-level `renderSection()`
  helper called as a plain function rather than rendered as a component
  tag.
  Live-verified against a fresh test tenant: chart-of-account creation;
  `protect_system_account` blocking a code change and a delete on a system
  account while allowing both on a custom one; `post_journal_entry`
  rejecting an unbalanced entry (debit 100 vs credit 90) and successfully
  posting a balanced one; `reverse_journal_entry` producing the exact
  mirror image (debit/credit swapped) and rejecting a second reversal
  attempt on the same entry; RLS denial and `accounting.create`/
  `view_financial` in-body RPC denial for a Viewer-role user; branch-scoped
  rejection for a user whose Accountant role was restricted to a second
  branch (blocked posting to the tenant's main branch, succeeded posting to
  their own); `get_profit_and_loss`/`get_balance_sheet` cross-checked
  against a hand-computed trading loop (revenue 500, expense 0 after a
  posted-then-reversed entry net to zero, assets 500 = liabilities 0 +
  equity 500 via the synthetic Current Period Earnings row — the
  accounting identity holds exactly); the full auto-posting trigger chain
  from Phase 6's backend re-verified end to end on a real GRN → SO confirm
  → dispatch → invoice → customer payment → supplier payment loop (Dr
  Inventory/Cr AP 200 on receipt; Dr AR/Cr Revenue 300 and Dr COGS/Cr
  Inventory 100 on invoicing; Dr Cash/Cr AR 300 on customer payment; Dr
  AP/Cr Cash 200 on supplier payment — all exactly matching hand
  calculation). `get_advisors` (security) showed only the same
  pre-existing, already-accepted findings — nothing new. Test tenant and
  all three test users (owner, viewer, branch-limited accountant) fully
  torn down after verification, confirmed empty by a final count query.
  `npx tsc --noEmit`, `npm run lint`, `npx vitest run` (35 passing, up from
  33), and `npm run build` all clean before commit; all 6 new accounting
  routes registered as dynamic (`ƒ`) pages.
- **Phase 7 — QR/Mobile/barcode** ✅: backend/data layer for scanning flows
  and a barcode/QR generator, scoped per explicit user decision — camera-
  based scanning UI is a separate, later pass this session cannot verify
  the way it verifies SQL; everything shipped here is live-SQL-verified
  like every other phase. Two genuinely new pieces, plus one pure-lookup
  convenience function:
  1. **Stocktake (physical count) workflow** — the one piece of
     "receiving/put-away/picking/stocktake" with no backing schema at all
     yet (receiving/put-away/picking already have full RPCs from Phase 1/
     Phase 1.x — a scanner just fills their existing fields faster; no new
     RPC needed for those three, and none of their existing RPCs were
     touched). New `stocktakes`/`stocktake_lines` tables, status `draft →
     counting → posted/cancelled`. Reuses Phase 1.x's `stock_adjustments`
     engine for the actual correction (`reason_code = 'count_correction'`,
     already in that enum) instead of re-implementing cost-blending/
     decrement logic a second time: `post_stocktake` builds exactly one
     `stock_adjustments` document from every counted variance and calls
     the existing `post_stock_adjustment(uuid)` directly, inheriting its
     cost math and its own permission/branch checks. A found item's cost
     is valued at the product's current weighted-average — reusing an
     existing system number, never inventing one. Same unit-tracked-
     product boundary `post_stock_adjustment` already draws. Four RPCs:
     `start_stocktake_count` (snapshots `system_quantity` from live
     inventory so the baseline can't shift mid-count), `record_stocktake_count`
     (one line at a time, so counting survives interruption/any order),
     `post_stocktake` (requires every line counted first; skips creating
     any adjustment at all on a perfect count), `cancel_stocktake` (a true
     no-op undo — no stock ever moves until posting, unlike
     `cancel_production_batch`/`cancel_stock_transfer`).
  2. **Barcode/QR generator** — `generate_product_barcode`/
     `generate_inventory_unit_qr_code` assign a real, checksum-valid
     EAN-13 code (GS1's 20-29 prefix range, reserved for internal/
     restricted-circulation use — correct practice for an internally-
     assigned code with no registered GS1 company prefix, not an invented
     format) only when the row doesn't already have one, so a real
     manufacturer barcode a user already entered is never overwritten.
     Live-verified: every generated code passes EAN-13 checksum
     validation; calling again on an already-coded row is a no-op
     returning the same value.
  `resolve_scanned_code` is a plain `SECURITY INVOKER` lookup (deliberately
  not `SECURITY DEFINER` — no RLS bypass needed or wanted for a read-only
  convenience query a client could otherwise run as four separate selects)
  that turns one scanned string into whichever product/location/unit/batch
  it matches, across every existing scannable field
  (`products.barcode`/`qr_code_value`/`sku`, `storage_locations.code`,
  `inventory_units.unit_code`/`qr_code_value`, `inventory_batches
  .batch_number`) — a receiving/put-away/picking screen feeds the resolved
  id straight into its existing insert flow (GRN lines, delivery lines,
  ...), so this phase changes zero existing transactional RPCs.
  Live-verified: the full stocktake golden path (variances in both
  directions on the same document — a simple-tracked shrinkage and a
  batch-tracked found-surplus — correctly posted as one balanced
  `stock_adjustments` document, inventory corrected exactly), a perfect
  count correctly skipping adjustment creation entirely, `cancel_stocktake`
  from both `draft` and `counting` (and correctly rejected from `posted`),
  every rejection path (empty stocktake, unit-tracked product, negative
  count, posting with uncounted lines, wrong-status calls), `resolve_scanned_code`
  correctly resolving all four match types plus a clean empty result for
  a garbage code, branch-scoping rejection on all four stocktake RPCs,
  permission-denial rejection on all four stocktake RPCs
  (`warehouse.edit`) and both generator RPCs (`product.edit`), and a
  Viewer correctly still able to call the read-only `resolve_scanned_code`
  despite having none of the write permissions. Full regression confirmed:
  `post_stock_adjustment` still posts an ordinary, manually-created
  adjustment correctly (this phase only ever calls it, never modifies it).
  Automated regression coverage added in
  `tests/rls/phase7-scanning-and-stocktake.test.ts`, mirroring every
  live-verified path above.
- **Phase 7 UI — backfilling the screens for Stocktake + barcode/QR** ✅:
  `/inventory/stocktakes` list + `New stocktake` (branch/warehouse/notes plus
  a `StocktakeLineItemsEditor` — a simplified sibling of
  `AdjustmentLineItemsEditor.tsx`: same product/location-or-batch picker,
  minus direction/quantity/cost since a stocktake plans *what* to count, not
  by how much — that comes later from `record_stocktake_count`). The detail
  page (`/inventory/stocktakes/[id]`) shows system/counted quantities and a
  computed variance column (green/red/neutral), a "Start counting" button
  when `draft`, an inline per-line `RecordCountForm` (bound via
  `.bind(null, stocktakeLineId)`, the same pattern as
  `ReverseJournalEntryForm.tsx`) once `counting`, and a "Post stocktake"
  button gated on every line being counted (client-side hint only — the RPC
  is still the real enforcement). A posted stocktake links to its generated
  `stock_adjustments` document, or says "Perfect count — no adjustment was
  needed" when the count found zero variance. **Barcode/QR generation**:
  the product detail page now shows the assigned barcode once generated, or
  a "Generate barcode" button (a `PostButton` calling
  `generateProductBarcodeAction` directly — its signature already matches
  `PostButton`'s `(id) => Promise<ActionResult>` shape with no wrapper
  needed). **Scan lookup**: a new `/scan` screen — not the camera-based
  scanner PHASES.md already scoped out of this round, but a manual
  "type the code" form exercising the exact same `resolve_scanned_code` RPC
  a real scanning screen would call, grouping results by match type
  (product/storage location/inventory unit/batch) with the same untyped
  read-only shape (`{matches}` instead of `{error}|{success}`) the
  accounting reports use for `get_profit_and_loss`/`get_balance_sheet`.
  **Offline wiring decision**: only `createStocktakeAction` was added to
  the offline outbox (`createStocktake` in `actionRegistry.ts`) — matching
  the existing, already-established rule that only *create* forms
  (`ActionForm`) get offline-wired, never single-click state-transition
  actions (`PostButton`): `postStockAdjustmentAction` was never in the
  registry either, so `startStocktakeCountAction`/
  `recordStocktakeCountAction`/`postStocktakeAction`/`cancelStocktakeAction`
  staying out is continuing that rule, not a new gap.
  Live-verified against a fresh test tenant: `start_stocktake_count`
  correctly snapshotting `system_quantity` from live inventory for both a
  simple-tracked product (100) and a batch-tracked product (50);
  `record_stocktake_count` rejecting a negative count and correctly
  recording both a shrinkage (100→90) and a found-surplus (50→55);
  `post_stocktake` building exactly one `stock_adjustments` document
  (`reason_code = 'count_correction'`) with the found line valued at the
  batch's `cost_per_uom` (8) and the shrinkage line carrying no cost, then
  correctly decrementing/incrementing live inventory to exactly 90/55; a
  second post attempt on the same (now `posted`) stocktake rejected; a
  fresh stocktake with an exact, no-variance count correctly posting with
  `stock_adjustment_id = null` (adjustment creation skipped entirely, not
  created-then-discarded); posting rejected while a line is still
  uncounted; `cancel_stocktake` succeeding from both `draft` and `counting`
  and rejected from `posted`; a unit-tracked product line correctly
  rejected at `start_stocktake_count`; RLS denial and `warehouse.edit`
  in-body RPC denial for a Viewer-role user (branch-scoping itself is the
  identical `has_branch_access` call already live-verified in Phase 6 and
  Phase 1.x, so it was accepted here via code review rather than
  re-derived); `generate_product_barcode` producing a
  real checksum-valid EAN-13 code, a second call on the same product
  returning the identical code unchanged (idempotent, not regenerated), and
  correctly denied for a Viewer; `resolve_scanned_code` correctly matching
  a generated barcode to its product, a storage location by `code`, and an
  inventory batch by `batch_number`, plus a clean empty result for an
  unmatched code. `get_advisors` (security) showed only the same
  pre-existing, already-accepted findings — nothing new. Test tenant and
  both test users fully torn down after verification, confirmed empty by a
  final count query. `npx tsc --noEmit`, `npm run lint`, `npx vitest run`
  (36 passing, up from 35), and `npm run build` all clean before commit;
  all 4 new routes (`/inventory/stocktakes`, `/inventory/stocktakes/new`,
  `/inventory/stocktakes/[id]`, `/scan`) registered as dynamic (`ƒ`) pages.
- **Phase 8 — Reporting/Dashboards** ✅: eight cross-module reporting RPCs,
  scoped per the same explicit decision Phase 7 made — backend/data layer
  this round, live-SQL-verified like every other phase; the actual
  dashboard UI (charts, KPI tiles) is a separate, later frontend pass, and
  every RPC here already returns exactly the rows such a screen would
  render directly. **No new permission resource**: every report reuses the
  resource that already owns its subject matter and the existing
  `view`/`view_cost`/`view_financial` action split from Phase 0's own
  design — sales performance (`get_sales_summary`, `get_top_customers`,
  `get_top_products`) under `sales.view`; inventory
  (`get_inventory_valuation`) under `product.view_cost` since unit cost is
  exactly the class of field `products_secure` already redacts; low stock
  (`get_low_stock_report`) under `warehouse.view` since only quantities,
  not cost, are exposed; receivables/payables aging under
  `sales.view_financial`/`purchasing.view_financial` (matching how Phase 6
  already gates P&L/Balance Sheet); and the unifying `get_dashboard_summary`
  under `accounting.view_financial`, the same resource/action Phase 6
  already uses for company-wide financial figures. **Branch scoping follows
  the underlying data, not a blanket rule**: sales/receivables/dashboard
  reports take a required `p_branch_id` (matching Phase 6/7's own "single
  branch, not an unverified cross-branch aggregate" precedent, since
  `sales_orders`/`sales_invoices` are branch-scoped tables); inventory
  valuation and low-stock are deliberately tenant-wide with **no** branch
  parameter — `inventory_stock`/`inventory_batches`/`inventory_units` RLS
  is itself tenant-wide only (confirmed live against their own 0009
  policies), so a report over them can't be branch-scoped without
  inventing a scoping dimension the underlying tables don't have. Payables
  aging is likewise tenant-wide for a real, pre-existing structural reason:
  `purchase_invoices` carries no `branch_id` column at all — noted since
  Phase 6's own research, and still with no creation path in the app —
  documented here as an honest, acknowledged gap rather than either
  fabricating a branch dimension or skipping the report. One small,
  additive schema change: `products.reorder_point` (nullable) — the
  low-stock report needs a threshold to compare against, and none existed;
  never invented as a computed default, only ever read back as whatever
  the tenant explicitly set, so a product with no threshold set is
  silently and correctly excluded rather than flagged against a guessed
  number. `get_dashboard_summary` reads revenue/COGS from
  `get_profit_and_loss` (Phase 6) internally rather than re-deriving them
  from source tables a second time, so the dashboard summary can never
  disagree with the P&L report itself; its `low_stock_count` is computed
  inline rather than by calling `get_low_stock_report` directly, since that
  RPC carries its own separate `warehouse.view` gate distinct from
  `get_dashboard_summary`'s own `accounting.view_financial` gate — calling
  it from inside would make a caller with only the latter (a plausible
  finance-only role) fail the whole summary on a permission it was never
  meant to need for one sub-count, a mismatch caught and designed around
  before this RPC was ever applied.
  **A real bug was found and fixed during this phase's own live
  verification**: `get_inventory_valuation`/`get_low_stock_report` both
  declare `product_id`/`qty_on_hand` as `returns table (...)` output
  columns — which plpgsql implicitly turns into function-body variables of
  those exact names — and their internal per-source subqueries
  (`inventory_stock`/`inventory_batches`/`inventory_units`) reference bare
  `product_id`/`qty_on_hand` columns that collide with those variables,
  producing `column reference "product_id" is ambiguous` the first time
  either RPC was actually called. Fixed by table-qualifying every such
  reference (e.g. `inventory_stock.product_id`, not bare `product_id`) in
  both functions' subqueries; re-verified live afterward that both return
  correct rows. (`get_dashboard_summary`'s own inline low-stock subquery
  was independently checked and has no such collision — its output columns
  are `total_revenue`/`total_cogs`/etc., none of which shadow `product_id`
  or `qty_on_hand`.)
  Live-verified: a full purchase-to-cash + sale-to-cash trading loop (GRN
  receipt of 100 units at cost 20 = $2000; a 60-unit sale at 30 = $1800
  revenue, dropping on-hand to 40 — deliberately below a 50-unit
  `reorder_point` set on the test product; a partial $700 customer receipt
  against a 45-days-past-due invoice; a manually-inserted, partially-paid
  $2000 purchase invoice 65 days past due) checked against every one of
  the 8 report RPCs, every figure hand-computed and matched exactly:
  `get_sales_summary` (1 order, 1 invoice, $1800 revenue),
  `get_top_customers`/`get_top_products` (correct single row each),
  `get_inventory_valuation` (40 units × $20 avg_cost = $800),
  `get_low_stock_report` (the test product flagged with a shortfall of 10,
  a second product with no `reorder_point` set correctly excluded no
  matter its own on-hand quantity), `get_receivables_aging` ($1100
  outstanding correctly bucketed into days_31_60),
  `get_payables_aging` ($1500 outstanding correctly bucketed into
  days_61_90), and `get_dashboard_summary` (revenue/COGS/gross-profit
  cross-verified byte-for-byte against `get_profit_and_loss` directly,
  open sales/purchase order counts, outstanding receivables/payables, and
  low-stock count all correct). Branch-scoping rejection verified on all
  five branch-scoped RPCs (`get_sales_summary`, `get_top_customers`,
  `get_top_products`, `get_receivables_aging`, `get_dashboard_summary`)
  using a Branch-A-restricted Accountant-role user called against Branch
  B, with the same user's call against their own Branch A confirmed to
  still succeed. Permission-denial rejection verified on all four
  `view_financial`/`view_cost`-gated RPCs using a Viewer-role user, each
  producing the exact expected `Missing permission: <resource>.<action>`
  message (`product.view_cost`, `sales.view_financial`,
  `purchasing.view_financial`, `accounting.view_financial`), while
  confirming the same Viewer is correctly still allowed to call the
  `view`-gated reports (`get_sales_summary`, `get_low_stock_report`).
  Anonymous access confirmed blocked at the grant level
  (`revoke execute ... from public, anon`) independent of the in-body
  permission check, on a representative RPC. Security-advisor sweep
  returned only the same expected, intentional
  `authenticated_security_definer_function_executable` pattern already
  accepted for every prior integrity RPC (including the 8 new ones from
  this phase) plus one pre-existing, unrelated `auth_leaked_password_protection`
  finding — zero new or unexpected findings. Full regression confirmed:
  this phase's own trading-loop setup exercised `post_goods_receipt`,
  `confirm_sales_order`, `dispatch_delivery`, and
  `generate_sales_invoice_from_delivery` live end to end with no
  modifications to any of them (Phase 8 adds only new functions and one
  new nullable column), and `get_profit_and_loss` (Phase 6) was called
  directly and cross-checked. Automated regression coverage added in
  `tests/rls/phase8-reporting-dashboards.test.ts`, mirroring every
  live-verified path above.
- **Phase 8 UI — backfilling the screens for Reporting/Dashboards** ✅: six
  read-only report pages under a new `/reports` section (no capability gate
  — always-on core, same reasoning as `/accounting`), all Server Components
  calling the RPCs directly via `supabase.rpc(...)` with no `actions/` file
  at all — every one of these eight RPCs is a pure read, so there is
  nothing to mutate and nothing for a Server Action to guard.
  `/reports` (Dashboard) is a branch+date-range GET filter driving a KPI
  tile grid over `get_dashboard_summary`'s 8 fields.
  `/reports/sales` combines all three sales RPCs behind one filter —
  `get_sales_summary` as tiles, `get_top_customers`/`get_top_products` as
  two side-by-side tables — since all three share the identical
  `(tenant, branch, start, end)` signature and exist to answer the same
  "how did sales do" question together. `/reports/inventory-valuation` and
  `/reports/low-stock` are unfiltered tables (tenant-wide, no branch
  parameter — the underlying RPCs themselves take none, per Phase 8's own
  documented reasoning that `inventory_stock`/`inventory_batches` carry no
  branch dimension to filter by). `/reports/receivables-aging` (branch
  filter) and `/reports/payables-aging` (tenant-wide, no filter — mirroring
  `get_payables_aging`'s own signature, since `purchase_invoices` has no
  `branch_id` column) both render the standard current/1-30/31-60/61-90/90+
  aging buckets with a computed total row.
  Live-verified against a fresh test tenant running the same purchase-to-
  cash + sale-to-cash trading loop as Phase 8's own backend verification
  (GRN of 100 units at cost 20; a 60-unit sale at 30; a partial $700
  customer receipt; a manually-inserted, partially-paid $2000 purchase
  invoice): every one of the 8 RPC calls, called exactly as each page
  itself calls them, matched hand calculation exactly —
  `get_dashboard_summary` (revenue 1800, COGS 1200, gross profit 600,
  receivables 1100, payables 1500, low-stock count 1),
  `get_sales_summary`/`get_top_customers`/`get_top_products` (1 order, 1
  invoice, $1800, the single test customer/product each),
  `get_inventory_valuation` (40 units × $20 avg cost = $800),
  `get_low_stock_report` (shortfall of
  10 against the 50-unit `reorder_point`), `get_receivables_aging`/
  `get_payables_aging` ($1100/$1500 outstanding, both in the `current`
  bucket for a same-day invoice). Permission-denial rejection verified for
  a Viewer-role user on both `view_financial`/`view_cost`-gated RPCs
  (`get_dashboard_summary` → `accounting.view_financial`,
  `get_inventory_valuation` → `product.view_cost`), while the same Viewer
  confirmed still able to call the `view`-gated reports
  (`get_sales_summary`, `get_low_stock_report`) — reusing the exact
  permission-shape verification Phase 8's own backend testing already
  established, exercised here through the real page-level RPC calls rather
  than re-deriving the permission matrix from scratch. `get_advisors`
  (security) showed only the same pre-existing, already-accepted findings
  — nothing new. Test tenant and both test users fully torn down after
  verification, confirmed empty by a final count query. `npx tsc --noEmit`,
  `npm run lint`, `npx vitest run` (36 passing, unchanged — no new offline
  actions, since every report here is read-only), and `npm run build` all
  clean before commit; all 6 new report routes registered as dynamic (`ƒ`)
  pages.
- **Phase 9 — Offline-first + Desktop + Mobile + SEO**: decisions locked in
  with the user so this doesn't need re-litigating later; started only once
  the full functional roadmap above (Phase 1.x through Phase 8) was
  complete, per the user's own explicit sequencing instruction. Tackled in
  dependency order — SEO first (small, isolated, no new architecture),
  then offline-first (the hard architectural core), then the Tauri/
  Capacitor wrappers last, since the user's own requirement is that they
  provide genuine offline operation, not just a browser shortcut around
  work the sync layer hasn't done yet.
  - **SEO** ✅: the public landing page already had solid Phase 0 scaffolding
    (title template, OpenGraph/Twitter metadata, a generated `opengraph-image`,
    `sitemap.ts`/`robots.ts`) — this pass filled the three pieces still
    missing: structured data, canonical URLs, and app icons/manifest.
    **Structured data**: a `SoftwareApplication` + `FAQPage` JSON-LD block
    on the landing page, built directly from the same `faqs` array already
    rendered on the page (never a second, divergent copy of the same
    content) — live-verified as valid JSON with all 12 FAQ entries present.
    **Canonical URLs**: `alternates.canonical` added to the root layout
    (`/`) and to `/login`/`/signup`. Adding per-page metadata to `/login`/
    `/signup` required first fixing a real, pre-existing inconsistency:
    both pages were `"use client"` components directly under `page.tsx`,
    which cannot export `metadata` (a Next.js constraint, not a stylistic
    choice) — every other route in this codebase already splits an
    interactive client form out from a thin server `page.tsx` (e.g.
    `products/new/page.tsx` + `ProductForm.tsx`); `/login`/`/signup` were
    the only two routes that didn't follow it. Fixed by extracting
    `LoginForm.tsx`/`SignUpForm.tsx` as client components and turning each
    `page.tsx` into a server component with its own `title`/`description`/
    `canonical` — bringing these two routes in line with the rest of the
    codebase's own established pattern, not inventing a new one.
    **Icons/manifest**: `app/icon.tsx` (512×512) and `app/apple-icon.tsx`
    (180×180) generated via the same `ImageResponse` technique the existing
    `opengraph-image.tsx` already used (matching its exact dark
    background/wordmark styling, not a new visual identity), plus
    `app/manifest.ts` (name/description drawn from the same copy already
    used in the root layout's own metadata, `theme_color`/`background_color`
    matching the OG image's existing `#09090b`, referencing the generated
    `/icon` route rather than inventing separate static image assets).
    **Performance**: audited, not modified — the landing page was already
    a zero-client-JS server component (the FAQ's expand/collapse uses
    native `<details>`, no JS needed) with self-hosted `next/font` (no
    render-blocking Google Fonts request) and no `<img>` elements to
    optimize; nothing needed changing here, a real finding worth recording
    rather than manufacturing busywork. Live-verified via `next build` +
    a local production server: `/manifest.webmanifest`, `/icon`,
    `/apple-icon` all generate correctly and are linked in `<head>`; the
    JSON-LD block parses as valid JSON with the expected `@graph` shape;
    `/login`/`/signup` render their own correct `<title>`/canonical tags
    and (as a byproduct of the client/server split, not the goal of it)
    now prerender statically instead of needing a dynamic render. Full
    regression confirmed: `tsc --noEmit`, lint, and the full vitest suite
    (113 tests across 20 files, all skip as expected with no service-role
    key in this sandbox) all still pass clean, and `next build`'s route
    table is otherwise unchanged.
  - **Offline-first — foundation** ✅ (one flow proven end to end; extending
    every other module's forms is a documented follow-up, not claimed done
    here): the deep version the user asked for — a local outbox queue and
    background sync, not read-only PWA caching — built as a layer *around*
    the existing Server Actions architecture rather than a parallel write
    path, so it adds zero new attack surface: every queued mutation still
    runs through the exact same `requirePermission`-guarded Server Action
    and RLS-scoped Supabase client as the online path, whether it executes
    immediately or after a reconnect.
    - **`lib/offline/db.ts`**: a small Dexie (IndexedDB) database with one
      `outbox` table — each row is a captured form submission (`tenantId`,
      `actionKey`, its `FormData` entries as `[string, string][]`, status,
      error, attempt count, timestamp). `formDataToEntries` explicitly
      rejects a `File` field rather than silently stringifying it to
      `"[object File]"` — every offline-capable form in this app is
      text/number/select only, so this is a real, enforced boundary, not a
      gap waiting to be hit.
    - **`lib/offline/actionRegistry.ts`**: maps a stable string key (e.g.
      `"createSalesOrder"`) to the real, imported Server Action. A queued
      outbox row stores the key, never the function itself — functions
      aren't serializable, and a page reload while offline would lose a
      closure-captured reference anyway. Replaying a queued item looks the
      action up by key and calls it, so a reconnect runs literally the same
      code path (permission check, RLS, business validation) the request
      would have hit if the network had never dropped — nothing about the
      write is duplicated, reimplemented, or bypassed for the offline case.
    - **`lib/offline/sync.ts`**: `enqueueOfflineAction`, `drainOutbox`
      (oldest-first, one tenant at a time, stops immediately if the network
      drops again mid-drain), and `isNetworkError` — the check that tells
      "the request never reached the server" (queue it) apart from "the
      server ran it and rejected it on the merits" (surface the real error,
      never silently retry a submission that can only fail identically). A
      failed item is left in the outbox with its message, never dropped —
      the same never-silently-drop discipline this codebase already applies
      to every rejected business transaction, now applied to the sync queue
      itself. A synced item is pruned on the same drain that synced it.
    - **`lib/offline/OfflineProvider.tsx` + `OfflineStatusBadge.tsx`**:
      mounted once in `(app)/layout.tsx` (scoped to one tenant), tracks
      `navigator.onLine`/the `online`/`offline` window events, drains the
      outbox on mount-if-online and on every reconnect, and renders a small
      always-visible badge ("Offline — N queued" / "Syncing N queued
      items…") — offline mode is silent plumbing otherwise, and a user who
      submitted a form while offline needs to actually see it queued, not
      wonder if it was lost.
    - **`components/ActionForm.tsx`**: extended with an opt-in
      `offlineActionKey` prop (existing forms are unaffected — omitting it
      is the default, and most settings/admin screens deliberately don't
      opt in: there's no realistic "no signal" scenario for them, and
      silently deferring a permission/role change is the wrong default).
      When set, a network failure — already offline at submit time, or the
      connection drops mid-request — queues the exact submission instead of
      surfacing a hard error, and the form shows "Saved offline — will sync
      when back online" rather than the ordinary "Saved." A `redirect()`
      thrown by a Server Action on its normal online-success path (this
      codebase's existing pattern, e.g. `createSalesOrderAction`) is
      unaffected — it isn't a `TypeError`, so it propagates through
      unchanged exactly as it did before this change.
    - **Proof of the whole path, not just the plumbing**: wired onto one
      real, representative flow — creating a sales order
      (`app/(app)/sales/orders/new/NewSalesOrderForm.tsx` now passes
      `offlineActionKey="createSalesOrder"`) — chosen because it's exactly
      the kind of field data entry the user's own stated concern was about.
    - **Explicit, honest scope boundary**: this pass proves the *mutation*
      path works offline for one flow; it does not give every other
      module's create/edit forms the same `offlineActionKey` wiring (a
      large, low-risk, mechanical extension of this same infrastructure —
      not started here so it isn't claimed as done), and it does not
      attempt offline *page loads* — a cold navigation to a route with zero
      connectivity still needs the page's own Server Component data fetch
      to succeed, which this pass doesn't change; that requires a service
      worker precaching the app shell/RSC payloads, a separate, larger
      piece of PWA engineering the Tauri/Capacitor wrappers will need
      anyway and are a more natural place to add it.
    - **Verification, honestly reported**: a real attempt was made to
      prove this live end-to-end in a browser (log in, go offline via
      Playwright's `context.setOffline(true)`, submit the sales order form,
      confirm the "Saved offline" state and the badge, go back online,
      confirm the outbox drains and the row lands in `sales_orders`) — this
      is exactly the kind of live verification every other phase in this
      project performed. It could not be completed: this sandbox's own
      egress policy rejects direct outbound connections to `*.supabase.co`
      (confirmed via a raw `curl` to the Supabase Auth health endpoint —
      `CONNECT tunnel failed, response 403`, an explicit proxy policy
      denial, not a flaky network blip), so neither the Next.js dev server
      nor a browser running inside this sandbox can reach Supabase directly
      — only the Supabase MCP tool channel can (a separate path outside
      this container's own network, which is how every prior phase's live
      SQL verification worked). This is a genuine environment constraint,
      not a property of the offline code itself, and not something to
      paper over: verification for this piece is therefore the automated
      suite in `tests/offline/sync.test.ts` (9 tests against a real
      `fake-indexeddb`-backed Dexie instance — enqueue, tenant-scoped
      counts, replay-by-registry-key with the real `FormData` reconstructed
      correctly, marking synced items pruned, marking server-rejected items
      failed with their real error and left in place, an unknown action key
      failing safely instead of throwing, tenant isolation during a drain,
      oldest-first ordering, and a failed item's attempt count incrementing
      on a later successful retry) plus `tsc --noEmit`/lint/`next build`
      (all clean, route table unchanged) and a careful manual read-through
      of the `ActionForm`/`OfflineProvider` wiring — not a live click-through,
      and this entry says so rather than claiming one. A follow-up session
      with unrestricted egress (or run from outside this sandbox) should
      complete the live browser pass before this pattern is rolled out to
      further forms.
    - **New dependency**: `dexie` (runtime) and `fake-indexeddb` (dev/test
      only) — both small, dependency-free, widely used libraries; no new
      backend/Supabase surface, no schema changes.
  - **Offline-first — extended to the rest of the "invoices, orders, GRNs"
    trading loop** ✅: the mechanical follow-up flagged above, done —
    `offlineActionKey` wired onto the other three forms the user's own
    stated requirement named by name: `NewPurchaseOrderForm.tsx`
    (`createPurchaseOrder`), `ReceiveForm.tsx` (`createGoodsReceipt`, the
    canonical warehouse-floor scenario a GRN represents), `NewDeliveryForm.tsx`
    (`createDelivery`), and `GenerateInvoiceForm.tsx` (`generateInvoice`) —
    alongside the sales order form already wired. Deliberately still not
    extended to settings/admin and catalog/master-data screens (branches,
    warehouses, users, supplier/customer master records, price lists,
    product master) — unchanged reasoning from the original pass: no
    realistic "no signal" scenario for office-side setup screens, and
    silently deferring one of those is the wrong default. (The
    supplier/customer *payment-recording* forms on those same detail pages
    are a different, transactional case — see the next entry.)
    **One real design gap closed in the process**: three of these four
    actions take an extra id bound ahead of `formData` on the online path
    (e.g. `createDeliveryAction(salesOrderId, formData)`, wired via
    `.bind(null, id)` on the Server Action reference) — a `.bind()`'d
    closure doesn't survive being serialized into the outbox and read back
    after a reload, so replaying a queued item purely by its stored
    `actionKey` had no way to recover that id. Fixed by having the id also
    travel as a hidden form field (`__purchaseOrderId`/`__salesOrderId`/
    `__deliveryId` — double-underscore-prefixed, confirmed by grep to
    collide with no field name any of these actions already reads) and
    giving `actionRegistry.ts` a small wrapper per such action that pulls
    the id back out of the submitted `FormData` before calling the real
    action positionally — the exact same function, called the exact same
    way, whether it runs live or is replayed later. `generateInvoice` needs
    two such ids (`deliveryId` and `salesOrderId`); `createSalesOrder`/
    `createPurchaseOrder` need none, since neither takes a bound id at all.
    No changes to any of the four underlying Server Actions themselves —
    this is purely additive wiring around them, so no live Supabase
    re-verification was needed (nothing server-side changed) beyond
    confirming the hidden-field names don't collide.
    Verified: a new `tests/offline/actionRegistry.test.ts` (4 tests, real
    Server Actions mocked since they import `next/headers`-dependent
    Supabase clients unusable outside a request context) confirms each
    wrapper extracts its id(s) from the hidden field(s) and calls the real
    action with the correct positional arguments — `createGoodsReceipt`,
    `createDelivery`, `generateInvoice` (two ids), and the pass-through
    case (`createSalesOrder` receiving `formData` alone, unchanged). Full
    regression: `tsc --noEmit`, lint, and the full vitest suite (126 tests
    across 22 files — 13 real, 113 skipped as expected) all pass clean, and
    `next build`'s route table is unchanged.
  - **Offline-first — payment recording** ✅: a full audit of every
    `ActionForm` usage in the app (16 total) turned up two genuinely
    transactional forms the first extension pass missed — recording a
    customer payment against an invoice
    (`app/(app)/sales/invoices/[id]/page.tsx`) and recording a supplier
    payment (`app/(app)/purchasing/suppliers/[id]/page.tsx`). Both are real
    field/collections data entry (a payment received in person, recorded
    wherever that happens to be), and "invoices" was one of the user's own
    named examples — this was a real gap, not scope creep. Same pattern as
    the trading-loop forms: `recordCustomerPaymentAction`/
    `recordSupplierPaymentAction` each bind an id (`customerId`/
    `supplierId`) ahead of `formData` on the online path, so each form now
    also carries that id as a hidden `__customerId`/`__supplierId` field,
    and `actionRegistry.ts` gained matching `recordCustomerPayment`/
    `recordSupplierPayment` wrappers that extract it before calling the
    real action. No changes to either underlying Server Action.
    **That audit also confirmed there is nothing left to extend this
    pattern to beyond catalog/admin screens**: this app's UI only covers
    Phase 0/Phase 1 (Trading/Distribution) — every other phase (stock
    adjustments/transfers/returns, Factory, Fabrication, Tile
    Manufacturing, Showroom/Reservations, Accounting, QR/stocktake,
    Reporting) was built backend/RPC-only by its own explicit scope
    decision, with UI deferred; there is no stock-adjustment form, no
    stocktake form, no reservation form, etc. to wire offline capability
    onto, because none of those forms exist yet. Extending this pattern
    further is therefore gated on building those screens in the first
    place, not on more outbox/registry work.
    Verified: two new tests in `tests/offline/actionRegistry.test.ts` (15
    total across the two offline test files) confirm both wrappers extract
    their id correctly; `tsc --noEmit`, lint, the full vitest suite, and
    `next build` all pass clean.
  - **Desktop (Tauri)** ✅ (Linux target only — see verification note): a
    real native shell that serves the app's own UI from disk, not the
    network — genuine offline operation, not a browser window pointed at a
    hosted URL (which is exactly the "browser shortcut" this locked-in
    decision explicitly rejected). Scaffolded via `tauri init` into
    `src-tauri/`, then built out into the architecture this requirement
    actually demands, since this app is a dynamic Next.js server (Server
    Components, Server Actions, cookie-based auth/tenant resolution) —
    **not** a static site, so it cannot be exported to flat files the way a
    typical Tauri frontend is bundled:
    - **`next.config.ts`**: `output: "standalone"` — Next's own supported
      mode for a self-contained server bundle (`server.js` + its own
      minimal `node_modules`), harmless for the existing Vercel deployment
      path (Vercel manages its own output regardless of this setting).
    - **`scripts/prepare-tauri-server.mjs`**: assembles that standalone
      output plus `.next/static` and `public/` (Next's own documented
      standalone-deployment layout — the standalone build deliberately
      excludes static assets) into `src-tauri/resources/server/`, which
      `tauri.conf.json`'s `bundle.resources` bundles into the shipped app.
    - **`scripts/prepare-tauri-node-sidecar.mjs`**: copies a Node.js binary
      into `src-tauri/binaries/node-<target-triple>`, Tauri's sidecar
      naming convention (`bundle.externalBin`). Documented, not built: this
      copies whatever `node` is on the *build* machine's PATH, correct
      for building on the one platform this session can actually target
      and verify (`x86_64-unknown-linux-gnu`), but a real release pipeline
      for other platforms should instead download the official prebuilt
      Node.js binary per target triple rather than depend on the build
      machine's own installed version.
    - **`src-tauri/src/lib.rs`**: in a release build, the main window is
      created but held `visible: false`; `setup()` spawns the bundled
      `node server.js` sidecar (via `tauri-plugin-shell`'s `Command::sidecar`
      — a pure Rust-to-Rust call, not a webview→backend IPC call, so it
      needs no capability/permission grant, confirmed by reading
      `tauri-plugin-shell`'s own source in the local Cargo registry cache
      rather than guessing), polls `127.0.0.1:17423` until it actually
      accepts a connection, then navigates the window to that local URL and
      shows it — so there is never a flash of empty/default content, and a
      slow-starting server never leaves the user looking at nothing (a
      timeout falls back to showing the window regardless, logging the
      failure). In `tauri dev`, none of this runs — Tauri's own tested
      default flow (`devUrl` pointing at `next dev`) is untouched, and the
      window is simply shown immediately.
    - **A real bug found and fixed during this piece's own live
      verification**: the first version let Tauri drop the spawned
      `CommandChild` handle, meaning the bundled server outlived the app —
      confirmed by launching the actual built binary (see below), closing
      it, and finding `next-server` still running as an orphan process.
      Fixed by tracking the child in managed state and killing it from a
      `RunEvent::ExitRequested`/`RunEvent::Exit` handler — the documented,
      correct Tauri mechanism for app-quit cleanup. Documented limitation,
      not silently assumed away: this handles Tauri's own quit lifecycle
      (window close, `app.exit()`), not a raw external `SIGKILL` sent
      directly to the process bypassing the app's event loop entirely —
      confirmed by testing both: a `RunEvent`-driven path cannot be
      verified against an OS signal because a signal never reaches it in
      the first place; this is a standard, shared limitation of processes
      that spawn helper subprocesses, not unique to this implementation.
    - **Verification — live, not just a compile check**: `cargo check` and
      a full `cargo build --release` both succeeded (confirming every Rust
      API call — `ShellExt::sidecar`, `CommandChild`, `WebviewWindow
      ::navigate`, `Manager::path().resource_dir()` — against the real
      crate versions, not assumed from memory), and `tauri build
      --no-bundle` correctly assembled the sidecar binary and resources
      next to the built executable. The built app was then actually
      **launched** under `Xvfb` (a virtual X server, since this sandbox has
      no real display) — confirmed all three expected processes running
      together (`./app`, `WebKitWebProcess`/`WebKitNetworkProcess`, and
      `next-server`), and a direct `curl` to `http://127.0.0.1:17423/login`
      returned the real, correctly-rendered login page HTML. This is
      substantially stronger verification than the offline-first piece
      could get (blocked entirely by this sandbox's egress policy) — this
      one runs entirely on `127.0.0.1`, no external network involved, so
      the sandbox's own restriction never applies to it. What remains
      genuinely unverified in this sandbox: the actual rendered window
      content (no screenshot tooling available under bare Xvfb, and no
      window manager to test a real UI-driven close), and every non-Linux
      target (macOS/Windows builds and their own bundlers/installers) —
      this session can only build and run for the one platform it has.
      **Real icons, closed as a same-session follow-up**: the placeholder
      gap just above didn't need "image-generation tooling" this session
      lacked — it needed the tooling already in the repo, reused.
      `scripts/generate-app-icon-source.mjs` renders one 1024×1024 source
      PNG via `next/og`'s `ImageResponse`, the exact same renderer (and the
      exact same "S" wordmark/`#09090b` palette) `app/icon.tsx`,
      `app/apple-icon.tsx`, and `app/opengraph-image.tsx` already use for
      the web app — one visual identity, not a second one invented for
      desktop. `npm run generate:app-icon` feeds that source through
      `tauri icon`, which derives every platform's real icon set
      (Windows `.ico`, macOS `.icns`, every PNG size, plus Android/iOS
      variants for if Tauri mobile is ever pursued) from it — confirmed by
      inspecting the generated `128x128.png` directly (a real rendered "S"
      glyph, not a blank or broken image) and by re-running `cargo check`
      afterward to confirm the rebuilt icon set doesn't break the build
      Tauri's own `embed-resource`/bundler step depends on.
  - **Mobile (Capacitor)** ✅ (scope explicitly agreed with the user before
    building: a real, buildable native shell pointed at the hosted app —
    not yet the deep offline architecture): asked directly, since the
    Tauri sidecar approach genuinely does not carry over — Capacitor apps
    don't bundle an arbitrary local Node process the way a Tauri sidecar
    can, so "just do what desktop did" was not an honest option here. Two
    real alternatives existed (bundle-a-local-shell was ruled out by that
    same constraint; the real fork was between a client-rendered-SPA
    rebuild of the offline-critical screens now, vs. this shell now and
    offline as a later, separately-scoped decision); the user chose the
    latter. Published to the Play Store (not a bare PWA install, not a
    separate React Native codebase), matching the original locked-in
    decision.
    - **`capacitor.config.ts`**: `appId com.stonevora.erp` (matching the
      Tauri shell's own `identifier` for consistency), `server.url` driven
      by `NEXT_PUBLIC_SITE_URL` — the same env var and fallback pattern
      `app/sitemap.ts`/`app/robots.ts` already use, not a new convention.
      `capacitor-www/index.html` is a minimal "Loading…" placeholder, never
      the real app; `server.url` is set in every case, so it's only ever
      seen for the brief moment before that navigation completes.
    - **`android/`**: a real native Android Studio/Gradle project, added
      via `cap add android` and kept in sync via `cap sync android` (both
      run for real, not hand-assembled) — Kotlin/Gradle source is
      committed, matching standard Capacitor project convention;
      Capacitor's own generated `.gitignore` inside `android/` already
      correctly excludes build outputs, `local.properties`, and generated
      config/asset copies.
    - **Explicit, honest scope boundary — genuine offline mobile
      operation is not attempted here**: the user's own choice, made with
      the tradeoff stated plainly rather than half-built. The path there
      (deferred, not designed in detail): a client-rendered build of the
      offline-critical screens — the same sales-order-entry flow already
      proven on desktop is the natural first candidate — talking to
      Supabase directly and reusing `lib/offline`'s outbox/sync engine,
      bundled as Capacitor's local `webDir` instead of a remote
      `server.url`. A real architectural fork from the rest of this
      (server-rendered) app, correctly left for its own separately-scoped
      pass rather than assumed away.
    - **Verification, honestly bounded — same class of constraint as the
      other two Phase 9 pieces, confirmed the same way (a live attempt,
      not an assumption)**: `cap init`/`cap add android`/`cap sync android`
      all ran for real and were inspected — confirmed `server.url`/
      `cleartext`/`appId` correctly propagated into
      `android/app/src/main/assets/capacitor.config.json`, the file the
      native shell actually reads at runtime, and confirmed `applicationId`/
      `namespace` in `android/app/build.gradle` are `com.stonevora.erp`
      throughout (only Capacitor's own generic instrumented-test-stub
      files keep its template's placeholder Java package, cosmetic and
      unrelated to the real app). A full native build was then genuinely
      attempted, not skipped: `./gradlew tasks` — the Gradle wrapper itself
      downloaded and ran correctly, but resolving the Android Gradle Plugin
      failed with `Could not GET
      'https://dl.google.com/dl/android/maven2/...'. Received status code
      403 from server: Forbidden` — this sandbox's own egress policy again
      (the same class of restriction that blocked the offline-first piece's
      Supabase connection and would also block installing the Android SDK
      itself, which was never attempted for the same reason). A real
      environment constraint, not a property of the Capacitor config —
      confirmed live rather than assumed. A follow-up with normal internet
      access (a real machine, or a CI runner with the Android SDK
      preinstalled) should run `./gradlew assembleDebug` and an emulator
      smoke test before this ships to a device.
- **Branding — brand color + wordmark mark + landing page polish** ✅:
  requested directly by the user ("koi brand color set kar dein... is ka
  logo kesa hai"), with full creative discretion on the actual color/style
  choice. Before this pass, every screen (landing page included) was pure
  zinc/black-white monochrome, and the "logo" was a single unstyled letter
  "S" — no distinct brand identity, and no visual hierarchy between
  primary and secondary actions (every button on the landing page was the
  identical `bg-zinc-900`/`bg-zinc-100` pair).
  **Color choice, with reasoning**: `amber` (Tailwind's built-in palette,
  `amber-600`/`amber-700` light mode, `amber-500`/`amber-400` dark mode —
  no custom hex values, so contrast/accessibility is whatever Tailwind's
  own tested scale already provides). Most B2B SaaS defaults to generic
  blue; a warm amber/copper accent is both more distinctive and
  thematically closer to the industry itself (quarried stone, polished
  granite) while still matching the current "neutral zinc base + one
  accent color" dark-SaaS pattern already established by this app's own
  UI (semantic status colors — emerald/red/amber for success/error/warning
  — were already in place from Phase 1 onward; this adds the first actual
  *brand* accent, a different role from those semantic colors, reusing the
  same Tailwind palette family deliberately rather than introducing a
  fourth color system).
  **Logo**: `app/icon.tsx`/`app/apple-icon.tsx` redesigned as a monogram
  (amber "S" + a short amber accent bar underneath, on the existing dark
  `#09090b` surface) rather than a full wordmark — a wordmark is illegible
  once scaled down to a 16px favicon, so the two need different treatments;
  `app/opengraph-image.tsx` (1200×630, large enough for a full wordmark)
  now carries the amber eyebrow line, the "Stonevora" title, and the same
  accent-bar motif, tying the small icon and the large social-share image
  to one consistent mark instead of two unrelated designs.
  **Landing page**: a reusable `BrandMark` component (amber-on-zinc "S" +
  wordmark) replaces the old plain-text header logo; every primary call-to-
  action (header "Get started", hero "Get started", final-CTA "Get
  started") switched to solid amber, while secondary actions (Sign in, the
  outline "See what it does" button) stay neutral zinc — a real visual
  hierarchy that didn't exist before, not just a color swap. Smaller
  accent touches: the hero eyebrow line, the traceability workflow's
  numbered step badges, the FAQ section's expand indicator, and the phone
  mockup's primary-button placeholder all now use the same amber. The
  in-app header (`app/(app)/layout.tsx`) picked up the same small amber
  monogram next to its "Stonevora" wordmark for brand consistency between
  the marketing site and the app itself — deliberately scoped to just the
  logo mark, not a re-skin of the app's 60+ already-built, already-verified
  functional screens, since that was never asked for and would be a large,
  unnecessary regression risk against working code.
  **SEO — audited, not rebuilt**: title template, OpenGraph/Twitter
  metadata, canonical URLs, `sitemap.ts`/`robots.ts`, the `SoftwareApplication`
  + `FAQPage` JSON-LD block (built from the same 12-entry `faqs` array
  rendered on the page, still no divergent copy), and the generated
  manifest/icons were already comprehensive from Phase 9's own SEO pass;
  re-reviewed here and found genuinely complete — no gaps worth inventing
  work to fill, consistent with this project's own standing practice of
  recording a real "nothing needed changing" finding rather than
  manufacturing busywork.
  **Live-verified**: `npm run build` generated all three `ImageResponse`
  routes (`/icon`, `/apple-icon`, `/opengraph-image`) as static (`○`)
  routes with no render errors; a local production server
  (`npm run start`) was started and each route's actual PNG output was
  fetched and visually inspected — the icon reads correctly as an amber
  "S" + accent bar on a rounded dark square, and the OG image shows the
  amber eyebrow/accent bar with the white "Stonevora" wordmark and
  description exactly as designed; the landing page's rendered HTML was
  fetched and confirmed to contain the new `amber-*` utility classes
  throughout (compiled CSS present, no missing/typo'd class names) and a
  correct `<title>` tag. `npx tsc --noEmit` and `npm run lint` both clean.
  The temporary preview server was stopped and its downloaded PNGs deleted
  afterward.
