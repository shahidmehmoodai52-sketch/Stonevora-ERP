-- Factory Milestone 3 (Block/Slab Factory, optional capability): Slab Output +
-- Genealogy. Research (real gangsaw/multi-wire cutting output): a finished
-- slab's identity is its actual cut dimensions (length/width/thickness) and
-- its area -- billed area for natural stone is conventionally the bounding
-- rectangle (length x width), NOT a hand-measured irregular polygon, because
-- that is what cutting/sizing equipment and invoices actually record. A
-- separate "usable area" (<= the gross rectangular area) exists to capture
-- cutouts/visible damage noticed at cutting time -- this can only be an
-- operator-entered value, never a derived formula, because arbitrary cutout
-- shapes cannot be computed from length/width alone. Formal accept/reject
-- QC grading is deliberately NOT here -- that is Milestone 5; every slab this
-- milestone creates goes straight to 'in_stock', matching how Milestone 1's
-- blocks and Milestone 2's job model were each scoped to their own concern
-- and left the next milestone's gate for that milestone to add.
--
-- Deliberately NOT in this milestone: yield/waste percentage bookkeeping or
-- remnant classification (Milestone 4), QC-driven sellability (Milestone 5),
-- and cost roll-up onto the produced slabs (Milestone 6) -- v_slab.cost is
-- left null here on purpose rather than guessing a cost-splitting formula.

alter type inventory_unit_status add value 'consumed';

alter table inventory_units
  add column area_uom_id uuid references uom (id),
  add column usable_area numeric(14, 4),
  add column output_processing_job_id uuid references processing_jobs (id);

create index idx_inventory_units_output_processing_job_id on inventory_units (output_processing_job_id);

-- inventory_units predates this table's audit trigger (Phase 0 never attached
-- one) -- purely additive, reusing the existing generic trigger function, and
-- directly relevant now that this milestone starts writing new movements
-- (block consumed -> slabs created) that must be auditable.
create trigger inventory_units_audit
  after insert or update or delete on inventory_units
  for each row execute function audit_trigger_fn();

-- ---------------------------------------------------------------------------
-- complete_processing_job: the block -> slab transition. Locks the job, then
-- the input block (must still be 'processing', i.e. actually started by
-- start_processing_job), inserts one inventory_units row per output slab
-- (unit_type='slab', parent_unit_id=the block -- the genealogy link required
-- by the spec), computes each slab's area the same way Milestone 1 computed
-- block volume: normalize length/width to CM via convert_uom_quantity (the
-- existing UOM engine), then divide by an exact physical constant into the
-- requested area unit (SQFT or SQM -- math, not a business rule). Finally
-- marks the block 'consumed' (it no longer exists as stock -- the same
-- "input must not remain incorrectly available" rule Milestone 2 applied to
-- 'processing') and the job 'completed'.
--
-- p_slabs is a jsonb array of {length, width, thickness?, dimension_uom_id,
-- area_uom_id, quality_grade?, usable_area?}. current_location_id is left
-- null on the created slabs: the block's yard location and the job's
-- warehouse are not the same physical spot as wherever the slab actually
-- lands, and no factory-specific movement mechanism exists yet to place it
-- correctly -- left null rather than guessing, and documented as deferred
-- until a movement/put-away step is built for the factory workflow.
-- ---------------------------------------------------------------------------
create function complete_processing_job(p_processing_job_id uuid, p_slabs jsonb) returns uuid[]
language plpgsql security definer set search_path = public as $$
declare
  v_job processing_jobs%rowtype;
  v_block inventory_units%rowtype;
  v_slab jsonb;
  v_seq int := 0;
  v_len_cm numeric(18, 6);
  v_wid_cm numeric(18, 6);
  v_area_cm2 numeric(24, 6);
  v_area_uom_code text;
  v_area numeric(14, 4);
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

  if p_slabs is null or jsonb_typeof(p_slabs) <> 'array' or jsonb_array_length(p_slabs) = 0 then
    raise exception 'At least one output slab is required to complete a processing job';
  end if;

  select * into v_block from inventory_units where id = v_job.input_unit_id and tenant_id = v_job.tenant_id for update;
  if not found then
    raise exception 'Input block not found';
  end if;
  if v_block.status <> 'processing' then
    raise exception 'Input block is not currently being processed (current status: %)', v_block.status;
  end if;

  select id into v_cm_uom_id from uom where code = 'CM' and tenant_id is null;

  for v_slab in select * from jsonb_array_elements(p_slabs) loop
    v_seq := v_seq + 1;
    v_length := nullif(v_slab->>'length', '')::numeric;
    v_width := nullif(v_slab->>'width', '')::numeric;
    v_thickness := nullif(v_slab->>'thickness', '')::numeric;
    v_dimension_uom_id := nullif(v_slab->>'dimension_uom_id', '')::uuid;
    v_area_uom_id := nullif(v_slab->>'area_uom_id', '')::uuid;
    v_quality_grade := v_slab->>'quality_grade';

    if v_length is null or v_width is null or v_dimension_uom_id is null or v_area_uom_id is null then
      raise exception 'Each output slab requires length, width, dimension_uom_id, and area_uom_id';
    end if;
    if v_length <= 0 or v_width <= 0 then
      raise exception 'Slab length and width must be greater than zero';
    end if;

    v_len_cm := convert_uom_quantity(v_job.tenant_id, null, v_dimension_uom_id, v_cm_uom_id, v_length);
    v_wid_cm := convert_uom_quantity(v_job.tenant_id, null, v_dimension_uom_id, v_cm_uom_id, v_width);
    v_area_cm2 := v_len_cm * v_wid_cm;

    select code into v_area_uom_code from uom where id = v_area_uom_id;
    if v_area_uom_code = 'SQFT' then
      -- 1 sqft = 929.0304 cm2 exactly (0.09290304 m2) -- a physical constant.
      v_area := v_area_cm2 / 929.0304;
    elsif v_area_uom_code = 'SQM' then
      -- 1 m2 = 10000 cm2 exactly.
      v_area := v_area_cm2 / 10000;
    else
      raise exception 'Slab area can only be recorded in SQFT or SQM (got %)', v_area_uom_code;
    end if;

    v_usable_area := nullif(v_slab->>'usable_area', '')::numeric;
    if v_usable_area is null then
      v_usable_area := v_area;
    elsif v_usable_area < 0 or v_usable_area > v_area then
      raise exception 'usable_area must be between 0 and the gross slab area (got % of %)', v_usable_area, v_area;
    end if;

    insert into inventory_units (
      tenant_id, product_id, unit_code, unit_type, status, current_location_id, parent_unit_id,
      sequence_number, actual_length, actual_width, actual_thickness, dimension_uom_id,
      actual_area, area_uom_id, usable_area, quality_grade, output_processing_job_id
    ) values (
      v_job.tenant_id, v_block.product_id, v_block.unit_code || '-S' || v_seq, 'slab', 'in_stock', null, v_block.id,
      v_seq, v_length, v_width, v_thickness, v_dimension_uom_id,
      v_area, v_area_uom_id, v_usable_area, v_quality_grade, v_job.id
    ) returning id into v_new_unit_id;

    v_result := array_append(v_result, v_new_unit_id);
  end loop;

  update inventory_units set status = 'consumed' where id = v_block.id;
  update processing_jobs set status = 'completed', completed_at = now(), actual_slab_count = v_seq, updated_at = now() where id = p_processing_job_id;

  return v_result;
end;
$$;

revoke execute on function complete_processing_job(uuid, jsonb) from public, anon;
