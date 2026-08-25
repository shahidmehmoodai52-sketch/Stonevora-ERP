-- Tenant isolation core. This is the safety-critical migration: every tenant-scoped
-- table gets Row-Level Security enabled and a uniform 4-policy pattern built on two
-- security-definer helper functions. Both helpers pin search_path explicitly —
-- an unpinned search_path on a security-definer function is a privilege-escalation
-- vector.

create function is_tenant_member(check_tenant_id uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from user_tenants ut
    where ut.tenant_id = check_tenant_id
      and ut.user_id = auth.uid()
      and ut.is_active = true
  );
$$;

create function has_permission(check_tenant_id uuid, p_resource text, p_action text) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from user_roles ur
    join role_permissions rp on rp.role_id = ur.role_id
    join permissions p on p.id = rp.permission_id
    where ur.tenant_id = check_tenant_id
      and ur.user_id = auth.uid()
      and p.resource = p_resource
      and p.action = p_action
  );
$$;

-- ---------------------------------------------------------------------------
-- Global read-only reference tables: visible to any authenticated user,
-- writable only by the service role (RLS has no policy permitting client writes).
-- ---------------------------------------------------------------------------

alter table role_templates enable row level security;
create policy role_templates_select on role_templates for select using (auth.role() = 'authenticated');

alter table permissions enable row level security;
create policy permissions_select on permissions for select using (auth.role() = 'authenticated');

alter table product_attribute_types enable row level security;
create policy product_attribute_types_select on product_attribute_types for select using (auth.role() = 'authenticated');

alter table countries enable row level security;
create policy countries_select on countries for select using (auth.role() = 'authenticated');

alter table currencies enable row level security;
create policy currencies_select on currencies for select using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- tenants: visible to members; updatable by members with company_settings.edit.
-- Insert/delete intentionally has no policy — only the service-role tenant-
-- creation action may create or remove a tenant.
-- ---------------------------------------------------------------------------

alter table tenants enable row level security;

create policy tenants_select on tenants for select
  using (is_tenant_member(id));

create policy tenants_update on tenants for update
  using (is_tenant_member(id) and has_permission(id, 'company_settings', 'edit'))
  with check (is_tenant_member(id));

-- ---------------------------------------------------------------------------
-- profiles: a user always sees their own profile, plus profiles of anyone who
-- shares at least one tenant with them (needed for user-management screens).
-- ---------------------------------------------------------------------------

alter table profiles enable row level security;

create policy profiles_select on profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1 from user_tenants ut1
      join user_tenants ut2 on ut1.tenant_id = ut2.tenant_id
      where ut1.user_id = auth.uid() and ut2.user_id = profiles.id
    )
  );

create policy profiles_update on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Standard tenant-scoped tables: select/insert/update/delete gated by
-- is_tenant_member + has_permission(tenant_id, resource, action).
-- ---------------------------------------------------------------------------

-- user_tenants / roles / role_permissions / user_roles -> resource 'user_management'

alter table user_tenants enable row level security;
create policy user_tenants_select on user_tenants for select using (is_tenant_member(tenant_id));
create policy user_tenants_insert on user_tenants for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'user_management', 'create'));
create policy user_tenants_update on user_tenants for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'user_management', 'edit'))
  with check (is_tenant_member(tenant_id));
create policy user_tenants_delete on user_tenants for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'user_management', 'delete'));

alter table roles enable row level security;
create policy roles_select on roles for select using (is_tenant_member(tenant_id));
create policy roles_insert on roles for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'user_management', 'create'));
create policy roles_update on roles for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'user_management', 'edit'))
  with check (is_tenant_member(tenant_id));
create policy roles_delete on roles for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'user_management', 'delete'));

alter table role_permissions enable row level security;
create policy role_permissions_select on role_permissions for select using (is_tenant_member(tenant_id));
create policy role_permissions_insert on role_permissions for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'user_management', 'edit'));
create policy role_permissions_delete on role_permissions for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'user_management', 'edit'));

alter table user_roles enable row level security;
create policy user_roles_select on user_roles for select using (is_tenant_member(tenant_id));
create policy user_roles_insert on user_roles for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'user_management', 'create'));
create policy user_roles_update on user_roles for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'user_management', 'edit'))
  with check (is_tenant_member(tenant_id));
