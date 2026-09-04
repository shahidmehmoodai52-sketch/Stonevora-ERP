-- Phase 4 -- Tile Manufacturing mode (optional capability:
-- 'tile_manufacturing', already present in the business_capabilities
-- catalog since Phase 0/the capability-model migration -- no new capability
-- row needed). Research (real tile production): a factory holds a recipe
-- (bill of materials) per finished tile product -- fixed quantities of raw
-- materials (clay, glaze, frit, ...) per batch -- runs a production batch
-- that consumes those raw materials, fires it in a kiln, and the result is
-- a shade/caliber-graded BATCH of finished tiles (not individual serialized
-- pieces like Factory's slabs -- tiles are the textbook case Phase 0's
-- 'batch' inventory paradigm was built for). Every batch must clear QC
-- before it is sellable, exactly like Factory Milestone 5's slab QC gate --
-- reused here on inventory_batches instead of inventory_units.
--
-- Schema economy, matching this project's repeated pattern: no new
-- permission resource (production_batches reuses 'production', exactly
-- like Factory's processing_jobs -- factory_manager/production_manager/
-- production_operator/qc_manager already hold the right grants with zero
-- create_tenant_for_user changes needed this phase; bill_of_materials
-- reuses 'product', exactly like category_attribute_templates already
-- does for the same reason -- a recipe is product-master data, not a
-- transaction).
--
-- Batch-level QC gate: inventory_batches gets a new `status` column
-- (default 'in_stock', so every EXISTING batch-tracked flow -- ordinary
-- GRN receipts of batch-tracked goods, Phase 1.x adjustments/returns -- is
-- completely unaffected). Only the new complete_production_batch RPC
-- explicitly lands a batch 'pending_qc'; record_batch_qc_inspection is the
-- only way to move it to 'in_stock' (passed) or 'rejected' (failed) -- and
-- confirm_sales_order (Phase 1) is patched to only ever reserve/count
-- 'in_stock' batches, so a not-yet-inspected or rejected batch structurally
-- cannot be sold, the same guarantee Milestone 5 gives slabs. A rejected
-- batch keeps its cost and quantity (the raw material really was consumed)
-- -- it just never counts as available stock, matching the "a rejected
-- piece still consumed real material" principle already established for
-- Factory.
--
-- inventory_batches has no branch_id of its own (a pre-existing,
-- documented gap -- see Foundation Hardening). record_batch_qc_inspection
-- derives branch the exact same way record_qc_inspection already does for
-- inventory_units: inventory_batches.output_production_batch_id mirrors
-- inventory_units.output_processing_job_id's shape precisely, and the RPC
-- joins back through it to production_batches (which does carry
-- branch_id) rather than inventing a new mechanism.
--
-- Raw-material consumption happens at START (mixing/batching), not at
-- completion -- a real, deliberate domain difference from Factory (where
-- the block stays physically whole until cutting). This means
-- cancel_production_batch cannot "release" raw materials once a batch is
-- 'in_progress' the way cancel_processing_job releases its input block --
-- once mixed, the materials cannot be un-consumed. A cancelled in_progress
-- batch is a genuine, permanent cost loss (a failed firing), recorded as
-- such rather than silently reversed.
--
-- Branch-access lesson applied proactively (as Phase 3 and Phase 1.x also
-- did): every new RPC checks has_branch_access() in its body from this,
-- its first version.

create type inventory_batch_status as enum ('pending_qc', 'in_stock', 'rejected');
alter table inventory_batches
  add column status inventory_batch_status not null default 'in_stock',
  add column output_production_batch_id uuid; -- FK added after production_batches exists below

-- qc_inspections (0043) is reused for batch QC rather than a parallel
-- table: the concept (outcome/confirmed_grade/defects/notes/inspected_by,
-- append-only) is identical, only the subject differs.
alter table qc_inspections
  alter column inventory_unit_id drop not null,
  add column inventory_batch_id uuid references inventory_batches (id),
  add constraint qc_inspections_exactly_one_subject
    check ((inventory_unit_id is not null) <> (inventory_batch_id is not null));
