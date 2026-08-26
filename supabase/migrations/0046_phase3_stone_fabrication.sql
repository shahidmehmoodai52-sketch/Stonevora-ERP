-- Phase 3 -- Stone Fabrication/Projects mode (optional capability:
-- 'stone_fabrication', already present in the business_capabilities catalog
-- since Phase 0/the capability-model migration -- no new capability row
-- needed). Research (real stone-fabrication/countertop-shop costing):
-- a fabricator takes finished slabs/remnants already in stock (produced by
-- Phase 2's Block/Slab Factory, or received directly) and consumes them into
-- a customer project alongside labor and overhead, then bills the customer
-- by installed AREA (sqft/sqm) -- the universal countertop-industry
-- convention -- not by piece and not by weight. This reuses Phase 1's
-- invoicing tables (sales_invoices/sales_invoice_lines) exactly as the
-- roadmap specified ("invoiced via Phase 1's engine"), rather than inventing
-- a parallel billing engine.
--
-- Schema: `projects` (header, branch-scoped like every Phase 1 header) +
-- `project_materials` (join table: which inventory_units -- slabs/remnants --
-- a project consumed, no branch_id of its own, scoped via its parent project
-- like every Phase 1 line table). `inventory_units.consumed_by_project_id`
-- mirrors the existing `output_processing_job_id` column shape (Milestone 4)
-- for the same reason: genealogy/traceability symmetry, so a slab's full
-- life -- GRN line -> block -> processing job -> slab -> project -- is
-- always a plain foreign-key walk, no new indirection needed.
--
-- Status is deliberately just draft/completed/cancelled -- no separate
-- in_progress state. A real fabrication job's day-to-day cutting/polishing/
-- installation work is not itself a database transaction this system needs
-- to track (unlike Factory's processing_jobs, which has to track raw
-- material moving out of 'in_stock' the instant cutting starts); all that
-- matters here is "materials committed" (draft, still editable) versus
-- "job done, costs locked, ready to invoice" (completed) versus "abandoned,
-- materials released" (cancelled) -- a coarser state machine is the correct
-- scope, not a missing feature.
--
-- Costing mirrors Milestone 6's cost roll-up exactly, on a different basis
-- and a different trigger point: record_processing_costs waits for the job
-- to be 'completed' because the output volumes it allocates by don't exist
-- before then; complete_project waits for the same reason (labor/overhead
-- are only known once the work is actually finished) and totals
-- `material_cost` (accumulated live as materials are added/removed, from
-- each consumed unit's own already-rolled-up `cost`) + the entered
-- `labor_cost`/`overhead_cost` (entered figures, never invented, matching
-- every prior costing milestone's discipline). generate_project_invoice then
-- divides that one locked total_cost by the project's total consumed area to
-- get a single $/sqft cost rate applied to every invoice line -- the
-- proportional-by-area allocation collapses to a flat rate because every
-- unit of area shares the same job cost pool by definition, unlike volume
-- allocation across physically different-thickness slabs in Milestone 6.
-- Selling unit_price per material is caller-supplied per line, never
-- invented, matching every prior invoicing RPC in this system.
--
-- Every RPC below gets a has_branch_access() check from the start, in the
-- body, from its very first version -- not bolted on after a live exploit
-- like migration 0040 (Factory) and migration 0045 (Phase 1) both had to do.
-- That lesson is now applied proactively rather than relearned a third time.

create type project_status as enum ('draft', 'completed', 'cancelled');

create table projects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  branch_id uuid not null references branches (id),
  project_number text not null,
  customer_id uuid not null references customers (id),
  warehouse_id uuid references warehouses (id),
  description text,
  status project_status not null default 'draft',
  labor_cost numeric(18, 4),
  overhead_cost numeric(18, 4),
  material_cost numeric(18, 4) not null default 0,
  total_cost numeric(18, 4),
  invoice_id uuid references sales_invoices (id),
  invoiced_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, project_number)
);

create table project_materials (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  project_id uuid not null references projects (id),
  inventory_unit_id uuid not null references inventory_units (id),
  added_by uuid references profiles (id),
  added_at timestamptz not null default now(),
  unique (project_id, inventory_unit_id)
);

alter table inventory_units add column consumed_by_project_id uuid references projects (id);
create index idx_inventory_units_consumed_by_project_id on inventory_units (consumed_by_project_id);

-- ---------------------------------------------------------------------------
-- RLS -- identical shape to every other Phase 1 header (branch_id directly
-- on the table) / line table (no branch_id, scoped via its parent).
-- ---------------------------------------------------------------------------

alter table projects enable row level security;

create policy projects_select on projects for select
  using (is_tenant_member(tenant_id) and has_branch_access(tenant_id, branch_id));
create policy projects_insert on projects for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'project', 'create') and has_branch_access(tenant_id, branch_id));
create policy projects_update on projects for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'project', 'edit') and has_branch_access(tenant_id, branch_id))
  with check (is_tenant_member(tenant_id) and has_branch_access(tenant_id, branch_id));
