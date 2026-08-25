-- Factory Milestone 2 (Block/Slab Factory, optional capability):
-- Processing/Cutting. Research (marble/granite processing workflow, see
-- chat for sources): a block moves through inspection, then cutting
-- (gangsaw/multi-wire), then squaring, then polishing, before slabs exist as
-- sellable inventory. This milestone models the JOB wrapper around that --
-- which block, which stage, which machine, who ran it, when it started/
-- ended -- and the state transition that takes a block out of "in_stock"
-- the moment cutting actually begins (rule: "input block should not remain
-- incorrectly available after it has been consumed/processed").
--
-- Deliberately NOT in this milestone: producing the actual slab rows with
-- area/genealogy (Milestone 3 — Slab Output + Genealogy) or yield/waste
-- percentages (Milestone 4). A job here only reaches 'in_progress'; nothing
-- yet transitions it to 'completed' -- that belongs to whichever milestone
-- actually creates the output, so "completing" a job and "producing slabs"
-- aren't two separately-invented mechanisms answering the same event.

alter type inventory_unit_status add value 'processing';

create type processing_job_status as enum ('draft', 'in_progress', 'completed', 'cancelled');
create type processing_stage as enum ('cutting', 'squaring', 'polishing', 'other');

create table processing_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  job_number text not null,
  input_unit_id uuid not null references inventory_units (id),
  branch_id uuid not null references branches (id),
  warehouse_id uuid not null references warehouses (id),
  stage processing_stage not null default 'cutting',
  machine text,
  operator_id uuid references profiles (id),
  status processing_job_status not null default 'draft',
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  expected_slab_count int,
  actual_slab_count int,
  notes text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, job_number)
);

-- Defense in depth alongside the inventory_units.status check inside the
-- RPCs below: a block can never have two simultaneously-active (draft or
-- in_progress) jobs, closing the "duplicate/concurrent processing must not
-- double-consume the same block" requirement at the schema level too.
create unique index idx_processing_jobs_one_active_per_unit
  on processing_jobs (input_unit_id)
  where status in ('draft', 'in_progress');

create index idx_processing_jobs_tenant_id on processing_jobs (tenant_id);
create index idx_processing_jobs_input_unit_id on processing_jobs (input_unit_id);
create index idx_processing_jobs_branch_id on processing_jobs (branch_id);
create index idx_processing_jobs_warehouse_id on processing_jobs (warehouse_id);
create index idx_processing_jobs_operator_id on processing_jobs (operator_id);

-- ---------------------------------------------------------------------------
-- New 'production' permission resource -- factory/processing actions are a
-- distinct concern from the product catalog ('product') or warehouse admin
-- ('warehouse'), matching exactly how Phase 1 added 'purchasing'/'sales' for
-- its own domain rather than overloading an existing resource.
-- ---------------------------------------------------------------------------
insert into permissions (resource, action) select 'production', a.action
from (values ('view'), ('create'), ('edit'), ('delete'), ('approve'), ('cancel'), ('print'), ('export'), ('view_cost'), ('view_profit'), ('view_financial')) as a(action);

alter table processing_jobs enable row level security;
create policy processing_jobs_select on processing_jobs for select
  using (is_tenant_member(tenant_id) and has_branch_access(tenant_id, branch_id));
create policy processing_jobs_insert on processing_jobs for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'production', 'create') and has_branch_access(tenant_id, branch_id));
create policy processing_jobs_update on processing_jobs for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'production', 'edit') and has_branch_access(tenant_id, branch_id))
  with check (is_tenant_member(tenant_id) and has_branch_access(tenant_id, branch_id));
create policy processing_jobs_delete on processing_jobs for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'production', 'delete') and has_branch_access(tenant_id, branch_id));

create trigger processing_jobs_audit
  after insert or update or delete on processing_jobs
  for each row execute function audit_trigger_fn();

-- ---------------------------------------------------------------------------
-- Extend the tenant-onboarding role grants (0012, last touched in 0024/0031)
-- to cover 'production': factory_manager/production_manager get full
-- operational control (mirroring purchase_manager's shape), production
-- operators get view/create/edit only (mirroring warehouse_staff), and
-- qc_manager gains production visibility ahead of the QC milestone. No
-- existing tenant needs backfilling -- zero tenants exist in this project.
-- ---------------------------------------------------------------------------
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
          or (v_permission.resource = 'production' and v_permission.action = 'view')
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
-- start_processing_job: moves the job from draft to in_progress and the
-- input block from 'in_stock' to 'processing' in one atomic step. Locks the
-- job row and then the unit row (for update) so two concurrent calls
-- serialize -- the second sees the block already 'processing' (or the job
-- already 'in_progress') and is rejected, never double-starts the same
-- block.
-- ---------------------------------------------------------------------------
create function start_processing_job(p_processing_job_id uuid) returns void
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

-- ---------------------------------------------------------------------------
-- cancel_processing_job: from draft, nothing to undo. From in_progress,
-- restores the input block to 'in_stock' -- the same "leave inventory
-- exactly as it was" guarantee cancel_stock_transfer gives a shipment.
-- ---------------------------------------------------------------------------
create function cancel_processing_job(p_processing_job_id uuid) returns void
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

revoke execute on function start_processing_job(uuid) from public, anon;
revoke execute on function cancel_processing_job(uuid) from public, anon;
