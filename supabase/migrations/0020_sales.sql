-- Phase 1 (Trading/Distribution): sales orders, deliveries (dispatch), sales
-- invoices. A "quotation" is deliberately not a separate table — a sales order
-- in 'draft' status IS the quotation (no stock reservation happens until it is
-- confirmed), avoiding a duplicate document type for the same underlying data.

create type sales_order_status as enum ('draft', 'confirmed', 'partially_delivered', 'delivered', 'invoiced', 'cancelled');

create table sales_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  branch_id uuid not null references branches (id),
  customer_id uuid not null references customers (id),
  warehouse_id uuid references warehouses (id), -- fulfilling warehouse; required to confirm (see confirm_sales_order())
  so_number text not null,
  status sales_order_status not null default 'draft',
  order_date date not null default current_date,
  price_list_id uuid references price_lists (id),
  currency_id uuid references currencies (id),
  notes text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, so_number)
);

create table sales_order_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  sales_order_id uuid not null references sales_orders (id) on delete cascade,
  product_id uuid not null references products (id),
  quantity numeric(18, 4) not null,
  uom_id uuid not null references uom (id),
  unit_price numeric(18, 4) not null,
  reserved_quantity numeric(18, 4) not null default 0,
  delivered_quantity numeric(18, 4) not null default 0,
  created_at timestamptz not null default now()
);

create type delivery_status as enum ('draft', 'dispatched', 'delivered');

create table deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  branch_id uuid not null references branches (id),
  warehouse_id uuid not null references warehouses (id),
  sales_order_id uuid not null references sales_orders (id),
  delivery_number text not null,
  delivery_date date not null default current_date,
  status delivery_status not null default 'draft',
  vehicle_info text,
  driver_name text,
  notes text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  unique (tenant_id, delivery_number)
);

create table delivery_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  delivery_id uuid not null references deliveries (id) on delete cascade,
  sales_order_line_id uuid not null references sales_order_lines (id),
  product_id uuid not null references products (id),
  quantity numeric(18, 4) not null,
  unit_cost numeric(18, 4), -- COGS snapshot captured at dispatch time
  created_at timestamptz not null default now()
);

create type sales_invoice_status as enum ('draft', 'posted', 'partially_paid', 'paid', 'cancelled');

create table sales_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  branch_id uuid not null references branches (id),
  customer_id uuid not null references customers (id),
  sales_order_id uuid references sales_orders (id),
  invoice_number text not null,
  invoice_date date not null default current_date,
  due_date date,
  status sales_invoice_status not null default 'draft',
  currency_id uuid references currencies (id),
  subtotal numeric(18, 4) not null default 0,
  tax_amount numeric(18, 4) not null default 0,
  total_amount numeric(18, 4) not null default 0,
  amount_paid numeric(18, 4) not null default 0,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  unique (tenant_id, invoice_number)
);

create table sales_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  sales_invoice_id uuid not null references sales_invoices (id) on delete cascade,
  product_id uuid not null references products (id),
  description text,
  quantity numeric(18, 4) not null,
  uom_id uuid not null references uom (id),
  unit_price numeric(18, 4) not null,
  line_total numeric(18, 4) not null,
  unit_cost numeric(18, 4), -- COGS snapshot; financial field, gated via view_cost/view_profit
  created_at timestamptz not null default now()
);

create index idx_sales_orders_branch_id on sales_orders (branch_id);
create index idx_sales_orders_warehouse_id on sales_orders (warehouse_id);
create index idx_sales_orders_customer_id on sales_orders (customer_id);
create index idx_sales_orders_price_list_id on sales_orders (price_list_id);
create index idx_sales_orders_currency_id on sales_orders (currency_id);
create index idx_sales_order_lines_sales_order_id on sales_order_lines (sales_order_id);
create index idx_sales_order_lines_product_id on sales_order_lines (product_id);
create index idx_sales_order_lines_uom_id on sales_order_lines (uom_id);
create index idx_deliveries_branch_id on deliveries (branch_id);
create index idx_deliveries_warehouse_id on deliveries (warehouse_id);
create index idx_deliveries_sales_order_id on deliveries (sales_order_id);
create index idx_delivery_lines_delivery_id on delivery_lines (delivery_id);
create index idx_delivery_lines_sales_order_line_id on delivery_lines (sales_order_line_id);
create index idx_delivery_lines_product_id on delivery_lines (product_id);
create index idx_sales_invoices_branch_id on sales_invoices (branch_id);
create index idx_sales_invoices_customer_id on sales_invoices (customer_id);
create index idx_sales_invoices_sales_order_id on sales_invoices (sales_order_id);
create index idx_sales_invoices_currency_id on sales_invoices (currency_id);
create index idx_sales_invoice_lines_sales_invoice_id on sales_invoice_lines (sales_invoice_id);
create index idx_sales_invoice_lines_product_id on sales_invoice_lines (product_id);
create index idx_sales_invoice_lines_uom_id on sales_invoice_lines (uom_id);