create policy projects_delete on projects for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'project', 'delete') and has_branch_access(tenant_id, branch_id));

alter table project_materials enable row level security;

create policy project_materials_select on project_materials for select
  using (exists (select 1 from projects p where p.id = project_materials.project_id and is_tenant_member(p.tenant_id) and has_branch_access(p.tenant_id, p.branch_id)));
create policy project_materials_insert on project_materials for insert
  with check (exists (select 1 from projects p where p.id = project_materials.project_id and is_tenant_member(p.tenant_id) and has_permission(p.tenant_id, 'project', 'edit') and has_branch_access(p.tenant_id, p.branch_id)));
create policy project_materials_delete on project_materials for delete
  using (exists (select 1 from projects p where p.id = project_materials.project_id and is_tenant_member(p.tenant_id) and has_permission(p.tenant_id, 'project', 'edit') and has_branch_access(p.tenant_id, p.branch_id)));

create trigger projects_audit
  after insert or update or delete on projects
  for each row execute function audit_trigger_fn();
create trigger project_materials_audit
  after insert or update or delete on project_materials
  for each row execute function audit_trigger_fn();

-- ---------------------------------------------------------------------------
-- New 'project' permission resource -- the same coarse-grained, 11-action
-- shape as 'purchasing'/'sales'/'production' (Phase 0's deliberate design,
-- one row per resource-action pair, not one row per table).
-- ---------------------------------------------------------------------------

insert into permissions (resource, action) select 'project', a.action
from (values ('view'), ('create'), ('edit'), ('delete'), ('approve'), ('cancel'), ('print'), ('export'), ('view_cost'), ('view_profit'), ('view_financial')) as a(action);

-- Extend the tenant-onboarding role grants (0012, most recently touched in
-- 0043) to cover 'project': sales_manager gets the same full grant shape as
-- their existing 'sales' resource (projects are ultimately a sales/invoicing
-- concern), factory_manager/production_manager get view/create/edit (they
-- run the fabrication work -- consuming materials, completing jobs -- but
-- deliberately not invoicing: generate_project_invoice below also requires
-- 'sales'.'create', which this branch does not grant, matching the real
-- separation of duties between production and billing). No new role
-- template invented -- byte-for-byte identical to the 0043 version
-- otherwise.
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

