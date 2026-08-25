-- Tenancy core: tenants, profiles (1:1 with auth.users), tenant membership.

create type tenant_status as enum ('trial', 'active', 'suspended', 'cancelled');

create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status tenant_status not null default 'trial',
  plan text not null default 'standard',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table user_tenants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  tenant_id uuid not null references tenants (id) on delete cascade,
  is_active boolean not null default true,
  invited_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  unique (user_id, tenant_id)
);

-- Auto-create a profile row whenever a Supabase auth user is created.
create function handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger trg_handle_new_auth_user
  after insert on auth.users
  for each row execute function handle_new_auth_user();
