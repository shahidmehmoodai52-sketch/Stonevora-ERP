-- Performance advisor fixes.
--
-- 1) auth_rls_initplan: wrap auth.<fn>() calls in RLS policies with `(select ...)`
--    so Postgres evaluates them once per query instead of once per row.
-- 2) unindexed_foreign_keys: add covering indexes on every flagged FK column so
--    joins/lookups stay fast as tables grow to hundreds of thousands of rows.

alter policy role_templates_select on role_templates using ((select auth.role()) = 'authenticated');
alter policy permissions_select on permissions using ((select auth.role()) = 'authenticated');
alter policy product_attribute_types_select on product_attribute_types using ((select auth.role()) = 'authenticated');
alter policy countries_select on countries using ((select auth.role()) = 'authenticated');
alter policy currencies_select on currencies using ((select auth.role()) = 'authenticated');

alter policy profiles_select on profiles using (
  id = (select auth.uid())
  or exists (
    select 1 from user_tenants ut1
    join user_tenants ut2 on ut1.tenant_id = ut2.tenant_id
    where ut1.user_id = (select auth.uid()) and ut2.user_id = profiles.id
  )
);

alter policy profiles_update on profiles
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Covering indexes for flagged foreign keys.
create index idx_audit_log_changed_by on audit_log (changed_by);

create index idx_inventory_batches_current_location_id on inventory_batches (current_location_id);
create index idx_inventory_batches_product_id on inventory_batches (product_id);
create index idx_inventory_batches_uom_id on inventory_batches (uom_id);

create index idx_inventory_stock_location_id on inventory_stock (location_id);
create index idx_inventory_stock_product_id on inventory_stock (product_id);
create index idx_inventory_stock_uom_id on inventory_stock (uom_id);

create index idx_inventory_units_current_location_id on inventory_units (current_location_id);
create index idx_inventory_units_product_id on inventory_units (product_id);

create index idx_product_categories_parent_id on product_categories (parent_id);

create index idx_product_dimensions_size_uom_id on product_dimensions (size_uom_id);
create index idx_product_dimensions_thickness_uom_id on product_dimensions (thickness_uom_id);
create index idx_product_dimensions_weight_uom_id on product_dimensions (weight_uom_id);

create index idx_product_lookup_values_attribute_type_id on product_lookup_values (attribute_type_id);

create index idx_products_application_id on products (application_id);
create index idx_products_base_uom_id on products (base_uom_id);
create index idx_products_brand_id on products (brand_id);
create index idx_products_category_id on products (category_id);
create index idx_products_collection_id on products (collection_id);
create index idx_products_color_id on products (color_id);
create index idx_products_created_by on products (created_by);
create index idx_products_finish_id on products (finish_id);
create index idx_products_grade_id on products (grade_id);
create index idx_products_material_type_id on products (material_type_id);
create index idx_products_origin_id on products (origin_id);
create index idx_products_pattern_id on products (pattern_id);
create index idx_products_purchase_uom_id on products (purchase_uom_id);
create index idx_products_sales_uom_id on products (sales_uom_id);
create index idx_products_surface_id on products (surface_id);
create index idx_products_updated_by on products (updated_by);
create index idx_products_variety_id on products (variety_id);

create index idx_role_permissions_permission_id on role_permissions (permission_id);
create index idx_role_permissions_tenant_id on role_permissions (tenant_id);

create index idx_roles_template_id on roles (template_id);

create index idx_storage_locations_parent_id on storage_locations (parent_id);
create index idx_storage_locations_warehouse_id on storage_locations (warehouse_id);

create index idx_tax_rates_tax_type_id on tax_rates (tax_type_id);
create index idx_tax_rates_tenant_id on tax_rates (tenant_id);

create index idx_tenant_settings_base_currency_id on tenant_settings (base_currency_id);
create index idx_tenant_settings_country_id on tenant_settings (country_id);

create index idx_uom_conversions_from_uom_id on uom_conversions (from_uom_id);
create index idx_uom_conversions_to_uom_id on uom_conversions (to_uom_id);
create index idx_uom_conversions_product_id on uom_conversions (product_id);

create index idx_user_roles_branch_id on user_roles (branch_id);
create index idx_user_roles_role_id on user_roles (role_id);
create index idx_user_roles_tenant_id on user_roles (tenant_id);

create index idx_user_tenants_default_branch_id on user_tenants (default_branch_id);
create index idx_user_tenants_invited_by on user_tenants (invited_by);
create index idx_user_tenants_tenant_id on user_tenants (tenant_id);

create index idx_warehouses_branch_id on warehouses (branch_id);
