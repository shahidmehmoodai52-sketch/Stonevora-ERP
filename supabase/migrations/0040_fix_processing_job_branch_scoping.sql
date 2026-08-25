-- Bug found via live testing: start_processing_job/cancel_processing_job
-- checked has_permission()/has_capability() but never has_branch_access().
-- Because these are SECURITY DEFINER functions, RLS on processing_jobs does
-- NOT apply inside their body (the same reason every other Phase 1
-- integrity function -- and ship_stock_transfer/receive_stock_transfer/
-- cancel_stock_transfer in the Foundation Hardening work -- re-checks
-- has_branch_access explicitly rather than relying on RLS). A user scoped to
-- Branch B was able to start/cancel a Branch A processing job outright, only
-- blocked from *seeing* it in a plain select. Fix: check
-- has_branch_access(tenant_id, branch_id) explicitly, matching every other
-- branch-scoped RPC.
create or replace function start_processing_job(p_processing_job_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_job processing_jobs%rowtype;
  v_unit inventory_units%rowtype;
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
  if v_job.status <> 'draft' then
    raise exception 'Processing job is not in draft status';
  end if;

  select * into v_unit from inventory_units where id = v_job.input_unit_id and tenant_id = v_job.tenant_id for update;
  if not found then
    raise exception 'Input block not found';
  end if;
  if v_unit.unit_type <> 'block' then
    raise exception 'Only a block (not a slab or remnant) can be the input of a processing job';
  end if;
  if v_unit.status <> 'in_stock' then
    raise exception 'Input block is not available for processing (current status: %)', v_unit.status;
  end if;

  update inventory_units set status = 'processing' where id = v_unit.id;
  update processing_jobs set status = 'in_progress', started_at = now(), updated_at = now() where id = p_processing_job_id;
end;
$$;

create or replace function cancel_processing_job(p_processing_job_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_job processing_jobs%rowtype;
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
  if v_job.status = 'completed' then
    raise exception 'A completed processing job cannot be cancelled';
  end if;
  if v_job.status = 'cancelled' then
    raise exception 'Processing job is already cancelled';
  end if;

  if v_job.status = 'in_progress' then
    update inventory_units set status = 'in_stock' where id = v_job.input_unit_id and tenant_id = v_job.tenant_id;
  end if;

  update processing_jobs set status = 'cancelled', cancelled_at = now(), updated_at = now() where id = p_processing_job_id;
end;
$$;
