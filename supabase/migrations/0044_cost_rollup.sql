-- Factory Milestone 6 (Block/Slab Factory, optional capability): Cost
-- Roll-up. Research (real stone-fabrication costing): a block's landed cost
-- (Milestone 1) plus whatever processing (labor/machine time/consumables)
-- and overhead were actually incurred cutting it become the cost basis for
-- everything it produced; this basis must be split across the individual
-- slabs/remnants, never charged equally per piece (a 200-sqft slab and a
-- 5-sqft offcut did not cost the same to produce). Allocation is by VOLUME
-- share -- the same proportional-share technique already used for landed
-- cost across GRN lines in post_goods_receipt (Milestone 1), just on a
-- different basis -- because volume is the one physical quantity already
-- computed for every output unit (Milestone 4, for yield) that honestly
-- represents "how much of the block's material this piece consumed";
-- allocating by area instead would systematically overcharge thin pieces
-- and undercharge thick ones whenever thickness varies across a job's
-- output (e.g. a slab vs. a chunkier remnant). Waste gets no cost bucket of
-- its own (it has no inventory row -- Milestone 4), so the full block +
-- processing + overhead cost is entirely absorbed by whatever was actually
-- produced, exactly like a real factory eats its own scrap cost.
--
-- processing_cost/overhead_cost are entered values, not computed --
-- exactly like Milestone 1 never invented a machine-rate formula and simply
-- accepted freight_cost/duty_cost/handling_cost as entered figures on a
-- goods receipt. Costs can only be recorded once a job is 'completed' (the
-- output volumes this milestone depends on don't exist before then) and
-- exactly once per job (costs_recorded_at is not null) -- correcting a
-- mistaken cost entry is future scope, not requested here, matching how
-- Milestone 5 also chose not to build a re-inspection/correction workflow.

alter table processing_jobs
  add column processing_cost numeric(18, 4),
  add column overhead_cost numeric(18, 4),
  add column total_cost numeric(18, 4),
  add column costs_recorded_at timestamptz;

-- ---------------------------------------------------------------------------
-- record_processing_costs: locks the job, requires it 'completed' and not
-- already costed, requires the input block to have a recorded cost (it
-- always will if it came from Milestone 1's block intake). Computes
-- total_cost = block.cost + processing_cost + overhead_cost, then allocates
-- it across every output unit (slab or remnant) from this job proportional
-- to that unit's own volume share of the job's total output volume -- the
-- exact v_share/v_allocated shape post_goods_receipt already uses for
-- landed cost, reused here on a volume basis. If the job produced zero
-- output (Milestone 4's 100%-waste case), there is nothing to allocate cost
-- to; the job-level cost fields are still recorded for the record (the
-- block's cost + whatever was spent processing it is a real, total loss).
-- ---------------------------------------------------------------------------
create function record_processing_costs(
  p_processing_job_id uuid,
  p_processing_cost numeric,
  p_overhead_cost numeric default 0
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_job processing_jobs%rowtype;
  v_block_cost numeric(18, 4);
  v_total_cost numeric(18, 4);
  v_total_output_volume numeric(24, 6);
  v_unit record;
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
  if v_job.status <> 'completed' then
    raise exception 'Processing job is not completed (current status: %)', v_job.status;
  end if;
  if v_job.costs_recorded_at is not null then
    raise exception 'Costs have already been recorded for this processing job';
  end if;

  if p_processing_cost is null or p_processing_cost < 0 then
    raise exception 'processing_cost must be zero or greater';
  end if;
  if p_overhead_cost is null or p_overhead_cost < 0 then
    raise exception 'overhead_cost must be zero or greater';
  end if;

  select cost into v_block_cost from inventory_units where id = v_job.input_unit_id and tenant_id = v_job.tenant_id;
  if v_block_cost is null then
    raise exception 'Input block has no recorded cost; cost roll-up cannot be computed';
  end if;

  v_total_cost := v_block_cost + p_processing_cost + p_overhead_cost;

  select coalesce(sum(volume), 0) into v_total_output_volume
  from inventory_units where output_processing_job_id = v_job.id;

  if v_total_output_volume > 0 then
    for v_unit in select id, volume from inventory_units where output_processing_job_id = v_job.id for update loop
      -- Computed as one expression (not through a rounded intermediate
      -- share variable) so the allocation carries full precision.
      update inventory_units set cost = v_total_cost * v_unit.volume / v_total_output_volume where id = v_unit.id;
    end loop;
  end if;

  update processing_jobs set
    processing_cost = p_processing_cost, overhead_cost = p_overhead_cost,
    total_cost = v_total_cost, costs_recorded_at = now(), updated_at = now()
  where id = p_processing_job_id;
end;
$$;

revoke execute on function record_processing_costs(uuid, numeric, numeric) from public, anon;