create index idx_qc_inspections_inventory_batch_id on qc_inspections (inventory_batch_id);

-- ---------------------------------------------------------------------------
-- Bill of materials (recipe): one row per finished tile product's recipe,
-- expressed per a fixed output_quantity (in the recipe's own
-- output_uom_id -- production_batches.planned_output_quantity/
-- actual_output_quantity are always in this same unit, so no separate UOM
-- column is needed on production_batches itself; the recipe fixes it).
-- ---------------------------------------------------------------------------

create table bill_of_materials (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  product_id uuid not null references products (id), -- the finished, batch-tracked tile product
  bom_number text not null,
  name text,
  output_quantity numeric(18, 4) not null check (output_quantity > 0),
  output_uom_id uuid not null references uom (id),
  is_active boolean not null default true,
  notes text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  unique (tenant_id, bom_number)
);

create table bill_of_materials_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  bom_id uuid not null references bill_of_materials (id) on delete cascade,
  raw_material_product_id uuid not null references products (id),
  quantity numeric(18, 4) not null check (quantity > 0), -- per one output_quantity batch
  uom_id uuid not null references uom (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Production batches: the job wrapper around one recipe run, mirroring
-- Factory's processing_jobs shape (branch/warehouse-scoped header,
-- draft -> in_progress -> completed/cancelled).
-- ---------------------------------------------------------------------------

create type production_batch_status as enum ('draft', 'in_progress', 'completed', 'cancelled');

create table production_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  branch_id uuid not null references branches (id),
  warehouse_id uuid not null references warehouses (id),
  bom_id uuid not null references bill_of_materials (id),
  batch_number text not null,
  status production_batch_status not null default 'draft',
  kiln_number text,
  planned_output_quantity numeric(18, 4) not null check (planned_output_quantity > 0),
  actual_output_quantity numeric(18, 4),
  shade_code text,
  caliber_code text,
  raw_material_cost numeric(18, 4),
  labor_cost numeric(18, 4),
  overhead_cost numeric(18, 4),
  total_cost numeric(18, 4),
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  notes text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  unique (tenant_id, batch_number)
);

alter table inventory_batches
  add constraint inventory_batches_output_production_batch_id_fkey
  foreign key (output_production_batch_id) references production_batches (id);

-- Traceability log: which raw materials, how much, at what cost -- the
-- same role goods_receipt_lines/delivery_lines play for Phase 1 documents.
create table production_batch_consumptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  production_batch_id uuid not null references production_batches (id) on delete cascade,
  raw_material_product_id uuid not null references products (id),
  quantity numeric(18, 4) not null, -- base units of the raw material
  uom_id uuid not null references uom (id),
  unit_cost numeric(18, 4),
  created_at timestamptz not null default now()
);

create index idx_bill_of_materials_product_id on bill_of_materials (product_id);
create index idx_bill_of_materials_output_uom_id on bill_of_materials (output_uom_id);
create index idx_bill_of_materials_lines_bom_id on bill_of_materials_lines (bom_id);
create index idx_bill_of_materials_lines_raw_material_product_id on bill_of_materials_lines (raw_material_product_id);
create index idx_bill_of_materials_lines_uom_id on bill_of_materials_lines (uom_id);
create index idx_production_batches_branch_id on production_batches (branch_id);
create index idx_production_batches_warehouse_id on production_batches (warehouse_id);
create index idx_production_batches_bom_id on production_batches (bom_id);
create index idx_production_batch_consumptions_production_batch_id on production_batch_consumptions (production_batch_id);
create index idx_production_batch_consumptions_raw_material_product_id on production_batch_consumptions (raw_material_product_id);
create index idx_production_batch_consumptions_uom_id on production_batch_consumptions (uom_id);
create index idx_inventory_batches_output_production_batch_id on inventory_batches (output_production_batch_id);

