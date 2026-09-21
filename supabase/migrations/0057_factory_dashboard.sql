-- Factory dashboard + production-by-machine/operator reports: the fifth
-- real gap this session's own 36-part spec audit found -- Part 20
-- (Factory Operations Dashboard) asks for a floor-level view (WIP, QC
-- pending, dispatch pending) plus machine/operator productivity, on top
-- of the general cross-module dashboard Phase 8 already built.
--
-- Three new RPCs, same shape as Phase 8's reporting layer (security
-- definer, has_permission + has_branch_access, single-branch scope):
--
-- get_factory_dashboard: the floor-level KPI row.
--   - WIP counts both production paradigms this tenant may have enabled
--     (processing_jobs for Block/Slab Factory, production_batches for
--     Tile Manufacturing) rather than assuming only one is active.
--   - QC pending directly reuses the 3-status re-inspectable set this
--     session's own QC-outcomes-expansion migration (0054) introduced
--     ('pending_qc', 'needs_rework', 'on_hold') -- the exact same set
--     record_qc_inspection/record_batch_qc_inspection gate re-inspection
--     on, so this KPI can never drift from what the QC queue screens
--     themselves show. Branch scoping for these follows the same join
--     record_qc_inspection/record_batch_qc_inspection already use
--     (inventory_units -> processing_jobs.branch_id,
--     inventory_batches -> production_batches.branch_id) since neither
--     inventory table carries its own branch_id.
--   - "Dispatch pending" is confirmed-but-not-fully-delivered sales
--     orders (status in 'confirmed'/'partially_delivered') -- the
--     practical floor question "what's ready to ship out but hasn't
--     gone yet" -- not a literal count of deliveries sitting in 'draft'
--     status, since createDeliveryAction never leaves one there in
--     practice (it inserts as 'draft' then immediately calls
--     dispatch_delivery in the same submission).
--
-- get_production_by_machine / get_production_by_operator: productivity
-- rollups over completed processing jobs (Block/Slab Factory) in a date
-- range, grouped by the job's own `machine` text field or `operator_id`.
-- Reuses the exact figures Milestones 4/6 already computed and stored on
-- each job (actual_slab_count, actual_remnant_count, yield_percentage,
-- total_cost) rather than re-deriving anything -- one source of truth,
-- matching this codebase's established "never recompute what a prior
-- RPC already committed" convention (get_dashboard_summary reusing
-- get_profit_and_loss is the precedent). Tile Manufacturing's
-- production_batches has no operator_id (that capability's own scope
-- never asked for one) and only a kiln_number in place of `machine`, so
-- a by-kiln equivalent is intentionally left out here rather than forcing
-- an operator dimension that doesn't exist onto it -- a real, narrower
-- boundary, not an oversight. Gated on 'production'.'view' only (not
-- 'view_cost') since job cost is already shown unredacted on the
-- existing job detail page with no special gate -- this report doesn't
-- invent a new redaction rule the rest of the app doesn't have.
-- Completed jobs with no machine/operator recorded roll up under
-- 'Unspecified' / a null operator_id row rather than being silently
-- dropped -- an unattributed job is still real production.

create function get_factory_dashboard(p_tenant_id uuid, p_branch_id uuid)
returns table (
  wip_processing_jobs bigint,
  wip_production_batches bigint,
  qc_pending_units bigint,
  qc_pending_batches bigint,
  dispatch_pending_orders bigint
)
language plpgsql security definer stable set search_path = public as $$
begin
  if not has_permission(p_tenant_id, 'production', 'view') then
    raise exception 'Missing permission: production.view';
  end if;
  if not has_branch_access(p_tenant_id, p_branch_id) then
    raise exception 'You do not have access to this branch';
  end if;

  return query
    select
      (select count(*) from processing_jobs pj
        where pj.tenant_id = p_tenant_id and pj.branch_id = p_branch_id and pj.status = 'in_progress'),
      (select count(*) from production_batches pb
        where pb.tenant_id = p_tenant_id and pb.branch_id = p_branch_id and pb.status = 'in_progress'),
      (select count(*) from inventory_units iu
        join processing_jobs pj on pj.id = iu.output_processing_job_id
        where iu.tenant_id = p_tenant_id and pj.branch_id = p_branch_id
          and iu.status in ('pending_qc', 'needs_rework', 'on_hold')),
      (select count(*) from inventory_batches ib
        join production_batches pb on pb.id = ib.output_production_batch_id
        where ib.tenant_id = p_tenant_id and pb.branch_id = p_branch_id
          and ib.status in ('pending_qc', 'needs_rework', 'on_hold')),
      (select count(*) from sales_orders so
        where so.tenant_id = p_tenant_id and so.branch_id = p_branch_id
          and so.status in ('confirmed', 'partially_delivered'));
end;
$$;

revoke execute on function get_factory_dashboard(uuid, uuid) from public, anon;

create function get_production_by_machine(p_tenant_id uuid, p_branch_id uuid, p_start_date date, p_end_date date)
returns table (machine text, job_count bigint, total_slabs bigint, total_remnants bigint, avg_yield_pct numeric, total_cost numeric)
language plpgsql security definer stable set search_path = public as $$
begin
  if not has_permission(p_tenant_id, 'production', 'view') then
    raise exception 'Missing permission: production.view';
  end if;
  if not has_branch_access(p_tenant_id, p_branch_id) then
    raise exception 'You do not have access to this branch';
  end if;

  return query
    select
      coalesce(pj.machine, 'Unspecified'),
      count(*),
      coalesce(sum(pj.actual_slab_count), 0),
      coalesce(sum(pj.actual_remnant_count), 0),
      avg(pj.yield_percentage),
      coalesce(sum(pj.total_cost), 0)
    from processing_jobs pj
    where pj.tenant_id = p_tenant_id and pj.branch_id = p_branch_id and pj.status = 'completed'
      and pj.completed_at::date between p_start_date and p_end_date
    group by coalesce(pj.machine, 'Unspecified')
    order by count(*) desc;
end;
$$;

revoke execute on function get_production_by_machine(uuid, uuid, date, date) from public, anon;

create function get_production_by_operator(p_tenant_id uuid, p_branch_id uuid, p_start_date date, p_end_date date)
returns table (operator_id uuid, operator_name text, job_count bigint, total_slabs bigint, total_remnants bigint, avg_yield_pct numeric, total_cost numeric)
language plpgsql security definer stable set search_path = public as $$
begin
  if not has_permission(p_tenant_id, 'production', 'view') then
    raise exception 'Missing permission: production.view';
  end if;
  if not has_branch_access(p_tenant_id, p_branch_id) then
    raise exception 'You do not have access to this branch';
  end if;

  return query
    select
      pj.operator_id,
      coalesce(pr.full_name, 'Unassigned'),
      count(*),
      coalesce(sum(pj.actual_slab_count), 0),
      coalesce(sum(pj.actual_remnant_count), 0),
      avg(pj.yield_percentage),
      coalesce(sum(pj.total_cost), 0)
    from processing_jobs pj
    left join profiles pr on pr.id = pj.operator_id
    where pj.tenant_id = p_tenant_id and pj.branch_id = p_branch_id and pj.status = 'completed'
      and pj.completed_at::date between p_start_date and p_end_date
    group by pj.operator_id, pr.full_name
    order by count(*) desc;
end;
$$;

revoke execute on function get_production_by_operator(uuid, uuid, date, date) from public, anon;
