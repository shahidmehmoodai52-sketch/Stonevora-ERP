-- Phase 1 (Trading/Distribution): purchase orders, goods receipts (GRN) with
-- landed cost allocation, and supplier invoices.

create type purchase_order_status as enum ('draft', 'confirmed', 'partially_received', 'received', 'cancelled');

create table purchase_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  branch_id uuid not null references branches (id),
  supplier_id uuid not null references suppliers (id),
  po_number text not null,
  status purchase_order_status not null default 'draft',
  order_date date not null default current_date,
  expected_date date,
  currency_id uuid references currencies (id),
  exchange_rate numeric(18, 6) not null default 1,
  notes text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, po_number)
);

create table purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  purchase_order_id uuid not null references purchase_orders (id) on delete cascade,
  product_id uuid not null references products (id),
  description text,
  quantity numeric(18, 4) not null,
  uom_id uuid not null references uom (id),
  unit_price numeric(18, 4) not null,
  received_quantity numeric(18, 4) not null default 0,
  created_at timestamptz not null default now()
);

create type landed_cost_basis as enum ('value', 'quantity');
create type goods_receipt_status as enum ('draft', 'posted');

-- freight/duty/handling/other are entered once per receipt (e.g. per container)
-- and allocated across lines at posting time by the chosen basis — this is the
-- industry-standard landed cost pattern (percent/amount allocation across a
-- container's line items), not a flat per-unit markup.
create table goods_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  branch_id uuid not null references branches (id),
  warehouse_id uuid not null references warehouses (id),
  purchase_order_id uuid not null references purchase_orders (id),
  grn_number text not null,
  receipt_date date not null default current_date,
  freight_cost numeric(18, 4) not null default 0,
  duty_cost numeric(18, 4) not null default 0,
  handling_cost numeric(18, 4) not null default 0,
  other_cost numeric(18, 4) not null default 0,
  landed_cost_basis landed_cost_basis not null default 'value',
  status goods_receipt_status not null default 'draft',
  notes text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  unique (tenant_id, grn_number)
);

create table goods_receipt_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  goods_receipt_id uuid not null references goods_receipts (id) on delete cascade,
  purchase_order_line_id uuid not null references purchase_order_lines (id),
  product_id uuid not null references products (id),
  quantity numeric(18, 4) not null,
  uom_id uuid not null references uom (id),
  unit_cost numeric(18, 4) not null,
  allocated_landed_cost numeric(18, 4) not null default 0,
  total_unit_cost numeric(18, 4),
  location_id uuid references storage_locations (id),
  batch_number text,
  lot_number text,
  shade_code text,
  caliber_code text,
  created_at timestamptz not null default now()
);

create type purchase_invoice_status as enum ('draft', 'posted', 'partially_paid', 'paid');

create table purchase_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  supplier_id uuid not null references suppliers (id),
  purchase_order_id uuid references purchase_orders (id),
  goods_receipt_id uuid references goods_receipts (id),
  invoice_number text not null,
  invoice_date date not null default current_date,
  due_date date,
  status purchase_invoice_status not null default 'draft',
  currency_id uuid references currencies (id),
  subtotal numeric(18, 4) not null default 0,
  tax_amount numeric(18, 4) not null default 0,
  total_amount numeric(18, 4) not null default 0,
  amount_paid numeric(18, 4) not null default 0,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  unique (tenant_id, supplier_id, invoice_number)
);

create index idx_purchase_orders_branch_id on purchase_orders (branch_id);
create index idx_purchase_orders_supplier_id on purchase_orders (supplier_id);
create index idx_purchase_orders_currency_id on purchase_orders (currency_id);
create index idx_purchase_order_lines_purchase_order_id on purchase_order_lines (purchase_order_id);
create index idx_purchase_order_lines_product_id on purchase_order_lines (product_id);
create index idx_purchase_order_lines_uom_id on purchase_order_lines (uom_id);
create index idx_goods_receipts_branch_id on goods_receipts (branch_id);
create index idx_goods_receipts_warehouse_id on goods_receipts (warehouse_id);
create index idx_goods_receipts_purchase_order_id on goods_receipts (purchase_order_id);
create index idx_goods_receipt_lines_goods_receipt_id on goods_receipt_lines (goods_receipt_id);
create index idx_goods_receipt_lines_purchase_order_line_id on goods_receipt_lines (purchase_order_line_id);
create index idx_goods_receipt_lines_product_id on goods_receipt_lines (product_id);
create index idx_goods_receipt_lines_uom_id on goods_receipt_lines (uom_id);
create index idx_goods_receipt_lines_location_id on goods_receipt_lines (location_id);
create index idx_purchase_invoices_supplier_id on purchase_invoices (supplier_id);
create index idx_purchase_invoices_purchase_order_id on purchase_invoices (purchase_order_id);
create index idx_purchase_invoices_goods_receipt_id on purchase_invoices (goods_receipt_id);
create index idx_purchase_invoices_currency_id on purchase_invoices (currency_id);
