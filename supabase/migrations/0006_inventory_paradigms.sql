-- Three inventory paradigms, chosen per product via products.inventory_tracking_mode.
-- Schema only in Phase 0 — no UI beyond the `products` master until each mode's phase.

create table inventory_units (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  product_id uuid not null references products (id),
  unit_code text not null, -- e.g. block/slab serial number
  status text not null default 'in_stock',
  current_location_id uuid references storage_locations (id),
  actual_length numeric(10, 3),
  actual_width numeric(10, 3),
  actual_thickness numeric(10, 3),
  quality_grade text,
  created_at timestamptz not null default now(),
  unique (tenant_id, unit_code)
);

create table inventory_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  product_id uuid not null references products (id),
  batch_number text not null,
  lot_number text,
  shade_code text,
  manufactured_date date,
  expiry_date date,
  qty_on_hand numeric(18, 4) not null default 0,
  uom_id uuid references uom (id),
  current_location_id uuid references storage_locations (id),
  created_at timestamptz not null default now(),
  unique (tenant_id, product_id, batch_number)
);

create table inventory_stock (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  product_id uuid not null references products (id),
  location_id uuid references storage_locations (id),
  qty_on_hand numeric(18, 4) not null default 0,
  uom_id uuid references uom (id),
  updated_at timestamptz not null default now(),
  unique (tenant_id, product_id, location_id)
);
