-- Business capability model: lets a tenant be configured as any combination of
-- retail/wholesale/distribution/showroom/factory/fabrication/tile-manufacturing
-- rather than forcing full factory complexity on a small retail shop (or vice
-- versa). Deliberately NOT a single "business_profile" enum on tenant_settings:
-- a tenant can run several modes at once (e.g. wholesale + distribution), and a
-- single mutable enum plus a separate capability list would be two competing
-- sources of truth for "what can this tenant do" — the rule this schema exists
-- to avoid. tenant_capabilities is the one source of truth; onboarding/settings
-- UI may offer preset bundles, but those are just a convenience that inserts
-- rows here, never a stored field of their own.
--
-- Reuses the existing product_attribute_types (global catalog) + tenant junction
-- pattern from 0005_product_master.sql, and the existing 'company_settings'
-- permission resource (toggling what a tenant can do is a company-settings
-- action) rather than introducing a new permission resource for one settings
-- screen.

create table business_capabilities (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null,
  sort_order int not null default 0
);

create table tenant_capabilities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  capability_id uuid not null references business_capabilities (id),
  enabled_at timestamptz not null default now(),
  enabled_by uuid references profiles (id),
  unique (tenant_id, capability_id)
);

create index tenant_capabilities_tenant_id_idx on tenant_capabilities (tenant_id);

insert into business_capabilities (code, name, description, sort_order) values
  ('trading_distribution', 'Trading / Distribution', 'Suppliers, purchase orders, goods receipts, sales orders, deliveries, invoicing and payments.', 10),
  ('wholesale_dealer', 'Wholesale / Dealer', 'Dealer pricing tiers, credit terms and bulk sales workflows on top of Trading/Distribution.', 20),
  ('retail_shop', 'Retail Shop', 'Simplified single-screen sale workflow for small showrooms and counters.', 30),
  ('showroom_reservation', 'Showroom Reservation', 'Hold/reserve stock for a walk-in customer before converting to a sales order.', 40),
  ('block_slab_factory', 'Block/Slab Factory', 'Raw block intake, cutting/processing and graded slab output with yield tracking.', 50),
  ('stone_fabrication', 'Stone Fabrication / Projects', 'Project-based fabrication job costing consuming slab inventory.', 60),
  ('tile_manufacturing', 'Tile Manufacturing', 'Recipe/BOM batch production with shade, caliber and QC tracking.', 70),
  ('multi_branch', 'Multi-Branch / Multi-Godown', 'Operate across more than one branch or warehouse with branch-level reporting.', 80);

-- Global catalog: readable by any authenticated user, like product_attribute_types.
alter table business_capabilities enable row level security;
create policy business_capabilities_select on business_capabilities for select using (auth.role() = 'authenticated');

-- Tenant junction: standard is_tenant_member + has_permission(company_settings, ...) shape.
alter table tenant_capabilities enable row level security;
create policy tenant_capabilities_select on tenant_capabilities for select using (is_tenant_member(tenant_id));
create policy tenant_capabilities_insert on tenant_capabilities for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'company_settings', 'edit'));
create policy tenant_capabilities_delete on tenant_capabilities for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'company_settings', 'edit'));

create trigger tenant_capabilities_audit
  after insert or delete on tenant_capabilities
  for each row execute function audit_trigger_fn();

-- New tenants get Trading/Distribution enabled by default (the one mode that is
-- actually built today); every other capability is opt-in. Existing tenants are
-- backfilled the same way rather than left without a row, since the app's nav
-- will start reading this table.
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
        when v_role.code = 'inventory_manager' then
          (v_permission.resource in ('product', 'warehouse')
            and v_permission.action in ('view', 'create', 'edit', 'delete', 'print', 'export'))
          or (v_permission.resource = 'purchasing' and v_permission.action = 'view')
        when v_role.code = 'purchase_manager' then
          v_permission.resource = 'purchasing'
          and v_permission.action in ('view', 'create', 'edit', 'delete', 'approve', 'cancel', 'print', 'export')
        when v_role.code = 'sales_manager' then
          v_permission.resource = 'sales'
          and v_permission.action in ('view', 'create', 'edit', 'delete', 'approve', 'cancel', 'print', 'export', 'view_cost', 'view_profit')
        when v_role.code = 'warehouse_staff' then
          (v_permission.resource in ('product', 'warehouse')
            and v_permission.action in ('view', 'create', 'edit'))
          or (v_permission.resource = 'purchasing' and v_permission.action in ('view', 'create', 'edit'))
        when v_role.code = 'dispatch_staff' then
          v_permission.resource = 'sales' and v_permission.action in ('view', 'create', 'edit')
        when v_role.code = 'qc_manager' then
          (v_permission.resource = 'product' and v_permission.action in ('view', 'edit'))
          or (v_permission.resource = 'warehouse' and v_permission.action = 'view')
        when v_role.code = 'salesperson' then
          (v_permission.resource in ('product', 'warehouse') and v_permission.action = 'view')
          or (v_permission.resource = 'sales' and v_permission.action in ('view', 'create', 'edit'))
        when v_role.code = 'viewer' then
          v_permission.action = 'view'
        else -- factory_manager, production_manager, production_operator: baseline view
             -- access; module-specific grants land with the Factory/Production phase.
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

insert into tenant_capabilities (tenant_id, capability_id)
select t.id, bc.id
from tenants t
cross join business_capabilities bc
where bc.code = 'trading_distribution'
  and not exists (
    select 1 from tenant_capabilities tc where tc.tenant_id = t.id and tc.capability_id = bc.id
  );
