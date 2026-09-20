-- QC outcomes expansion: Milestone 5's original qc_outcome was a deliberate,
-- documented simplification to a binary passed/rejected gate ("Deliberately
-- NOT in this milestone: ... a re-inspection/appeal workflow -- each unit
-- may be inspected exactly once"). The original 36-part spec (Part 17) asks
-- for the real industry-standard 5 outcomes: PASS / FAIL / REWORK / SCRAP /
-- HOLD. This migration closes that gap without inventing a full
-- rework-processing subsystem (no new "rework job" type, no changed
-- processing-job workflow) -- REWORK and HOLD each move a unit/batch into
-- its own distinct, *re-inspectable* status instead of a terminal one, so a
-- unit sent back for rework or left on hold can be inspected again later
-- (record_qc_inspection/record_batch_qc_inspection's own "already
-- inspected" gate is loosened to allow this); PASS/FAIL/SCRAP stay terminal,
-- exactly like the original passed/rejected pair did.
--
-- 'rejected' is renamed to 'failed' (not left as a parallel synonym) since
-- this is a pre-launch schema with no real tenant data -- a rename keeps
-- exactly one word for "did not pass QC" instead of two.

alter type qc_outcome rename value 'rejected' to 'failed';
alter type qc_outcome add value 'rework';
alter type qc_outcome add value 'scrap';
alter type qc_outcome add value 'hold';

alter type inventory_unit_status add value 'needs_rework';
alter type inventory_unit_status add value 'scrapped';
alter type inventory_unit_status add value 'on_hold';

alter type inventory_batch_status add value 'needs_rework';
alter type inventory_batch_status add value 'scrapped';
alter type inventory_batch_status add value 'on_hold';

-- ---------------------------------------------------------------------------
-- record_qc_inspection (extended): now accepts re-inspection when the unit
-- is 'needs_rework' or 'on_hold', not only fresh from 'pending_qc'. Maps
-- all 5 outcomes to their own status. Otherwise byte-for-byte the same as
-- the Milestone 5 version (same permission/branch/capability checks, same
-- confirmed-grade override on a pass).
-- ---------------------------------------------------------------------------
create or replace function record_qc_inspection(
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
  v_new_status inventory_unit_status;
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
  if v_unit.status not in ('pending_qc', 'needs_rework', 'on_hold') then
    raise exception 'This unit is not awaiting QC (current status: %)', v_unit.status;
  end if;

  insert into qc_inspections (tenant_id, inventory_unit_id, branch_id, outcome, confirmed_grade, defects, notes, inspected_by)
  values (v_unit.tenant_id, v_unit.id, v_job.branch_id, p_outcome, p_confirmed_grade, p_defects, p_notes, auth.uid())
  returning id into v_inspection_id;

  v_new_status := case p_outcome
    when 'passed' then 'in_stock'
    when 'failed' then 'rejected'
    when 'rework' then 'needs_rework'
    when 'scrap' then 'scrapped'
    when 'hold' then 'on_hold'
  end;

  update inventory_units
    set status = v_new_status,
        quality_grade = case when p_outcome = 'passed' then coalesce(p_confirmed_grade, quality_grade) else quality_grade end
    where id = v_unit.id;

  return v_inspection_id;
end;
$$;

revoke execute on function record_qc_inspection(uuid, qc_outcome, text, text, text) from public, anon;

-- ---------------------------------------------------------------------------
-- record_batch_qc_inspection (extended): same widening as
-- record_qc_inspection above, applied to the batch-tracked mirror.
-- ---------------------------------------------------------------------------
create or replace function record_batch_qc_inspection(
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
  v_new_status inventory_batch_status;
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
  if v_ibatch.status not in ('pending_qc', 'needs_rework', 'on_hold') then
    raise exception 'This batch is not awaiting QC (current status: %)', v_ibatch.status;
  end if;

  insert into qc_inspections (tenant_id, inventory_batch_id, branch_id, outcome, confirmed_grade, defects, notes, inspected_by)
  values (v_ibatch.tenant_id, p_inventory_batch_id, v_pbatch.branch_id, p_outcome, p_confirmed_grade, p_defects, p_notes, auth.uid())
  returning id into v_inspection_id;

  v_new_status := case p_outcome
    when 'passed' then 'in_stock'
    when 'failed' then 'rejected'
    when 'rework' then 'needs_rework'
    when 'scrap' then 'scrapped'
    when 'hold' then 'on_hold'
  end;

  update inventory_batches set status = v_new_status where id = p_inventory_batch_id;

  return v_inspection_id;
end;
$$;

revoke execute on function record_batch_qc_inspection(uuid, qc_outcome, text, text, text) from public, anon;
