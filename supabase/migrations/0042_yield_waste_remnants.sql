-- Factory Milestone 4 (Block/Slab Factory, optional capability): Yield +
-- Waste + Remnants. Research (real stone-fabrication yield accounting): a
-- block's material always splits three ways once cut -- standard-size
-- sellable slabs, smaller-but-still-usable offcut pieces ("remnants": vanity
-- tops, thresholds, tile blanks), and true waste (saw-kerf loss, dust,
-- pieces too small/cracked to use at all). Waste has no physical identity to
-- track -- it is discarded, not inventoried -- so it is never a genealogy
-- row; it is derived purely by mass balance: waste = block volume - (slab
-- volume + remnant volume). Slabs and remnants are structurally identical
-- (both are cut/measured pieces with length/width/thickness/area) and differ
-- only in business classification -- reusing exactly the unit_type='slab'
-- vs 'remnant' distinction inventory_units has carried since Phase 0, rather
-- than inventing new columns or a parallel table. Yield is expressed as a
-- volume percentage (actual usable output volume / the block's own recorded
-- volume) -- this is the real-world convention (a slab's "yield share" is
-- its area x its thickness, since sawing loses material as kerf and
-- squaring/trimming loses more, and volume is the only unit both a block and
-- its cut pieces can be honestly compared in).
--
-- Deliberately NOT in this milestone: any cost allocation by
-- yield/volume/area share (Milestone 6 -- would be guessing a cost-split
-- rule before researching it) and QC-driven accept/reject of a slab or
-- remnant (Milestone 5).

alter table processing_jobs
  add column yield_percentage numeric(7, 4),
  add column waste_volume numeric(14, 6),
  add column waste_volume_uom_id uuid references uom (id),
  add column actual_remnant_count int;

-- ---------------------------------------------------------------------------
-- complete_processing_job (extended): each output item in p_slabs may now
-- carry an optional "unit_type" ('slab', the default, or 'remnant'), and the
-- array may now be EMPTY -- a real scenario (a block that turns out fully
-- unusable once opened, e.g. an internal crack) must be completable as 100%
-- waste, not blocked by an artificial "at least one output" rule. thickness
-- is now REQUIRED on every item (it previously defaulted to null) because
-- yield/waste math needs a volume for every piece, and a piece with unknown
-- thickness cannot honestly be given one.
--
-- Every item's volume is computed the same way block volume was computed in
-- Milestone 1 (length x width x thickness, normalized to CM via the existing
-- UOM engine, cm3 -- math, not a business rule) and summed. The block's own
-- recorded volume (from intake) is converted back to cm3 the same way. If
-- total output volume would exceed the block's recorded volume, that is
-- physically impossible and rejected outright, not silently allowed. The
-- remainder (block volume - total output volume) is waste, stored on the
-- job in the block's own volume unit -- never inventoried, matching the
-- "waste has no physical identity" rule above.
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
      v_unit_type, 'in_stock', null, v_block.id,
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