-- ---------------------------------------------------------------------------
-- add_project_material: consumes one slab/remnant inventory_unit into a
-- draft project. Requires the unit be 'in_stock' (not already consumed,
-- rejected, or mid-QC) and carry a recorded cost (mirrors
-- record_processing_costs' precedent -- Milestone 6 -- of never silently
-- treating an un-costed unit as zero-cost). material_cost is maintained live
-- as a running total rather than recomputed from scratch each time.
-- ---------------------------------------------------------------------------
create function add_project_material(p_project_id uuid, p_inventory_unit_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_project projects%rowtype;
  v_unit inventory_units%rowtype;
begin
  select * into v_project from projects where id = p_project_id for update;
  if not found then
    raise exception 'Project not found';
  end if;
  if not has_permission(v_project.tenant_id, 'project', 'edit') then
    raise exception 'Missing permission: project.edit';
  end if;
  if not has_branch_access(v_project.tenant_id, v_project.branch_id) then
    raise exception 'You do not have access to the branch of this project';
  end if;
  if not has_capability(v_project.tenant_id, 'stone_fabrication') then
    raise exception 'The Stone Fabrication capability is not enabled for this tenant';
  end if;
  if v_project.status <> 'draft' then
    raise exception 'Materials can only be added to a project in draft status (current status: %)', v_project.status;
  end if;

  select * into v_unit from inventory_units where id = p_inventory_unit_id and tenant_id = v_project.tenant_id for update;
  if not found then
    raise exception 'Inventory unit not found';
  end if;
  if v_unit.unit_type not in ('slab', 'remnant') then
    raise exception 'Only a slab or remnant (not a block) can be consumed as a project material';
  end if;
  if v_unit.status <> 'in_stock' then
    raise exception 'Inventory unit is not available to consume (current status: %)', v_unit.status;
  end if;
  if v_unit.cost is null then
    raise exception 'Inventory unit has no recorded cost; record its processing costs before consuming it in a project';
  end if;

  update inventory_units set status = 'consumed', consumed_by_project_id = p_project_id where id = v_unit.id;

  insert into project_materials (tenant_id, project_id, inventory_unit_id, added_by)
    values (v_project.tenant_id, p_project_id, p_inventory_unit_id, auth.uid());

  update projects set material_cost = material_cost + v_unit.cost, updated_at = now() where id = p_project_id;
end;
$$;

revoke execute on function add_project_material(uuid, uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- remove_project_material: undoes a mistaken add while the project is still
-- draft, releasing the unit back to 'in_stock'. Not available once the
-- project is completed/cancelled -- cancel_project handles bulk release,
-- and a completed project's costs are already locked.
-- ---------------------------------------------------------------------------
create function remove_project_material(p_project_id uuid, p_inventory_unit_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_project projects%rowtype;
  v_unit inventory_units%rowtype;
  v_deleted uuid;
begin
  select * into v_project from projects where id = p_project_id for update;
  if not found then
    raise exception 'Project not found';
  end if;
  if not has_permission(v_project.tenant_id, 'project', 'edit') then
    raise exception 'Missing permission: project.edit';
  end if;
  if not has_branch_access(v_project.tenant_id, v_project.branch_id) then
    raise exception 'You do not have access to the branch of this project';
  end if;
  if v_project.status <> 'draft' then
    raise exception 'Materials can only be removed from a project in draft status (current status: %)', v_project.status;
  end if;

  select * into v_unit from inventory_units where id = p_inventory_unit_id and tenant_id = v_project.tenant_id for update;
  if not found then
    raise exception 'Inventory unit not found';
  end if;

  delete from project_materials where project_id = p_project_id and inventory_unit_id = p_inventory_unit_id
    returning id into v_deleted;
  if v_deleted is null then
    raise exception 'This inventory unit is not a material of this project';
  end if;

  update inventory_units set status = 'in_stock', consumed_by_project_id = null where id = p_inventory_unit_id;
  update projects set material_cost = greatest(material_cost - coalesce(v_unit.cost, 0), 0), updated_at = now() where id = p_project_id;
end;
$$;

revoke execute on function remove_project_material(uuid, uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- complete_project: locks in labor_cost/overhead_cost (entered figures,
-- never invented -- exactly like Milestone 6's processing_cost/
-- overhead_cost) and total_cost = material_cost + labor_cost + overhead_cost.
-- Can only happen once per project (status must be 'draft'; there is no
-- re-completion/correction workflow, matching the same scope choice
-- Milestones 5 and 6 both made).
-- ---------------------------------------------------------------------------
create function complete_project(p_project_id uuid, p_labor_cost numeric, p_overhead_cost numeric default 0) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_project projects%rowtype;
begin
  select * into v_project from projects where id = p_project_id for update;
  if not found then
    raise exception 'Project not found';
  end if;
  if not has_permission(v_project.tenant_id, 'project', 'edit') then
    raise exception 'Missing permission: project.edit';
  end if;
  if not has_branch_access(v_project.tenant_id, v_project.branch_id) then
    raise exception 'You do not have access to the branch of this project';
  end if;
  if not has_capability(v_project.tenant_id, 'stone_fabrication') then
    raise exception 'The Stone Fabrication capability is not enabled for this tenant';
  end if;
  if v_project.status <> 'draft' then
    raise exception 'Project is not in draft status (current status: %)', v_project.status;
  end if;
  if p_labor_cost is null or p_labor_cost < 0 then
    raise exception 'labor_cost must be zero or greater';
  end if;
  if p_overhead_cost is null or p_overhead_cost < 0 then
    raise exception 'overhead_cost must be zero or greater';
  end if;

  update projects set
    labor_cost = p_labor_cost, overhead_cost = p_overhead_cost,
    total_cost = material_cost + p_labor_cost + p_overhead_cost,
    status = 'completed', completed_at = now(), updated_at = now()
  where id = p_project_id;
end;
$$;

revoke execute on function complete_project(uuid, numeric, numeric) from public, anon;

-- ---------------------------------------------------------------------------
-- cancel_project: releases every consumed material back to 'in_stock'
-- (mirrors cancel_processing_job's release of its input block). Blocked
-- once completed, matching cancel_processing_job's same rule -- a completed
-- job/project represents real, already-incurred cost and cannot be undone.
-- project_materials rows are left in place as a historical record of what
-- was attempted, not deleted.
-- ---------------------------------------------------------------------------
create function cancel_project(p_project_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_project projects%rowtype;
begin
  select * into v_project from projects where id = p_project_id for update;
  if not found then
    raise exception 'Project not found';
  end if;
  if not has_permission(v_project.tenant_id, 'project', 'edit') then
    raise exception 'Missing permission: project.edit';
  end if;
  if not has_branch_access(v_project.tenant_id, v_project.branch_id) then
    raise exception 'You do not have access to the branch of this project';
  end if;
  if v_project.status = 'completed' then
    raise exception 'A completed project cannot be cancelled';
  end if;
  if v_project.status = 'cancelled' then
    raise exception 'Project is already cancelled';
  end if;

  update inventory_units set status = 'in_stock', consumed_by_project_id = null
  where consumed_by_project_id = p_project_id;

  update projects set status = 'cancelled', cancelled_at = now(), updated_at = now() where id = p_project_id;
end;
$$;

revoke execute on function cancel_project(uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- generate_project_invoice: bills a completed, not-yet-invoiced project by
-- AREA -- quantity = each consumed unit's own actual_area, uom_id = that
-- unit's own area_uom_id (set at slab creation -- Milestone 4), unit_price
-- caller-supplied per material (never invented, matching
-- generate_sales_invoice_from_delivery's same discipline). unit_cost per
-- line is the project's locked total_cost spread flat across its total
-- consumed area (total_cost / total_area) -- every line gets the same
-- $/area rate because the whole job's cost pool is shared across all its
-- material by definition; this is the proportional-by-area allocation
-- Milestone 6 established, simplified to a constant because the basis
-- (area) is exactly the quantity being billed.
--
-- Requires BOTH 'project'.'edit' (this is fundamentally a project action)
-- and 'sales'.'create' (the table-level RLS policy on sales_invoices/
-- sales_invoice_lines already demands it, and requiring it here too gives a
-- clean error instead of a raw RLS failure) -- deliberately excluding
-- factory_manager/production_manager, who get 'project' but not 'sales',
-- from ever being able to invoice a project themselves.
-- ---------------------------------------------------------------------------
create function generate_project_invoice(p_project_id uuid, p_invoice_number text, p_material_prices jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_project projects%rowtype;
  v_invoice_id uuid;
  v_subtotal numeric(18, 4) := 0;
  v_total_area numeric(24, 6);
  v_cost_per_area numeric(18, 4);
  v_line record;
  v_price jsonb;
  v_unit_price numeric(18, 4);
  v_line_total numeric(18, 4);
begin
  select * into v_project from projects where id = p_project_id for update;
  if not found then
    raise exception 'Project not found';
  end if;
  if not has_permission(v_project.tenant_id, 'project', 'edit') then
    raise exception 'Missing permission: project.edit';
  end if;
  if not has_permission(v_project.tenant_id, 'sales', 'create') then
    raise exception 'Missing permission: sales.create';
  end if;
  if not has_branch_access(v_project.tenant_id, v_project.branch_id) then
    raise exception 'You do not have access to the branch of this project';
  end if;
  if not has_capability(v_project.tenant_id, 'stone_fabrication') then
    raise exception 'The Stone Fabrication capability is not enabled for this tenant';
  end if;
  if v_project.status <> 'completed' then
    raise exception 'Project must be completed before it can be invoiced';
  end if;
  if v_project.invoice_id is not null then
    raise exception 'This project has already been invoiced';
  end if;

  select coalesce(sum(iu.actual_area), 0) into v_total_area
  from project_materials pm join inventory_units iu on iu.id = pm.inventory_unit_id
  where pm.project_id = p_project_id;

  if v_total_area <= 0 then
    raise exception 'Project has no billable material area; cannot generate an invoice';
  end if;

  v_cost_per_area := v_project.total_cost / v_total_area;

  insert into sales_invoices (tenant_id, branch_id, customer_id, invoice_number, status)
  values (v_project.tenant_id, v_project.branch_id, v_project.customer_id, p_invoice_number, 'draft')
  returning id into v_invoice_id;

  for v_line in
    select iu.id as inventory_unit_id, iu.product_id, iu.actual_area, iu.area_uom_id
    from project_materials pm join inventory_units iu on iu.id = pm.inventory_unit_id
    where pm.project_id = p_project_id
  loop
    if v_line.actual_area is null or v_line.actual_area <= 0 then
      raise exception 'Inventory unit % has no recorded area; cannot bill by area', v_line.inventory_unit_id;
    end if;
    if v_line.area_uom_id is null then
      raise exception 'Inventory unit % has no area UOM recorded', v_line.inventory_unit_id;
    end if;

    v_unit_price := null;
    for v_price in select * from jsonb_array_elements(p_material_prices) loop
      if (v_price->>'inventory_unit_id')::uuid = v_line.inventory_unit_id then
        v_unit_price := (v_price->>'unit_price')::numeric;
      end if;
    end loop;
    if v_unit_price is null or v_unit_price < 0 then
      raise exception 'A unit_price must be supplied for inventory unit %', v_line.inventory_unit_id;
    end if;

    v_line_total := v_line.actual_area * v_unit_price;
    v_subtotal := v_subtotal + v_line_total;

    insert into sales_invoice_lines (tenant_id, sales_invoice_id, product_id, quantity, uom_id, unit_price, line_total, unit_cost)
    values (v_project.tenant_id, v_invoice_id, v_line.product_id, v_line.actual_area, v_line.area_uom_id, v_unit_price, v_line_total, v_cost_per_area);
  end loop;

  update sales_invoices set subtotal = v_subtotal, total_amount = v_subtotal, status = 'posted' where id = v_invoice_id;
  update projects set invoice_id = v_invoice_id, invoiced_at = now(), updated_at = now() where id = p_project_id;

  return v_invoice_id;
end;
$$;

revoke execute on function generate_project_invoice(uuid, text, jsonb) from public, anon;
