# Roadmap

Stonevora-ERP is being built step by step. Each phase is scoped, implemented, and
verified before the next begins.

- **Phase 0 — Foundation** (this phase): multi-tenant core (tenants, branches,
  warehouses/storage locations), auth/roles/permissions, product master, universal
  UOM engine, country/currency/tax/fiscal-year config, audit trail infrastructure.
  Row-Level Security enforces tenant isolation at the database level.
- **Phase 1 — Trading/Distribution mode**: Supplier → Purchase Order → Goods
  Receipt Note → Stock → Sales Order → Delivery → Invoice → Payment.
- **Phase 2 — Block/Slab Factory mode**: raw block intake, cutting/processing,
  graded slab output with yield tracking and cost roll-up.
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
