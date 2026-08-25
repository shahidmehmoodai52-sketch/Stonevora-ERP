-- Universal UOM engine: units + configurable conversions (never hardcoded).

create type uom_category as enum ('count', 'length', 'area', 'volume', 'weight');

create table uom (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants (id) on delete cascade, -- null = global (piece, box, sqft, sqm, kg, ton, m3, ...)
  code text not null,
  name text not null,
  category uom_category not null,
  is_active boolean not null default true,
  unique nulls not distinct (tenant_id, code)
);

create table uom_conversions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants (id) on delete cascade, -- null = global fixed conversion (e.g. 1 sqm = 10.7639 sqft)
  product_id uuid, -- fk added in 0005_product_master.sql once products exists
  from_uom_id uuid not null references uom (id),
  to_uom_id uuid not null references uom (id),
  conversion_factor numeric(18, 6) not null,
  is_active boolean not null default true,
  unique nulls not distinct (tenant_id, product_id, from_uom_id, to_uom_id)
);
