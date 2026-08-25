-- Factory Milestone 5 (Block/Slab Factory, optional capability): QC.
-- Research (real stone QC workflow): after cutting, every slab/remnant is
-- visually and physically inspected (cracks, pits, veining, chips, color
-- consistency) before it can be sold -- the operator's grade at cutting time
-- (Milestone 3/4) is provisional; QC either confirms it or overrides it, and
-- decides pass/reject. A rejected piece must never become sellable. Both
-- Milestone 3 and 4 deliberately left this gate for this milestone to build
-- ("every slab lands in_stock immediately -- QC-gated sellability is
-- explicitly Milestone 5's concern, not invented early"); this migration
-- closes that gap rather than leaving it as dead documentation: newly
-- produced slabs/remnants now land 'pending_qc', not 'in_stock', and only a
-- passed inspection moves them to 'in_stock'. A rejected one moves to
-- 'rejected' -- structurally excluded from 'in_stock', the same status-based
-- gate every future sales-integration query for unit-tracked stock will
-- naturally filter on (Phase 1's confirm_sales_order already explicitly
-- refuses unit-tracked products outright -- "not yet reservable in Phase 1"
-- -- so there is no existing sales code to change; this migration's job is
-- making sure the gate is already correct for whenever that lands).
--
-- Deliberately NOT in this milestone: blocks are not QC'd (the spec's
-- wording is scoped to slabs/remnants, matching real workflow -- a block's
-- quality is judged by what it yields, not inspected as a unit itself); a
-- re-inspection/appeal workflow (not requested -- a rejected piece stays
-- rejected under this milestone; each unit may be inspected exactly once).

alter type inventory_unit_status add value 'pending_qc';
alter type inventory_unit_status add value 'rejected';

create type qc_outcome as enum ('passed', 'rejected');

create table qc_inspections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  inventory_unit_id uuid not null references inventory_units (id),
  branch_id uuid not null references branches (id),
  outcome qc_outcome not null,
  confirmed_grade text,
  defects text,
  notes text,
  inspected_by uuid references profiles (id),
  inspected_at timestamptz not null default now()
);

create index idx_qc_inspections_tenant_id on qc_inspections (tenant_id);
create index idx_qc_inspections_inventory_unit_id on qc_inspections (inventory_unit_id);
create index idx_qc_inspections_branch_id on qc_inspections (branch_id);

-- QC is fundamentally the same "gate-keeping decision on a resource" shape
-- as approving a PO or a sales order -- reuses the existing 'production'
-- resource's 'approve' action rather than inventing a 12th, QC-specific
-- permission action outside Phase 0's standard 11-action catalog.
alter table qc_inspections enable row level security;
create policy qc_inspections_select on qc_inspections for select
  using (is_tenant_member(tenant_id) and has_branch_access(tenant_id, branch_id));
create policy qc_inspections_insert on qc_inspections for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'production', 'approve') and has_branch_access(tenant_id, branch_id));
-- No update/delete policy: an inspection record is an immutable audit trail,
-- not an editable draft -- correcting a mistaken inspection is a fresh
-- inspection, not a rewrite of history.

-- qc_manager was created with only 'production'.'view' (0039) -- before this
-- milestone there was nothing to approve. Add 'approve' so QC managers can
-- actually record inspections; every other role's grants reproduced as-is.
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
-- complete_processing_job (extended): newly created slabs/remnants now land
-- 'pending_qc' instead of 'in_stock' -- everything else is byte-for-byte
-- unchanged from the Milestone 4 version.
-- ---------------------------------------------------------------------------
create or replace function complete_processing_job(p_processing_job_id uuid, p_slabs jsonb) returns uuid[]
language plpgsql security definer set search_path = public as $$
declare
  v_job processing_jobs%rowtype;
  v_block inventory_units%rowtype;
  v_slab jsonb;
  v_seq int := 0;
  v_slab_count int := 0;
  v_remnant_count int := 0;
  v_len_cm numeric(18, 6);
  v_wid_cm numeric(18, 6);
  v_thick_cm numeric(18, 6);
  v_area_cm2 numeric(24, 6);
  v_item_volume_cm3 numeric(24, 6);
  v_total_output_volume_cm3 numeric(24, 6) := 0;
  v_block_volume_cm3 numeric(24, 6);
  v_waste_volume_cm3 numeric(24, 6);
  v_area_uom_code text;
  v_volume_uom_code text;
  v_area numeric(14, 4);
  v_item_volume numeric(14, 6);
  v_waste_volume numeric(14, 6);
  v_yield_percentage numeric(7, 4);
  v_usable_area numeric(14, 4);
  v_new_unit_id uuid;
  v_result uuid[] := '{}';
  v_cm_uom_id uuid;
  v_length numeric;
  v_width numeric;
  v_thickness numeric;
  v_dimension_uom_id uuid;
  v_area_uom_id uuid;
  v_quality_grade text;
  v_unit_type inventory_unit_type;
