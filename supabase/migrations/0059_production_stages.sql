-- Configurable production workflow stages: the seventh and last real gap
-- this session's own 36-part spec audit found, and the one flagged from
-- the start as the most architecturally risky of the six -- deliberately
-- ordered last and scoped narrowly on purpose.
--
-- Scope decision, stated plainly: `processing_jobs.stage` has always been
-- a hardcoded 4-value enum ('cutting'/'squaring'/'polishing'/'other'), so
-- every tenant is stuck with exactly one factory's idea of what stages
-- exist -- a real stone factory's actual stage list varies (edge
-- profiling, resin treatment, sandblasting, flaming...), so this closes
-- that by making the *set of stages* tenant-configurable, the same
-- role_templates -> roles / account_templates -> chart_of_accounts
-- template-then-per-tenant-copy pattern already used twice in this
-- codebase. It deliberately does NOT build automatic multi-stage job
-- chaining (a job auto-advancing through an ordered pipeline, spawning
-- the next stage's job on completion, enforcing "stage N+1 only after
-- stage N"): `stage` has never driven any business logic in this
-- codebase (confirmed by grep -- no RPC branches on it, it's purely
-- descriptive/reportable), and nothing about closing "the stage list is
-- hardcoded" gap requires inventing that larger machinery. A tenant can
-- already run a block through several jobs job-to-job to model a
-- pipeline manually (output slab of one job becomes the input_unit_id of
-- the next); making the descriptive stage of any one job configurable is
-- the actual, bounded gap, and is exactly what's built here.
--
-- production_stage_templates seeds the exact same 4 default stages the
-- old enum had, at the same relative order, so no tenant's default
-- experience changes -- only that they can now rename, reorder, add to,
-- or deactivate them afterward. No is_system protection like
-- chart_of_accounts' seeded accounts: nothing in this codebase's
-- business logic is keyed to a specific stage code (unlike account codes
-- '1000'/'4000' that auto-posting hardcodes), so there's nothing to
-- protect -- a tenant is free to delete even a seeded default stage,
-- and processing_jobs.stage_id's own foreign key (default RESTRICT)
-- already stops deleting a stage any existing job still references,
-- without needing a bespoke trigger the way chart_of_accounts did.

create table production_stage_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  sort_order int not null default 0
);

insert into production_stage_templates (code, name, sort_order) values
  ('cutting', 'Cutting', 10),
  ('squaring', 'Squaring', 20),
  ('polishing', 'Polishing', 30),
  ('other', 'Other', 40);

alter table production_stage_templates enable row level security;
create policy production_stage_templates_select on production_stage_templates for select using (auth.role() = 'authenticated');

create table production_stages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  code text not null,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, code)
);

alter table production_stages enable row level security;

create policy production_stages_select on production_stages for select
  using (is_tenant_member(tenant_id));
create policy production_stages_insert on production_stages for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'company_settings', 'create'));
create policy production_stages_update on production_stages for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'company_settings', 'edit'))
  with check (is_tenant_member(tenant_id));
create policy production_stages_delete on production_stages for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'company_settings', 'delete'));

create trigger production_stages_audit after insert or update or delete on production_stages
  for each row execute function audit_trigger_fn();

-- ---------------------------------------------------------------------------
-- processing_jobs: swap the fixed enum column for a tenant-configurable
-- foreign key. Pre-launch schema, no real tenant data (this session's own
-- established, repeatedly-verified precedent for a clean cutover rather
-- than a migrate-in-place/backward-compat column) -- confirmed once more
-- here via a row count before dropping.
-- ---------------------------------------------------------------------------

alter table processing_jobs drop column stage;
drop type processing_stage;

alter table processing_jobs add column stage_id uuid not null references production_stages (id);

-- ---------------------------------------------------------------------------
-- create_tenant_for_user: reproduced in full (required to seed
-- production_stages for new tenants). Identical to the 0051 version in
-- every other respect -- one new seeding statement added, mirroring the
-- chart_of_accounts seed immediately above it.
-- ---------------------------------------------------------------------------