-- ---------------------------------------------------------------------------
-- RLS. bill_of_materials(_lines) reuse the 'product' resource with no
-- branch scoping -- master data, not a transaction, exactly like
-- category_attribute_templates (0034). production_batches(_consumptions)
-- reuse 'production' with branch scoping, exactly like processing_jobs
-- (0039).
-- ---------------------------------------------------------------------------

alter table bill_of_materials enable row level security;
create policy bill_of_materials_select on bill_of_materials for select using (is_tenant_member(tenant_id));
create policy bill_of_materials_insert on bill_of_materials for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'product', 'create'));
create policy bill_of_materials_update on bill_of_materials for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'product', 'edit'))
  with check (is_tenant_member(tenant_id));
create policy bill_of_materials_delete on bill_of_materials for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'product', 'delete'));

alter table bill_of_materials_lines enable row level security;
create policy bill_of_materials_lines_select on bill_of_materials_lines for select
  using (exists (select 1 from bill_of_materials b where b.id = bill_of_materials_lines.bom_id and is_tenant_member(b.tenant_id)));
create policy bill_of_materials_lines_insert on bill_of_materials_lines for insert
  with check (exists (select 1 from bill_of_materials b where b.id = bill_of_materials_lines.bom_id and is_tenant_member(b.tenant_id) and has_permission(b.tenant_id, 'product', 'create')));
create policy bill_of_materials_lines_update on bill_of_materials_lines for update
  using (exists (select 1 from bill_of_materials b where b.id = bill_of_materials_lines.bom_id and is_tenant_member(b.tenant_id) and has_permission(b.tenant_id, 'product', 'edit')))
  with check (exists (select 1 from bill_of_materials b where b.id = bill_of_materials_lines.bom_id and is_tenant_member(b.tenant_id)));
create policy bill_of_materials_lines_delete on bill_of_materials_lines for delete
  using (exists (select 1 from bill_of_materials b where b.id = bill_of_materials_lines.bom_id and is_tenant_member(b.tenant_id) and has_permission(b.tenant_id, 'product', 'delete')));

alter table production_batches enable row level security;
create policy production_batches_select on production_batches for select
  using (is_tenant_member(tenant_id) and has_branch_access(tenant_id, branch_id));
create policy production_batches_insert on production_batches for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'production', 'create') and has_branch_access(tenant_id, branch_id));
create policy production_batches_update on production_batches for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'production', 'edit') and has_branch_access(tenant_id, branch_id))
  with check (is_tenant_member(tenant_id) and has_branch_access(tenant_id, branch_id));
create policy production_batches_delete on production_batches for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'production', 'delete') and has_branch_access(tenant_id, branch_id));

alter table production_batch_consumptions enable row level security;
create policy production_batch_consumptions_select on production_batch_consumptions for select
  using (exists (select 1 from production_batches p where p.id = production_batch_consumptions.production_batch_id and is_tenant_member(p.tenant_id) and has_branch_access(p.tenant_id, p.branch_id)));
create policy production_batch_consumptions_insert on production_batch_consumptions for insert
  with check (exists (select 1 from production_batches p where p.id = production_batch_consumptions.production_batch_id and is_tenant_member(p.tenant_id) and has_permission(p.tenant_id, 'production', 'edit') and has_branch_access(p.tenant_id, p.branch_id)));

create trigger bill_of_materials_audit after insert or update or delete on bill_of_materials for each row execute function audit_trigger_fn();
create trigger bill_of_materials_lines_audit after insert or update or delete on bill_of_materials_lines for each row execute function audit_trigger_fn();
create trigger production_batches_audit after insert or update or delete on production_batches for each row execute function audit_trigger_fn();
create trigger production_batch_consumptions_audit after insert or update or delete on production_batch_consumptions for each row execute function audit_trigger_fn();