begin
  select * into v_job from processing_jobs where id = p_processing_job_id for update;
  if not found then
    raise exception 'Processing job not found';
  end if;
  if not has_permission(v_job.tenant_id, 'production', 'edit') then
    raise exception 'Missing permission: production.edit';
  end if;
  if not has_branch_access(v_job.tenant_id, v_job.branch_id) then
    raise exception 'You do not have access to the branch of this processing job';
  end if;
  if not has_capability(v_job.tenant_id, 'block_slab_factory') then
    raise exception 'The Block/Slab Factory capability is not enabled for this tenant';
  end if;
  if v_job.status <> 'in_progress' then
    raise exception 'Processing job is not in_progress (current status: %)', v_job.status;
  end if;

  if p_slabs is not null and jsonb_typeof(p_slabs) <> 'array' then
    raise exception 'p_slabs must be a jsonb array (empty for a fully wasted block)';
  end if;

  select * into v_block from inventory_units where id = v_job.input_unit_id and tenant_id = v_job.tenant_id for update;
  if not found then
    raise exception 'Input block not found';
  end if;
  if v_block.status <> 'processing' then
    raise exception 'Input block is not currently being processed (current status: %)', v_block.status;
  end if;
  if v_block.volume is null or v_block.volume_uom_id is null then
    raise exception 'Input block has no recorded volume; yield cannot be computed (was it received via block intake?)';
  end if;

  select id into v_cm_uom_id from uom where code = 'CM' and tenant_id is null;

  select code into v_volume_uom_code from uom where id = v_block.volume_uom_id;
  if v_volume_uom_code = 'M3' then
    v_block_volume_cm3 := v_block.volume * 1000000;
  elsif v_volume_uom_code = 'CFT' then
    v_block_volume_cm3 := v_block.volume * 28316.846592;
  else
    raise exception 'Block volume can only be recorded in M3 or CFT (got %)', v_volume_uom_code;
  end if;

  for v_slab in select * from jsonb_array_elements(coalesce(p_slabs, '[]'::jsonb)) loop
    v_seq := v_seq + 1;
    v_unit_type := coalesce(nullif(v_slab->>'unit_type', ''), 'slab')::inventory_unit_type;
    if v_unit_type not in ('slab', 'remnant') then
      raise exception 'Each output item must be unit_type slab or remnant (got %)', v_unit_type;
    end if;

    v_length := nullif(v_slab->>'length', '')::numeric;
    v_width := nullif(v_slab->>'width', '')::numeric;
    v_thickness := nullif(v_slab->>'thickness', '')::numeric;
    v_dimension_uom_id := nullif(v_slab->>'dimension_uom_id', '')::uuid;
    v_area_uom_id := nullif(v_slab->>'area_uom_id', '')::uuid;
    v_quality_grade := v_slab->>'quality_grade';

    if v_length is null or v_width is null or v_thickness is null or v_dimension_uom_id is null or v_area_uom_id is null then
      raise exception 'Each output item requires length, width, thickness, dimension_uom_id, and area_uom_id';
    end if;
    if v_length <= 0 or v_width <= 0 or v_thickness <= 0 then
      raise exception 'Output length, width, and thickness must all be greater than zero';
    end if;

    v_len_cm := convert_uom_quantity(v_job.tenant_id, null, v_dimension_uom_id, v_cm_uom_id, v_length);
    v_wid_cm := convert_uom_quantity(v_job.tenant_id, null, v_dimension_uom_id, v_cm_uom_id, v_width);
    v_thick_cm := convert_uom_quantity(v_job.tenant_id, null, v_dimension_uom_id, v_cm_uom_id, v_thickness);
    v_area_cm2 := v_len_cm * v_wid_cm;
    v_item_volume_cm3 := v_area_cm2 * v_thick_cm;
    v_total_output_volume_cm3 := v_total_output_volume_cm3 + v_item_volume_cm3;

    select code into v_area_uom_code from uom where id = v_area_uom_id;
    if v_area_uom_code = 'SQFT' then
      -- 1 sqft = 929.0304 cm2 exactly (0.09290304 m2) -- a physical constant.
      v_area := v_area_cm2 / 929.0304;
    elsif v_area_uom_code = 'SQM' then
      -- 1 m2 = 10000 cm2 exactly.
      v_area := v_area_cm2 / 10000;
    else
      raise exception 'Slab/remnant area can only be recorded in SQFT or SQM (got %)', v_area_uom_code;
    end if;

    if v_volume_uom_code = 'M3' then
      v_item_volume := v_item_volume_cm3 / 1000000;
    else
      v_item_volume := v_item_volume_cm3 / 28316.846592;
    end if;

    v_usable_area := nullif(v_slab->>'usable_area', '')::numeric;
    if v_usable_area is null then
      v_usable_area := v_area;
    elsif v_usable_area < 0 or v_usable_area > v_area then
      raise exception 'usable_area must be between 0 and the gross area (got % of %)', v_usable_area, v_area;
    end if;

    if v_unit_type = 'slab' then
      v_slab_count := v_slab_count + 1;
    else
      v_remnant_count := v_remnant_count + 1;
    end if;

    insert into inventory_units (
      tenant_id, product_id, unit_code, unit_type, status, current_location_id, parent_unit_id,
      sequence_number, actual_length, actual_width, actual_thickness, dimension_uom_id,
      actual_area, area_uom_id, usable_area, quality_grade, output_processing_job_id,
      volume, volume_uom_id
    ) values (
      v_job.tenant_id, v_block.product_id,
      v_block.unit_code || case when v_unit_type = 'slab' then '-S' else '-R' end || v_seq,
      v_unit_type, 'pending_qc', null, v_block.id,
      v_seq, v_length, v_width, v_thickness, v_dimension_uom_id,
      v_area, v_area_uom_id, v_usable_area, v_quality_grade, v_job.id,
      v_item_volume, v_block.volume_uom_id
    ) returning id into v_new_unit_id;

    v_result := array_append(v_result, v_new_unit_id);
  end loop;

  if v_total_output_volume_cm3 > v_block_volume_cm3 then
    raise exception 'Total output volume (% cm3) exceeds the input block''s recorded volume (% cm3)', round(v_total_output_volume_cm3, 4), round(v_block_volume_cm3, 4);
  end if;

  v_waste_volume_cm3 := v_block_volume_cm3 - v_total_output_volume_cm3;
  if v_volume_uom_code = 'M3' then
    v_waste_volume := v_waste_volume_cm3 / 1000000;
  else
    v_waste_volume := v_waste_volume_cm3 / 28316.846592;
  end if;
  v_yield_percentage := (v_total_output_volume_cm3 / v_block_volume_cm3) * 100;

  update inventory_units set status = 'consumed' where id = v_block.id;
  update processing_jobs set
    status = 'completed', completed_at = now(), updated_at = now(),
    actual_slab_count = v_slab_count, actual_remnant_count = v_remnant_count,
    yield_percentage = v_yield_percentage, waste_volume = v_waste_volume, waste_volume_uom_id = v_block.volume_uom_id
  where id = p_processing_job_id;

  return v_result;