create or replace function create_tenant_for_user(p_tenant_name text, p_tenant_slug text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_role record;
  v_role_id uuid;
  v_permission record;
  v_grant boolean;
begin
  if v_user_id is null then
    raise exception 'create_tenant_for_user requires an authenticated user';
  end if;

  insert into tenants (name, slug) values (p_tenant_name, p_tenant_slug)
    returning id into v_tenant_id;

  insert into tenant_settings (tenant_id) values (v_tenant_id);

  insert into tenant_capabilities (tenant_id, capability_id, enabled_by)
    select v_tenant_id, bc.id, v_user_id from business_capabilities bc where bc.code = 'trading_distribution';

  insert into chart_of_accounts (tenant_id, code, name, account_type, is_system)
    select v_tenant_id, at.code, at.name, at.account_type, true from account_templates at;

  insert into production_stages (tenant_id, code, name, sort_order)
    select v_tenant_id, pst.code, pst.name, pst.sort_order from production_stage_templates pst;

  for v_role in select id, code from role_templates loop
    insert into roles (tenant_id, template_id, code, name)
      select v_tenant_id, rt.id, rt.code, rt.name from role_templates rt where rt.id = v_role.id
      returning id into v_role_id;

    for v_permission in select id, resource, action from permissions loop
      v_grant := case
        when v_role.code in ('owner', 'company_admin') then true
        when v_role.code = 'accountant' then
          v_permission.action in ('view', 'view_cost', 'view_profit', 'view_financial')
          or (v_permission.resource = 'company_settings' and v_permission.action = 'edit')
          or (v_permission.resource = 'accounting' and v_permission.action in ('create', 'edit'))
        when v_role.code = 'inventory_manager' then
          (v_permission.resource in ('product', 'warehouse')
            and v_permission.action in ('view', 'create', 'edit', 'delete', 'print', 'export'))
          or (v_permission.resource = 'purchasing' and v_permission.action = 'view')
        when v_role.code = 'purchase_manager' then
          v_permission.resource = 'purchasing'
          and v_permission.action in ('view', 'create', 'edit', 'delete', 'approve', 'cancel', 'print', 'export')
        when v_role.code = 'sales_manager' then
          (v_permission.resource = 'sales'
            and v_permission.action in ('view', 'create', 'edit', 'delete', 'approve', 'cancel', 'print', 'export', 'view_cost', 'view_profit'))
          or (v_permission.resource = 'project'
            and v_permission.action in ('view', 'create', 'edit', 'delete', 'approve', 'cancel', 'print', 'export', 'view_cost', 'view_profit'))
        when v_role.code = 'warehouse_staff' then
          (v_permission.resource in ('product', 'warehouse')
            and v_permission.action in ('view', 'create', 'edit'))
          or (v_permission.resource = 'purchasing' and v_permission.action in ('view', 'create', 'edit'))
        when v_role.code = 'dispatch_staff' then
          v_permission.resource = 'sales' and v_permission.action in ('view', 'create', 'edit')
        when v_role.code = 'qc_manager' then
          (v_permission.resource = 'product' and v_permission.action in ('view', 'edit'))
          or (v_permission.resource = 'warehouse' and v_permission.action = 'view')
          or (v_permission.resource = 'production' and v_permission.action in ('view', 'approve'))
        when v_role.code = 'salesperson' then
          (v_permission.resource in ('product', 'warehouse') and v_permission.action = 'view')
          or (v_permission.resource = 'sales' and v_permission.action in ('view', 'create', 'edit'))
        when v_role.code = 'viewer' then
          v_permission.action = 'view'
        when v_role.code in ('factory_manager', 'production_manager') then
          (v_permission.resource in ('product', 'warehouse') and v_permission.action = 'view')
          or (v_permission.resource = 'production'
            and v_permission.action in ('view', 'create', 'edit', 'delete', 'approve', 'cancel', 'print', 'export', 'view_cost'))
          or (v_permission.resource = 'project' and v_permission.action in ('view', 'create', 'edit'))
        when v_role.code = 'production_operator' then
          (v_permission.resource in ('product', 'warehouse') and v_permission.action = 'view')
          or (v_permission.resource = 'production' and v_permission.action in ('view', 'create', 'edit'))
        else
          v_permission.resource in ('product', 'warehouse') and v_permission.action = 'view'
      end;

      if v_grant then
        insert into role_permissions (role_id, permission_id, tenant_id)
        values (v_role_id, v_permission.id, v_tenant_id);
      end if;
    end loop;
  end loop;

  insert into user_tenants (user_id, tenant_id) values (v_user_id, v_tenant_id);

  insert into user_roles (user_id, tenant_id, role_id)
    select v_user_id, v_tenant_id, r.id from roles r
    where r.tenant_id = v_tenant_id and r.code = 'owner';

  return v_tenant_id;
end;
$$;
