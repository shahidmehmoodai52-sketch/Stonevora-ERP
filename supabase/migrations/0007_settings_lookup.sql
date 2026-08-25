-- Country/currency/tax/fiscal-year config. International-ready: no country hardcoding.

create table countries (
  id uuid primary key default gen_random_uuid(),
  iso_code2 char(2) unique,
  iso_code3 char(3) unique,
  name text not null
);

create table currencies (
  id uuid primary key default gen_random_uuid(),
  iso_code char(3) unique,
  name text not null,
  symbol text,
  decimal_places int not null default 2
);

create table tenant_settings (
  tenant_id uuid primary key references tenants (id) on delete cascade,
  country_id uuid references countries (id),
  base_currency_id uuid references currencies (id),
  fiscal_year_start_month smallint not null default 1,
  timezone text not null default 'UTC',
  date_format text not null default 'YYYY-MM-DD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tax_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  code text not null,
  name text not null,
  unique (tenant_id, code)
);

create table tax_rates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  tax_type_id uuid not null references tax_types (id),
  name text not null,
  rate_percent numeric(6, 3) not null,
  effective_from date not null,
  effective_to date,
  is_active boolean not null default true
);

create table fiscal_years (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  is_closed boolean not null default false,
  unique (tenant_id, name)
);
