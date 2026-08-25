-- Foundation hardening #3 (pre-Block/Slab): category-specific attribute
-- architecture, per docs/PRE_FACTORY_ARCHITECTURE_AUDIT.md section 5.
--
-- The existing products table already avoids the worst anti-pattern (raw
-- text duplication) via product_lookup_values, but wires exactly 11 fixed FK
-- columns onto every product row regardless of category -- a bag of grout
-- carries variety_id/pattern_id/finish_id columns it will never use, and a
-- tile has no slot at all for a plain number like "pieces per box". This is
-- NOT a rewrite of that table (still not warranted -- the 11 columns cover
-- attributes common enough across categories to earn a fixed column, exactly
-- like product_dimensions already does). It is two additive tables:
--
-- 1. category_attribute_templates: declares which of the existing
--    product_attribute_types are relevant to a given category, so a product
--    form can show only the lookup pickers that category actually uses.
-- 2. product_numeric_attributes: an EAV-style table for the genuinely
--    variable NUMERIC facts a lookup value can't represent (tile's pieces-
--    per-box, area-per-box, boxes-per-pallet) -- reusing the existing
--    product_attribute_types catalog rather than a parallel one.

create table category_attribute_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  category_id uuid not null references product_categories (id) on delete cascade,
  attribute_type_id uuid not null references product_attribute_types (id),
  is_required boolean not null default false,
  sort_order int not null default 0,
  unique (tenant_id, category_id, attribute_type_id)
);

create table product_numeric_attributes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  attribute_type_id uuid not null references product_attribute_types (id),
  value numeric(18, 4) not null,
  uom_id uuid references uom (id), -- e.g. the area unit "area_per_box" is denominated in
  unique (tenant_id, product_id, attribute_type_id)
);

create index idx_category_attribute_templates_category_id on category_attribute_templates (category_id);
create index idx_product_numeric_attributes_product_id on product_numeric_attributes (product_id);

-- Seed the numeric attribute types the tile calculation engine (audit
-- section 6) needs and that don't fit the lookup-value pattern (they're
-- plain numbers, not a pick-list). Global catalog, like the existing
-- material_type/variety/... rows from 0011_seed_data.sql.
insert into product_attribute_types (code, name) values
  ('pieces_per_box', 'Pieces per Box'),
  ('area_per_box', 'Area per Box'),
  ('boxes_per_pallet', 'Boxes per Pallet');

-- Standard tenant-scoped RLS: is_tenant_member + has_permission(tenant_id,
-- 'product', action) -- reusing the 'product' resource rather than adding a
-- new permission resource for two tables that are just an extension of the
-- product master.

alter table category_attribute_templates enable row level security;
create policy category_attribute_templates_select on category_attribute_templates for select using (is_tenant_member(tenant_id));
create policy category_attribute_templates_insert on category_attribute_templates for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'product', 'create'));
create policy category_attribute_templates_update on category_attribute_templates for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'product', 'edit'))
  with check (is_tenant_member(tenant_id));
create policy category_attribute_templates_delete on category_attribute_templates for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'product', 'delete'));

alter table product_numeric_attributes enable row level security;
create policy product_numeric_attributes_select on product_numeric_attributes for select using (is_tenant_member(tenant_id));
create policy product_numeric_attributes_insert on product_numeric_attributes for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'product', 'create'));
create policy product_numeric_attributes_update on product_numeric_attributes for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'product', 'edit'))
  with check (is_tenant_member(tenant_id));
create policy product_numeric_attributes_delete on product_numeric_attributes for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'product', 'delete'));

create trigger category_attribute_templates_audit
  after insert or update or delete on category_attribute_templates
  for each row execute function audit_trigger_fn();

create trigger product_numeric_attributes_audit
  after insert or update or delete on product_numeric_attributes
  for each row execute function audit_trigger_fn();
