-- Phase 1 (Trading/Distribution): suppliers, customers, price lists.

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  code text not null,
  name text not null,
  contact_name text,
  phone text,
  email text,
  address text,
  city text,
  country_code char(2),
  tax_id text,
  payment_terms_days int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create type customer_type as enum ('retail', 'dealer', 'contractor', 'project', 'corporate', 'international');

create table customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  code text not null,
  name text not null,
  customer_type customer_type not null default 'retail',
  contact_name text,
  phone text,
  email text,
  billing_address text,
  shipping_address text,
  tax_id text,
  price_list_id uuid, -- fk added after price_lists exists
  credit_limit numeric(18, 4),
  payment_terms_days int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

-- Price lists: one mechanism covers retail/dealer/wholesale/project pricing —
-- a tenant creates as many price lists as their pricing tiers require and
-- assigns one to each customer, rather than hard-coding tier discount rules.
create table price_lists (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  code text not null,
  name text not null,
  currency_id uuid references currencies (id),
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, code)
);

alter table customers
  add constraint customers_price_list_fk foreign key (price_list_id) references price_lists (id);

-- Price history is preserved via effective_from/effective_to rather than
-- overwriting a single "price" column.
create table price_list_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  price_list_id uuid not null references price_lists (id) on delete cascade,
  product_id uuid not null references products (id),
  price numeric(18, 4) not null,
  effective_from date not null default current_date,
  effective_to date,
  created_at timestamptz not null default now(),
  unique (tenant_id, price_list_id, product_id, effective_from)
);

create index idx_customers_price_list_id on customers (price_list_id);
create index idx_price_list_items_price_list_id on price_list_items (price_list_id);
create index idx_price_list_items_product_id on price_list_items (product_id);
create index idx_price_lists_currency_id on price_lists (currency_id);
