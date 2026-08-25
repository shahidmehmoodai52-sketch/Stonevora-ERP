-- Phase 1 audit finding: inventory_stock/inventory_batches had no cost field at
-- all (no way to compute COGS/margin) and no reserved-quantity tracking (no way
-- to prevent overselling — the exact "AVAILABLE + RESERVED + SOLD double-count"
-- the spec warns against). Both are corrected here; the tables still have no
-- data yet in any tenant, so this is purely an additive schema fix.

alter table inventory_stock
  add column avg_cost numeric(18, 4) not null default 0,
  add column reserved_qty numeric(18, 4) not null default 0;

alter table inventory_batches
  add column cost_per_uom numeric(18, 4) not null default 0,
  add column reserved_qty numeric(18, 4) not null default 0;

-- Reusing the existing generic audit trigger (supabase/migrations/0008_audit.sql)
-- on every table where a quantity or money value changes — this is exactly the
-- "later modules attach the same trigger with zero new infrastructure" case that
-- trigger was built for.
create trigger trg_audit_inventory_stock
  after insert or update or delete on inventory_stock
  for each row execute function audit_trigger_fn();

create trigger trg_audit_inventory_batches
  after insert or update or delete on inventory_batches
  for each row execute function audit_trigger_fn();

create trigger trg_audit_purchase_orders
  after insert or update or delete on purchase_orders
  for each row execute function audit_trigger_fn();

create trigger trg_audit_goods_receipts
  after insert or update or delete on goods_receipts
  for each row execute function audit_trigger_fn();

create trigger trg_audit_purchase_invoices
  after insert or update or delete on purchase_invoices
  for each row execute function audit_trigger_fn();

create trigger trg_audit_sales_orders
  after insert or update or delete on sales_orders
  for each row execute function audit_trigger_fn();

create trigger trg_audit_deliveries
  after insert or update or delete on deliveries
  for each row execute function audit_trigger_fn();

create trigger trg_audit_sales_invoices
  after insert or update or delete on sales_invoices
  for each row execute function audit_trigger_fn();

create trigger trg_audit_customer_payments
  after insert or update or delete on customer_payments
  for each row execute function audit_trigger_fn();

create trigger trg_audit_supplier_payments
  after insert or update or delete on supplier_payments
  for each row execute function audit_trigger_fn();
