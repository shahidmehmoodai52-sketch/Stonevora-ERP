-- Product master: flexible attributes, three inventory paradigms selectable per product.

create table product_attribute_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, -- material_type, variety, brand, collection, color, pattern, origin, grade, finish, surface, application, ...
  name text not null
);

create table product_lookup_values (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  attribute_type_id uuid not null references product_attribute_types (id),
  code text not null,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  unique (tenant_id, attribute_type_id, code)
);

create table product_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  parent_id uuid references product_categories (id),
  code text not null,
  name text not null,
  is_active boolean not null default true,
  unique (tenant_id, code)
);

create type inventory_tracking_mode as enum ('simple', 'batch', 'unit');

create table products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  sku text not null,
  barcode text,
  qr_code_value text,
  name text not null,
  category_id uuid references product_categories (id),
  material_type_id uuid references product_lookup_values (id),
  variety_id uuid references product_lookup_values (id),
  brand_id uuid references product_lookup_values (id),
  collection_id uuid references product_lookup_values (id),
  color_id uuid references product_lookup_values (id),
  pattern_id uuid references product_lookup_values (id),
  origin_id uuid references product_lookup_values (id),
  grade_id uuid references product_lookup_values (id),
  finish_id uuid references product_lookup_values (id),
  surface_id uuid references product_lookup_values (id),
  application_id uuid references product_lookup_values (id),
  inventory_tracking_mode inventory_tracking_mode not null default 'simple',
  base_uom_id uuid not null references uom (id),
  purchase_uom_id uuid references uom (id),
  sales_uom_id uuid references uom (id),
  cost_price numeric(18, 4),          -- financial field, gated via view_cost
  standard_margin_pct numeric(6, 3),  -- financial field, gated via view_profit
  is_active boolean not null default true,
  created_by uuid references profiles (id),
  updated_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, sku)
);

alter table uom_conversions
  add constraint uom_conversions_product_fk foreign key (product_id) references products (id) on delete cascade;

create table product_dimensions (
  product_id uuid primary key references products (id) on delete cascade,
  thickness_value numeric(10, 3),
  thickness_uom_id uuid references uom (id),
  length_value numeric(10, 3),
  width_value numeric(10, 3),
  size_uom_id uuid references uom (id),
  weight_value numeric(10, 3),
  weight_uom_id uuid references uom (id)
);