-- ---------------------------------------------------------------------------
-- start_production_batch: consumes every BOM line's raw material, scaled by
-- planned_output_quantity / bom.output_quantity, exactly the same FIFO
-- consumption loops confirm_sales_order/dispatch_delivery already use for
-- simple/batch-tracked stock (batch-tracked raw materials must themselves
-- be 'in_stock' -- a not-yet-inspected raw material batch cannot be used
-- in a recipe either). Logs each consumption for traceability, sums
-- raw_material_cost, and moves the header to 'in_progress'.
-- ---------------------------------------------------------------------------
create function start_production_batch(p_production_batch_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_pbatch production_batches%rowtype;
  v_bom bill_of_materials%rowtype;
  v_scale numeric(18, 8);
  v_line record;
  v_tracking_mode inventory_tracking_mode;
  v_base_uom_id uuid;
  v_base_qty numeric(18, 4);
  v_remaining numeric(18, 4);
  v_take numeric(18, 4);
  v_ibatch record;
  v_stock record;
  v_line_cost numeric(18, 4);
  v_total_raw_cost numeric(18, 4) := 0;
begin
  select * into v_pbatch from production_batches where id = p_production_batch_id for update;
  if not found then
    raise exception 'Production batch not found';
  end if;
  if not has_permission(v_pbatch.tenant_id, 'production', 'edit') then
    raise exception 'Missing permission: production.edit';
  end if;
  if not has_branch_access(v_pbatch.tenant_id, v_pbatch.branch_id) then
    raise exception 'You do not have access to the branch of this production batch';
  end if;
  if not has_capability(v_pbatch.tenant_id, 'tile_manufacturing') then
    raise exception 'The Tile Manufacturing capability is not enabled for this tenant';
  end if;
  if v_pbatch.status <> 'draft' then
    raise exception 'Production batch is not in draft status';
  end if;

  select * into v_bom from bill_of_materials where id = v_pbatch.bom_id and tenant_id = v_pbatch.tenant_id;
  if not found then
    raise exception 'Bill of materials not found';
  end if;
  if not v_bom.is_active then
    raise exception 'This bill of materials is not active';
  end if;

  v_scale := v_pbatch.planned_output_quantity / v_bom.output_quantity;

  for v_line in select * from bill_of_materials_lines where bom_id = v_bom.id loop
    select inventory_tracking_mode, base_uom_id into v_tracking_mode, v_base_uom_id from products where id = v_line.raw_material_product_id;
    if v_tracking_mode = 'unit' then
      raise exception 'Unit-tracked products cannot be used as a raw material (product %)', v_line.raw_material_product_id;
    end if;

    v_base_qty := convert_uom_quantity(v_pbatch.tenant_id, v_line.raw_material_product_id, v_line.uom_id, v_base_uom_id, v_line.quantity * v_scale);
    v_remaining := v_base_qty;
    v_line_cost := 0;

    if v_tracking_mode = 'batch' then
      for v_ibatch in
        select ib.id, ib.qty_on_hand, ib.reserved_qty, ib.cost_per_uom from inventory_batches ib
        join storage_locations sl on sl.id = ib.current_location_id
        where ib.tenant_id = v_pbatch.tenant_id and ib.product_id = v_line.raw_material_product_id
          and sl.warehouse_id = v_pbatch.warehouse_id and ib.status = 'in_stock'
          and (ib.qty_on_hand - ib.reserved_qty) > 0
        order by ib.created_at
        for update
      loop
        exit when v_remaining <= 0;
        v_take := least(v_remaining, v_ibatch.qty_on_hand - v_ibatch.reserved_qty);
        update inventory_batches set qty_on_hand = qty_on_hand - v_take where id = v_ibatch.id;
        v_line_cost := v_line_cost + v_take * v_ibatch.cost_per_uom;
        v_remaining := v_remaining - v_take;
      end loop;
    else
      for v_stock in
        select ist.id, ist.qty_on_hand, ist.reserved_qty, ist.avg_cost from inventory_stock ist
        left join storage_locations sl on sl.id = ist.location_id
        where ist.tenant_id = v_pbatch.tenant_id and ist.product_id = v_line.raw_material_product_id
          and (sl.warehouse_id = v_pbatch.warehouse_id or ist.location_id is null)
          and (ist.qty_on_hand - ist.reserved_qty) > 0
        order by ist.updated_at
        for update of ist
      loop
        exit when v_remaining <= 0;
        v_take := least(v_remaining, v_stock.qty_on_hand - v_stock.reserved_qty);
        update inventory_stock set qty_on_hand = qty_on_hand - v_take, updated_at = now() where id = v_stock.id;
        v_line_cost := v_line_cost + v_take * v_stock.avg_cost;
        v_remaining := v_remaining - v_take;
      end loop;
    end if;

    if v_remaining > 0 then
      raise exception 'Insufficient available stock of raw material % for this recipe: short by % (base units)', v_line.raw_material_product_id, v_remaining;
    end if;

    insert into production_batch_consumptions (tenant_id, production_batch_id, raw_material_product_id, quantity, uom_id, unit_cost)
    values (v_pbatch.tenant_id, p_production_batch_id, v_line.raw_material_product_id, v_base_qty, v_base_uom_id, case when v_base_qty > 0 then v_line_cost / v_base_qty else 0 end);

    v_total_raw_cost := v_total_raw_cost + v_line_cost;
  end loop;

  update production_batches set status = 'in_progress', raw_material_cost = v_total_raw_cost, started_at = now() where id = p_production_batch_id;
end;
$$;

revoke execute on function start_production_batch(uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- complete_production_batch: creates the finished-goods inventory_batches
-- row (status 'pending_qc' -- unsellable until QC clears it), converting
-- the actual output quantity (entered in the BOM's own output_uom_id) into
-- the finished product's base UOM, exactly like post_goods_receipt already
-- does for every other batch-tracked receipt. total_cost = raw_material_cost
-- (locked at start) + entered labor_cost/overhead_cost -- never invented,
-- matching every prior costing milestone. p_output_location_id is
-- caller-supplied and validated against this production batch's own
-- warehouse -- required because confirm_sales_order's batch-tracked
-- availability query INNER JOINs storage_locations (a null
-- current_location_id would make this batch permanently unsellable).
-- ---------------------------------------------------------------------------
create function complete_production_batch(
  p_production_batch_id uuid,
  p_actual_output_quantity numeric,
  p_output_location_id uuid,
  p_shade_code text default null,
  p_caliber_code text default null,
  p_labor_cost numeric default 0,
  p_overhead_cost numeric default 0
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_pbatch production_batches%rowtype;
  v_bom bill_of_materials%rowtype;
  v_tracking_mode inventory_tracking_mode;
  v_base_uom_id uuid;
  v_location storage_locations%rowtype;
  v_base_output_qty numeric(18, 4);
  v_total_cost numeric(18, 4);
  v_cost_per_uom numeric(18, 4);
  v_output_batch_id uuid;
begin
  select * into v_pbatch from production_batches where id = p_production_batch_id for update;
  if not found then
    raise exception 'Production batch not found';
  end if;
  if not has_permission(v_pbatch.tenant_id, 'production', 'edit') then
    raise exception 'Missing permission: production.edit';
  end if;
  if not has_branch_access(v_pbatch.tenant_id, v_pbatch.branch_id) then
    raise exception 'You do not have access to the branch of this production batch';
  end if;
  if not has_capability(v_pbatch.tenant_id, 'tile_manufacturing') then
    raise exception 'The Tile Manufacturing capability is not enabled for this tenant';
  end if;
  if v_pbatch.status <> 'in_progress' then
    raise exception 'Production batch is not in progress (current status: %)', v_pbatch.status;
  end if;
  if p_actual_output_quantity is null or p_actual_output_quantity <= 0 then
    raise exception 'actual_output_quantity must be greater than zero';
  end if;
  if p_labor_cost is null or p_labor_cost < 0 then
    raise exception 'labor_cost must be zero or greater';
  end if;
  if p_overhead_cost is null or p_overhead_cost < 0 then
    raise exception 'overhead_cost must be zero or greater';
  end if;

  select * into v_location from storage_locations where id = p_output_location_id;
  if not found or v_location.warehouse_id <> v_pbatch.warehouse_id then
    raise exception 'output location must be a storage location within this production batch''s warehouse';
  end if;

  select * into v_bom from bill_of_materials where id = v_pbatch.bom_id;
  select inventory_tracking_mode, base_uom_id into v_tracking_mode, v_base_uom_id from products where id = v_bom.product_id;
  if v_tracking_mode <> 'batch' then
    raise exception 'The bill of materials'' finished product must be batch-tracked';
  end if;

  v_total_cost := v_pbatch.raw_material_cost + p_labor_cost + p_overhead_cost;
  v_base_output_qty := convert_uom_quantity(v_pbatch.tenant_id, v_bom.product_id, v_bom.output_uom_id, v_base_uom_id, p_actual_output_quantity);
  v_cost_per_uom := v_total_cost / v_base_output_qty;

  insert into inventory_batches (
    tenant_id, product_id, batch_number, qty_on_hand, uom_id, current_location_id,
    shade_code, caliber_code, cost_per_uom, status, output_production_batch_id
  ) values (
    v_pbatch.tenant_id, v_bom.product_id, v_pbatch.batch_number, v_base_output_qty, v_base_uom_id, p_output_location_id,
    p_shade_code, p_caliber_code, v_cost_per_uom, 'pending_qc', p_production_batch_id
  ) returning id into v_output_batch_id;

  update production_batches set
    status = 'completed', actual_output_quantity = p_actual_output_quantity, shade_code = p_shade_code, caliber_code = p_caliber_code,
    labor_cost = p_labor_cost, overhead_cost = p_overhead_cost, total_cost = v_total_cost, completed_at = now()
  where id = p_production_batch_id;

  return v_output_batch_id;
end;
$$;

revoke execute on function complete_production_batch(uuid, numeric, uuid, text, text, numeric, numeric) from public, anon;

-- ---------------------------------------------------------------------------
-- cancel_production_batch: only 'draft' releases nothing (nothing was
-- consumed yet, trivial). An 'in_progress' batch's raw materials are
-- already consumed and cannot be un-mixed -- cancelling it still moves it
-- to 'cancelled' (recording a failed firing as a real, permanent cost
-- loss) but does not attempt to restore any stock. No has_capability check,
-- matching cancel_processing_job's own precedent exactly (a cancel is an
-- undo of one's own action, gated by permission/status, not capability).
-- ---------------------------------------------------------------------------
create function cancel_production_batch(p_production_batch_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_pbatch production_batches%rowtype;
begin
  select * into v_pbatch from production_batches where id = p_production_batch_id for update;
  if not found then
    raise exception 'Production batch not found';
  end if;
  if not has_permission(v_pbatch.tenant_id, 'production', 'edit') then
    raise exception 'Missing permission: production.edit';
  end if;
  if not has_branch_access(v_pbatch.tenant_id, v_pbatch.branch_id) then
    raise exception 'You do not have access to the branch of this production batch';
  end if;
  if v_pbatch.status = 'completed' then
    raise exception 'A completed production batch cannot be cancelled';
  end if;
  if v_pbatch.status = 'cancelled' then
    raise exception 'Production batch is already cancelled';
  end if;

  update production_batches set status = 'cancelled', cancelled_at = now() where id = p_production_batch_id;
end;
$$;

revoke execute on function cancel_production_batch(uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- record_batch_qc_inspection: the batch-tracked mirror of record_qc_inspection
-- (0043), reusing the same qc_inspections table and 'production'.'approve'
-- permission. inventory_batches carries no branch_id, so branch access is
-- derived by joining back through output_production_batch_id to
-- production_batches -- exactly the same reverse-lookup shape
-- record_qc_inspection already uses via output_processing_job_id.
-- ---------------------------------------------------------------------------
create function record_batch_qc_inspection(
  p_inventory_batch_id uuid,
  p_outcome qc_outcome,
  p_confirmed_grade text default null,
  p_defects text default null,
  p_notes text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_ibatch inventory_batches%rowtype;
  v_pbatch production_batches%rowtype;
  v_inspection_id uuid;
begin
  select * into v_ibatch from inventory_batches where id = p_inventory_batch_id for update;
  if not found then
    raise exception 'Inventory batch not found';
  end if;
  if v_ibatch.output_production_batch_id is null then
    raise exception 'This batch was not produced through the Tile Manufacturing workflow and has no QC gate';
  end if;
  select * into v_pbatch from production_batches where id = v_ibatch.output_production_batch_id;

  if not has_permission(v_ibatch.tenant_id, 'production', 'approve') then
    raise exception 'Missing permission: production.approve';
  end if;
  if not has_branch_access(v_ibatch.tenant_id, v_pbatch.branch_id) then
    raise exception 'You do not have access to the branch of this production batch';
  end if;
  if not has_capability(v_ibatch.tenant_id, 'tile_manufacturing') then
    raise exception 'The Tile Manufacturing capability is not enabled for this tenant';
  end if;
  if v_ibatch.status <> 'pending_qc' then
    raise exception 'This batch is not pending QC (current status: %)', v_ibatch.status;
  end if;

  insert into qc_inspections (tenant_id, inventory_batch_id, branch_id, outcome, confirmed_grade, defects, notes, inspected_by)
  values (v_ibatch.tenant_id, p_inventory_batch_id, v_pbatch.branch_id, p_outcome, p_confirmed_grade, p_defects, p_notes, auth.uid())
  returning id into v_inspection_id;

  update inventory_batches set status = case when p_outcome = 'passed' then 'in_stock' else 'rejected' end::inventory_batch_status where id = p_inventory_batch_id;

  return v_inspection_id;
end;
$$;

revoke execute on function record_batch_qc_inspection(uuid, qc_outcome, text, text, text) from public, anon;

-- ---------------------------------------------------------------------------
-- confirm_sales_order (Phase 1, 0045): patched so its batch-tracked branch
-- only ever counts/reserves 'in_stock' batches -- the actual sellability
-- gate. Byte-for-byte identical to the 0045 version otherwise; every
-- existing batch-tracked row already defaults to 'in_stock' (added above),
-- so this is a no-op for every flow except newly-produced tile batches.
-- ---------------------------------------------------------------------------
create or replace function confirm_sales_order(p_sales_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_order sales_orders%rowtype;
  v_line record;
  v_tracking_mode inventory_tracking_mode;
  v_base_uom_id uuid;
  v_base_qty numeric(18, 4);
  v_available numeric(18, 4);
  v_remaining numeric(18, 4);
  v_take numeric(18, 4);
  v_batch record;
  v_stock record;
begin
  select * into v_order from sales_orders where id = p_sales_order_id;
  if not found then
    raise exception 'Sales order not found';
  end if;
  if not has_permission(v_order.tenant_id, 'sales', 'edit') then
    raise exception 'Missing permission: sales.edit';
  end if;
  if not has_branch_access(v_order.tenant_id, v_order.branch_id) then
    raise exception 'You do not have access to the branch of this sales order';
  end if;
  if v_order.status <> 'draft' then
    raise exception 'Sales order is not in draft status';
  end if;
  if v_order.warehouse_id is null then
    raise exception 'A fulfilling warehouse must be set before confirming';
  end if;

  -- Pass 1: validate every line before reserving anything.
  for v_line in select * from sales_order_lines where sales_order_id = p_sales_order_id loop
    select inventory_tracking_mode, base_uom_id into v_tracking_mode, v_base_uom_id from products where id = v_line.product_id;

    if v_tracking_mode = 'unit' then
      raise exception 'Unit-tracked products (blocks/slabs) are not yet reservable in Phase 1';
    end if;

    v_base_qty := convert_uom_quantity(v_order.tenant_id, v_line.product_id, v_line.uom_id, v_base_uom_id, v_line.quantity);

    if v_tracking_mode = 'batch' then
      select coalesce(sum(ib.qty_on_hand - ib.reserved_qty), 0) into v_available
      from inventory_batches ib
      join storage_locations sl on sl.id = ib.current_location_id
      where ib.tenant_id = v_order.tenant_id and ib.product_id = v_line.product_id
        and sl.warehouse_id = v_order.warehouse_id and ib.status = 'in_stock';
    else
      select coalesce(sum(ist.qty_on_hand - ist.reserved_qty), 0) into v_available
      from inventory_stock ist
      left join storage_locations sl on sl.id = ist.location_id
      where ist.tenant_id = v_order.tenant_id and ist.product_id = v_line.product_id
        and (sl.warehouse_id = v_order.warehouse_id or ist.location_id is null);
    end if;

    if v_available < v_base_qty then
      raise exception 'Insufficient available stock for product %: requested % (base units), available %',
        v_line.product_id, v_base_qty, v_available;
    end if;
  end loop;

  -- Pass 2: every line already validated -- reserve for real.
  for v_line in select * from sales_order_lines where sales_order_id = p_sales_order_id loop
    select inventory_tracking_mode, base_uom_id into v_tracking_mode, v_base_uom_id from products where id = v_line.product_id;
    v_base_qty := convert_uom_quantity(v_order.tenant_id, v_line.product_id, v_line.uom_id, v_base_uom_id, v_line.quantity);
    v_remaining := v_base_qty;

    if v_tracking_mode = 'batch' then
      for v_batch in
        select ib.id, ib.qty_on_hand, ib.reserved_qty from inventory_batches ib
        join storage_locations sl on sl.id = ib.current_location_id
        where ib.tenant_id = v_order.tenant_id and ib.product_id = v_line.product_id
          and sl.warehouse_id = v_order.warehouse_id and ib.status = 'in_stock'
          and (ib.qty_on_hand - ib.reserved_qty) > 0
        order by ib.created_at
        for update
      loop
        exit when v_remaining <= 0;
        v_take := least(v_remaining, v_batch.qty_on_hand - v_batch.reserved_qty);
        update inventory_batches set reserved_qty = reserved_qty + v_take where id = v_batch.id;
        v_remaining := v_remaining - v_take;
      end loop;
    else
      for v_stock in
        select ist.id, ist.qty_on_hand, ist.reserved_qty from inventory_stock ist
        left join storage_locations sl on sl.id = ist.location_id
        where ist.tenant_id = v_order.tenant_id and ist.product_id = v_line.product_id
          and (sl.warehouse_id = v_order.warehouse_id or ist.location_id is null)
          and (ist.qty_on_hand - ist.reserved_qty) > 0
        order by ist.updated_at
        for update of ist
      loop
        exit when v_remaining <= 0;
        v_take := least(v_remaining, v_stock.qty_on_hand - v_stock.reserved_qty);
        update inventory_stock set reserved_qty = reserved_qty + v_take where id = v_stock.id;
        v_remaining := v_remaining - v_take;
      end loop;
    end if;

    update sales_order_lines set reserved_quantity = v_line.quantity, base_quantity = v_base_qty where id = v_line.id;
  end loop;

  update sales_orders set status = 'confirmed', updated_at = now() where id = p_sales_order_id;
end;
$$;