create policy user_roles_delete on user_roles for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'user_management', 'delete'));

-- branches / tenant_settings / tax_types / tax_rates / fiscal_years -> resource 'company_settings'

alter table branches enable row level security;
create policy branches_select on branches for select using (is_tenant_member(tenant_id));
create policy branches_insert on branches for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'company_settings', 'create'));
create policy branches_update on branches for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'company_settings', 'edit'))
  with check (is_tenant_member(tenant_id));
create policy branches_delete on branches for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'company_settings', 'delete'));

alter table tenant_settings enable row level security;
create policy tenant_settings_select on tenant_settings for select using (is_tenant_member(tenant_id));
create policy tenant_settings_insert on tenant_settings for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'company_settings', 'create'));
create policy tenant_settings_update on tenant_settings for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'company_settings', 'edit'))
  with check (is_tenant_member(tenant_id));

alter table tax_types enable row level security;
create policy tax_types_select on tax_types for select using (is_tenant_member(tenant_id));
create policy tax_types_insert on tax_types for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'company_settings', 'create'));
create policy tax_types_update on tax_types for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'company_settings', 'edit'))
  with check (is_tenant_member(tenant_id));
create policy tax_types_delete on tax_types for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'company_settings', 'delete'));

alter table tax_rates enable row level security;
create policy tax_rates_select on tax_rates for select using (is_tenant_member(tenant_id));
create policy tax_rates_insert on tax_rates for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'company_settings', 'create'));
create policy tax_rates_update on tax_rates for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'company_settings', 'edit'))
  with check (is_tenant_member(tenant_id));
create policy tax_rates_delete on tax_rates for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'company_settings', 'delete'));

alter table fiscal_years enable row level security;
create policy fiscal_years_select on fiscal_years for select using (is_tenant_member(tenant_id));
create policy fiscal_years_insert on fiscal_years for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'company_settings', 'create'));
create policy fiscal_years_update on fiscal_years for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'company_settings', 'edit'))
  with check (is_tenant_member(tenant_id));
create policy fiscal_years_delete on fiscal_years for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'company_settings', 'delete'));

-- warehouses / storage_locations -> resource 'warehouse'

alter table warehouses enable row level security;
create policy warehouses_select on warehouses for select using (is_tenant_member(tenant_id));
create policy warehouses_insert on warehouses for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'warehouse', 'create'));
create policy warehouses_update on warehouses for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'warehouse', 'edit'))
  with check (is_tenant_member(tenant_id));
create policy warehouses_delete on warehouses for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'warehouse', 'delete'));

alter table storage_locations enable row level security;
create policy storage_locations_select on storage_locations for select using (is_tenant_member(tenant_id));
create policy storage_locations_insert on storage_locations for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'warehouse', 'create'));
create policy storage_locations_update on storage_locations for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'warehouse', 'edit'))
  with check (is_tenant_member(tenant_id));
create policy storage_locations_delete on storage_locations for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'warehouse', 'delete'));

-- product_categories / product_lookup_values / products / product_dimensions /
-- inventory_units / inventory_batches / inventory_stock -> resource 'product'

alter table product_categories enable row level security;
create policy product_categories_select on product_categories for select using (is_tenant_member(tenant_id));
create policy product_categories_insert on product_categories for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'product', 'create'));
create policy product_categories_update on product_categories for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'product', 'edit'))
  with check (is_tenant_member(tenant_id));
create policy product_categories_delete on product_categories for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'product', 'delete'));

alter table product_lookup_values enable row level security;
create policy product_lookup_values_select on product_lookup_values for select using (is_tenant_member(tenant_id));
create policy product_lookup_values_insert on product_lookup_values for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'product', 'create'));
create policy product_lookup_values_update on product_lookup_values for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'product', 'edit'))
  with check (is_tenant_member(tenant_id));
create policy product_lookup_values_delete on product_lookup_values for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'product', 'delete'));

alter table products enable row level security;
create policy products_select on products for select using (is_tenant_member(tenant_id));
create policy products_insert on products for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'product', 'create'));
create policy products_update on products for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'product', 'edit'))
  with check (is_tenant_member(tenant_id));
