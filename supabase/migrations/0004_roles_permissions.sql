-- Roles & permissions: global role/permission catalogs, per-tenant instantiation.

create table role_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text
);

create table roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  template_id uuid references role_templates (id), -- null = fully custom role
  code text not null,
  name text not null,
  is_system boolean not null default true, -- false once tenant edits/creates custom roles
  created_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table permissions (
  id uuid primary key default gen_random_uuid(),
  resource text not null, -- 'product', 'company_settings', 'warehouse', 'user_management', ...
  action text not null,   -- 'view','create','edit','delete','approve','cancel','print','export','view_cost','view_profit','view_financial'
  description text,
  unique (resource, action)
);

create table role_permissions (
  role_id uuid not null references roles (id) on delete cascade,
  permission_id uuid not null references permissions (id) on delete cascade,
  tenant_id uuid not null references tenants (id) on delete cascade, -- denormalized for direct RLS filtering
  primary key (role_id, permission_id)
);

create table user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  tenant_id uuid not null references tenants (id) on delete cascade,
  role_id uuid not null references roles (id) on delete cascade,
  branch_id uuid references branches (id), -- optional: scope a role to one branch
  created_at timestamptz not null default now(),
  unique (user_id, tenant_id, role_id, branch_id)
);