end;
$$;

revoke execute on function complete_processing_job(uuid, jsonb) from public, anon;

-- ---------------------------------------------------------------------------
-- record_qc_inspection: the pass/reject gate. Locks the unit, requires it be
-- a slab or remnant currently 'pending_qc' (one inspection per unit -- a
-- rejected piece stays rejected under this milestone, no re-inspection
-- workflow), resolves branch access via the unit's own originating job
-- (inventory_units carries no branch_id directly; output_processing_job_id
-- always does, since complete_processing_job sets it on every slab/remnant
-- it creates). On pass, moves the unit to 'in_stock' and lets a QC-confirmed
-- grade override the operator's cutting-time grade if supplied. On reject,
-- moves it to 'rejected' -- excluded from 'in_stock' for good, the same
-- status-based gate any future sales-integration query for unit-tracked
-- stock will filter on.
-- ---------------------------------------------------------------------------
create function record_qc_inspection(
  p_inventory_unit_id uuid,
  p_outcome qc_outcome,
  p_confirmed_grade text default null,
  p_defects text default null,
  p_notes text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_unit inventory_units%rowtype;
  v_job processing_jobs%rowtype;
  v_inspection_id uuid;
begin
  select * into v_unit from inventory_units where id = p_inventory_unit_id for update;
  if not found then
    raise exception 'Inventory unit not found';
  end if;
  if v_unit.unit_type not in ('slab', 'remnant') then
    raise exception 'Only a slab or remnant can be QC-inspected (got %)', v_unit.unit_type;
  end if;
  if v_unit.output_processing_job_id is null then
    raise exception 'This unit has no originating processing job and cannot be branch-scoped for QC';
  end if;

  select * into v_job from processing_jobs where id = v_unit.output_processing_job_id;

  if not has_permission(v_unit.tenant_id, 'production', 'approve') then
    raise exception 'Missing permission: production.approve';
  end if;
  if not has_branch_access(v_unit.tenant_id, v_job.branch_id) then
    raise exception 'You do not have access to the branch of this unit';
  end if;
  if not has_capability(v_unit.tenant_id, 'block_slab_factory') then
    raise exception 'The Block/Slab Factory capability is not enabled for this tenant';
  end if;
  if v_unit.status <> 'pending_qc' then
    raise exception 'This unit is not pending QC (current status: %)', v_unit.status;
  end if;

  insert into qc_inspections (tenant_id, inventory_unit_id, branch_id, outcome, confirmed_grade, defects, notes, inspected_by)
  values (v_unit.tenant_id, v_unit.id, v_job.branch_id, p_outcome, p_confirmed_grade, p_defects, p_notes, auth.uid())
  returning id into v_inspection_id;

  if p_outcome = 'passed' then
    update inventory_units
      set status = 'in_stock', quality_grade = coalesce(p_confirmed_grade, quality_grade)
      where id = v_unit.id;
  else
    update inventory_units set status = 'rejected' where id = v_unit.id;
  end if;

  return v_inspection_id;
end;
$$;

revoke execute on function record_qc_inspection(uuid, qc_outcome, text, text, text) from public, anon;