create policy products_delete on products for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'product', 'delete'));

alter table product_dimensions enable row level security;
create policy product_dimensions_select on product_dimensions for select
  using (exists (select 1 from products p where p.id = product_dimensions.product_id and is_tenant_member(p.tenant_id)));
create policy product_dimensions_insert on product_dimensions for insert
  with check (exists (select 1 from products p where p.id = product_dimensions.product_id and is_tenant_member(p.tenant_id) and has_permission(p.tenant_id, 'product', 'create')));
create policy product_dimensions_update on product_dimensions for update
  using (exists (select 1 from products p where p.id = product_dimensions.product_id and is_tenant_member(p.tenant_id) and has_permission(p.tenant_id, 'product', 'edit')))
  with check (exists (select 1 from products p where p.id = product_dimensions.product_id and is_tenant_member(p.tenant_id)));
create policy product_dimensions_delete on product_dimensions for delete
  using (exists (select 1 from products p where p.id = product_dimensions.product_id and is_tenant_member(p.tenant_id) and has_permission(p.tenant_id, 'product', 'delete')));

alter table inventory_units enable row level security;
create policy inventory_units_select on inventory_units for select using (is_tenant_member(tenant_id));
create policy inventory_units_insert on inventory_units for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'product', 'create'));
create policy inventory_units_update on inventory_units for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'product', 'edit'))
  with check (is_tenant_member(tenant_id));
create policy inventory_units_delete on inventory_units for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'product', 'delete'));

alter table inventory_batches enable row level security;
create policy inventory_batches_select on inventory_batches for select using (is_tenant_member(tenant_id));
create policy inventory_batches_insert on inventory_batches for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'product', 'create'));
create policy inventory_batches_update on inventory_batches for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'product', 'edit'))
  with check (is_tenant_member(tenant_id));
create policy inventory_batches_delete on inventory_batches for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'product', 'delete'));

alter table inventory_stock enable row level security;
create policy inventory_stock_select on inventory_stock for select using (is_tenant_member(tenant_id));
create policy inventory_stock_insert on inventory_stock for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'product', 'create'));
create policy inventory_stock_update on inventory_stock for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'product', 'edit'))
  with check (is_tenant_member(tenant_id));
create policy inventory_stock_delete on inventory_stock for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'product', 'delete'));

-- uom / uom_conversions: select allows global (tenant_id is null) rows plus the
-- tenant's own custom rows; writes require a non-null tenant_id (no client can
-- create/edit/delete global rows) plus 'product' permission.

alter table uom enable row level security;
create policy uom_select on uom for select using (tenant_id is null or is_tenant_member(tenant_id));
create policy uom_insert on uom for insert
  with check (tenant_id is not null and is_tenant_member(tenant_id) and has_permission(tenant_id, 'product', 'create'));
create policy uom_update on uom for update
  using (tenant_id is not null and is_tenant_member(tenant_id) and has_permission(tenant_id, 'product', 'edit'))
  with check (tenant_id is not null and is_tenant_member(tenant_id));
create policy uom_delete on uom for delete
  using (tenant_id is not null and is_tenant_member(tenant_id) and has_permission(tenant_id, 'product', 'delete'));

alter table uom_conversions enable row level security;
create policy uom_conversions_select on uom_conversions for select using (tenant_id is null or is_tenant_member(tenant_id));
create policy uom_conversions_insert on uom_conversions for insert
  with check (tenant_id is not null and is_tenant_member(tenant_id) and has_permission(tenant_id, 'product', 'create'));
create policy uom_conversions_update on uom_conversions for update
  using (tenant_id is not null and is_tenant_member(tenant_id) and has_permission(tenant_id, 'product', 'edit'))
  with check (tenant_id is not null and is_tenant_member(tenant_id));
create policy uom_conversions_delete on uom_conversions for delete
  using (tenant_id is not null and is_tenant_member(tenant_id) and has_permission(tenant_id, 'product', 'delete'));

-- audit_log: read-only to tenant members; no client insert/update/delete policy —
-- only the security-definer audit_trigger_fn (running with elevated privileges)
-- writes rows.

alter table audit_log enable row level security;
create policy audit_log_select on audit_log for select using (is_tenant_member(tenant_id));
