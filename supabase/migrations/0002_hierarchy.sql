-- Company/Branch/Warehouse/Storage-location hierarchy.

create table branches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  code text not null,
  name text not null,
  is_head_office boolean not null default false,
  address text,
  city text,
  country_code char(2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, code)
);

alter table user_tenants
  add column default_branch_id uuid references branches (id);

create type warehouse_type as enum ('warehouse', 'yard', 'showroom');

create table warehouses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  branch_id uuid not null references branches (id) on delete cascade,
  code text not null,
  name text not null,
  type warehouse_type not null default 'warehouse',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create type storage_location_type as enum ('zone', 'row', 'rack', 'position');

create table storage_locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  warehouse_id uuid not null references warehouses (id) on delete cascade,
  parent_id uuid references storage_locations (id) on delete cascade,
  location_type storage_location_type not null,
  code text not null,
  name text,
  path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, warehouse_id, parent_id, code)
);

-- Maintains a human-readable materialized path (e.g. "Z1/R2/RK3/P4") for display.
create function storage_location_set_path() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  parent_path text;
begin
  if new.parent_id is null then
    new.path := new.code;
  else
    select path into parent_path from storage_locations where id = new.parent_id;
    new.path := coalesce(parent_path || '/', '') || new.code;
  end if;
  return new;
end;
$$;

create trigger trg_storage_location_set_path
  before insert or update of parent_id, code on storage_locations
  for each row execute function storage_location_set_path();
