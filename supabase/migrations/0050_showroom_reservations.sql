-- Phase 5 -- Showroom/Reservation mode (optional capability:
-- 'showroom_reservation', already present in the business_capabilities
-- catalog since Phase 0 -- no new capability row needed). A walk-in
-- showroom customer wants to hold specific stock while they decide/arrange
-- payment, without yet committing to a full sales order. Economy of
-- design, matching this project's repeated pattern: a reservation is its
-- own lightweight header+line pair (draft -> active -> converted/released),
-- NOT a repurposed sales_orders row -- a reservation predates any
-- commitment to buy (a customer can walk away without ever creating an
-- order), needs its own expiry, and its "draft" stage is even lighter than
-- a sales order's (no pricing/currency required). Converting an active
-- reservation hands its already-reserved stock off directly into a real
-- sales_orders row created 'confirmed' (bypassing confirm_sales_order's own
-- reservation pass entirely, since the hold already exists) -- the same
-- "generate into Phase 1's own table" reuse Phase 3 already established for
-- generate_project_invoice writing into sales_invoices.
--
-- Scope boundary, explicit (mirroring the exact boundary confirm_sales_order
-- already draws): unit-tracked products (blocks/slabs) are NOT reservable
-- here, same as they are not yet sellable through confirm_sales_order/
-- dispatch_delivery at all -- extending the whole Phase 1 sales pipeline to
-- handle unit-tracked delivery is a separate, larger piece of work than
-- Showroom Reservation's own scope and is left for a future phase, not
-- half-built here.
--
-- No automatic expiry sweep: this codebase has no scheduled-job
-- infrastructure yet, so expires_at is a stored, checked field, not a
-- background process. convert_reservation_to_sales_order refuses to convert
-- past its expiry; release_stock_reservation works on an active reservation
-- regardless of expiry, so staff can free an expired hold's stock at any
-- time. An expired-but-unreleased reservation keeps its hold until someone
-- releases it -- a known, explicit limitation, not a silent bug.
--
-- Branch-access lesson applied proactively (as every phase since Phase 1.x
-- has): every new RPC checks has_branch_access() in its body from this, its
-- first version.

create type stock_reservation_status as enum ('draft', 'active', 'converted', 'released');

create table stock_reservations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  branch_id uuid not null references branches (id),
  warehouse_id uuid not null references warehouses (id),
  customer_id uuid not null references customers (id),
  reservation_number text not null,
  status stock_reservation_status not null default 'draft',
  expires_at timestamptz,
  sales_order_id uuid references sales_orders (id),
  notes text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  released_at timestamptz,
  converted_at timestamptz,
  unique (tenant_id, reservation_number)
);

create table stock_reservation_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  stock_reservation_id uuid not null references stock_reservations (id) on delete cascade,
  product_id uuid not null references products (id),
  quantity numeric(18, 4) not null check (quantity > 0),
  uom_id uuid not null references uom (id),
  unit_price numeric(18, 4) not null, -- caller-entered indicative price, carried into the sales order at conversion; never invented
  base_quantity numeric(18, 4), -- locked at activation, reused at conversion (matches raw_material_cost's "lock at start" precedent)
  created_at timestamptz not null default now()
);

create index idx_stock_reservations_branch_id on stock_reservations (branch_id);
create index idx_stock_reservations_warehouse_id on stock_reservations (warehouse_id);
create index idx_stock_reservations_customer_id on stock_reservations (customer_id);
create index idx_stock_reservations_sales_order_id on stock_reservations (sales_order_id);
create index idx_stock_reservation_lines_stock_reservation_id on stock_reservation_lines (stock_reservation_id);
create index idx_stock_reservation_lines_product_id on stock_reservation_lines (product_id);
create index idx_stock_reservation_lines_uom_id on stock_reservation_lines (uom_id);

-- ---------------------------------------------------------------------------
-- RLS. Reuses the 'sales' resource with branch scoping, exactly like
-- sales_orders(_lines) -- a reservation is a pre-sales-order sales-side
-- transaction, the same reasoning Phase 1.x already applied to reuse
-- 'sales'/'purchasing' for returns. No create_tenant_for_user changes
-- needed: sales_manager/salesperson/dispatch_staff already hold the right
-- 'sales' grants.
-- ---------------------------------------------------------------------------

alter table stock_reservations enable row level security;
create policy stock_reservations_select on stock_reservations for select
  using (is_tenant_member(tenant_id) and has_branch_access(tenant_id, branch_id));
create policy stock_reservations_insert on stock_reservations for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'create') and has_branch_access(tenant_id, branch_id));
create policy stock_reservations_update on stock_reservations for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'edit') and has_branch_access(tenant_id, branch_id))
  with check (is_tenant_member(tenant_id) and has_branch_access(tenant_id, branch_id));
create policy stock_reservations_delete on stock_reservations for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'delete') and has_branch_access(tenant_id, branch_id));

alter table stock_reservation_lines enable row level security;
create policy stock_reservation_lines_select on stock_reservation_lines for select
  using (exists (select 1 from stock_reservations r where r.id = stock_reservation_lines.stock_reservation_id and is_tenant_member(r.tenant_id) and has_branch_access(r.tenant_id, r.branch_id)));
create policy stock_reservation_lines_insert on stock_reservation_lines for insert
  with check (exists (select 1 from stock_reservations r where r.id = stock_reservation_lines.stock_reservation_id and is_tenant_member(r.tenant_id) and has_permission(r.tenant_id, 'sales', 'create') and has_branch_access(r.tenant_id, r.branch_id)));
create policy stock_reservation_lines_update on stock_reservation_lines for update
  using (exists (select 1 from stock_reservations r where r.id = stock_reservation_lines.stock_reservation_id and is_tenant_member(r.tenant_id) and has_permission(r.tenant_id, 'sales', 'edit') and has_branch_access(r.tenant_id, r.branch_id)))
  with check (exists (select 1 from stock_reservations r where r.id = stock_reservation_lines.stock_reservation_id and is_tenant_member(r.tenant_id) and has_branch_access(r.tenant_id, r.branch_id)));
create policy stock_reservation_lines_delete on stock_reservation_lines for delete
  using (exists (select 1 from stock_reservations r where r.id = stock_reservation_lines.stock_reservation_id and is_tenant_member(r.tenant_id) and has_permission(r.tenant_id, 'sales', 'delete') and has_branch_access(r.tenant_id, r.branch_id)));

create trigger stock_reservations_audit after insert or update or delete on stock_reservations for each row execute function audit_trigger_fn();
create trigger stock_reservation_lines_audit after insert or update or delete on stock_reservation_lines for each row execute function audit_trigger_fn();

-- ---------------------------------------------------------------------------
-- activate_stock_reservation: places the real hold. Two-pass validate-then-
-- reserve, byte-for-byte the same FIFO consumption shape confirm_sales_order
-- (0049) already uses -- batch-tracked lines only ever draw from
-- status = 'in_stock' batches, so Phase 4's QC gate is respected here for
-- free. p_hold_hours has no default: hold duration is a business-policy
-- choice, not something to silently default.
-- ---------------------------------------------------------------------------
create function activate_stock_reservation(p_stock_reservation_id uuid, p_hold_hours numeric) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_reservation stock_reservations%rowtype;
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
  select * into v_reservation from stock_reservations where id = p_stock_reservation_id for update;
  if not found then
    raise exception 'Stock reservation not found';
  end if;
  if not has_permission(v_reservation.tenant_id, 'sales', 'edit') then
    raise exception 'Missing permission: sales.edit';
  end if;
  if not has_branch_access(v_reservation.tenant_id, v_reservation.branch_id) then
    raise exception 'You do not have access to the branch of this reservation';
  end if;
  if not has_capability(v_reservation.tenant_id, 'showroom_reservation') then
    raise exception 'The Showroom Reservation capability is not enabled for this tenant';
  end if;
  if v_reservation.status <> 'draft' then
    raise exception 'Reservation is not in draft status';
  end if;
  if p_hold_hours is null or p_hold_hours <= 0 then
    raise exception 'hold_hours must be greater than zero';
  end if;

  -- Pass 1: validate every line before reserving anything.
  for v_line in select * from stock_reservation_lines where stock_reservation_id = p_stock_reservation_id loop
    select inventory_tracking_mode, base_uom_id into v_tracking_mode, v_base_uom_id from products where id = v_line.product_id;

    if v_tracking_mode = 'unit' then
      raise exception 'Unit-tracked products (blocks/slabs) are not reservable through Showroom Reservation';
    end if;

    v_base_qty := convert_uom_quantity(v_reservation.tenant_id, v_line.product_id, v_line.uom_id, v_base_uom_id, v_line.quantity);

    if v_tracking_mode = 'batch' then
      select coalesce(sum(ib.qty_on_hand - ib.reserved_qty), 0) into v_available
      from inventory_batches ib
      join storage_locations sl on sl.id = ib.current_location_id
      where ib.tenant_id = v_reservation.tenant_id and ib.product_id = v_line.product_id
        and sl.warehouse_id = v_reservation.warehouse_id and ib.status = 'in_stock';
    else
      select coalesce(sum(ist.qty_on_hand - ist.reserved_qty), 0) into v_available
      from inventory_stock ist
      left join storage_locations sl on sl.id = ist.location_id
      where ist.tenant_id = v_reservation.tenant_id and ist.product_id = v_line.product_id
        and (sl.warehouse_id = v_reservation.warehouse_id or ist.location_id is null);
    end if;

    if v_available < v_base_qty then
      raise exception 'Insufficient available stock for product %: requested % (base units), available %',
        v_line.product_id, v_base_qty, v_available;
    end if;
  end loop;

  -- Pass 2: every line already validated -- reserve for real.
  for v_line in select * from stock_reservation_lines where stock_reservation_id = p_stock_reservation_id loop
    select inventory_tracking_mode, base_uom_id into v_tracking_mode, v_base_uom_id from products where id = v_line.product_id;
    v_base_qty := convert_uom_quantity(v_reservation.tenant_id, v_line.product_id, v_line.uom_id, v_base_uom_id, v_line.quantity);
    v_remaining := v_base_qty;

    if v_tracking_mode = 'batch' then
      for v_batch in
        select ib.id, ib.qty_on_hand, ib.reserved_qty from inventory_batches ib
        join storage_locations sl on sl.id = ib.current_location_id
        where ib.tenant_id = v_reservation.tenant_id and ib.product_id = v_line.product_id
          and sl.warehouse_id = v_reservation.warehouse_id and ib.status = 'in_stock'
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
        where ist.tenant_id = v_reservation.tenant_id and ist.product_id = v_line.product_id
          and (sl.warehouse_id = v_reservation.warehouse_id or ist.location_id is null)
          and (ist.qty_on_hand - ist.reserved_qty) > 0
        order by ist.updated_at
        for update of ist
      loop
        exit when v_remaining <= 0;
        v_take := least(v_remaining, v_stock.qty_on_hand - v_stock.reserved_qty);
        update inventory_stock set reserved_qty = reserved_qty + v_take, updated_at = now() where id = v_stock.id;
        v_remaining := v_remaining - v_take;
      end loop;
    end if;

    update stock_reservation_lines set base_quantity = v_base_qty where id = v_line.id;
  end loop;

  update stock_reservations
    set status = 'active', activated_at = now(), expires_at = now() + (p_hold_hours || ' hours')::interval
    where id = p_stock_reservation_id;
end;
$$;

revoke execute on function activate_stock_reservation(uuid, numeric) from public, anon;

-- ---------------------------------------------------------------------------
-- release_stock_reservation: gives the held stock back without ever
-- creating a sales order. Works on an 'active' reservation regardless of
-- expiry (an expired-but-unreleased hold is exactly what this exists to
-- clean up). No has_capability check, matching cancel_production_batch/
-- cancel_processing_job precedent -- releasing is undoing one's own hold,
-- gated by permission/status, not capability.
-- ---------------------------------------------------------------------------
create function release_stock_reservation(p_stock_reservation_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_reservation stock_reservations%rowtype;
  v_line record;
  v_tracking_mode inventory_tracking_mode;
  v_base_uom_id uuid;
  v_base_qty numeric(18, 4);
  v_remaining numeric(18, 4);
  v_take numeric(18, 4);
  v_batch record;
  v_stock record;
begin
  select * into v_reservation from stock_reservations where id = p_stock_reservation_id for update;
  if not found then
    raise exception 'Stock reservation not found';
  end if;
  if not has_permission(v_reservation.tenant_id, 'sales', 'edit') then
    raise exception 'Missing permission: sales.edit';
  end if;
  if not has_branch_access(v_reservation.tenant_id, v_reservation.branch_id) then
    raise exception 'You do not have access to the branch of this reservation';
  end if;
  if v_reservation.status <> 'active' then
    raise exception 'Reservation is not active (current status: %)', v_reservation.status;
  end if;

  for v_line in select * from stock_reservation_lines where stock_reservation_id = p_stock_reservation_id loop
    select inventory_tracking_mode, base_uom_id into v_tracking_mode, v_base_uom_id from products where id = v_line.product_id;
    v_base_qty := coalesce(v_line.base_quantity, convert_uom_quantity(v_reservation.tenant_id, v_line.product_id, v_line.uom_id, v_base_uom_id, v_line.quantity));
    v_remaining := v_base_qty;

    if v_tracking_mode = 'batch' then
      for v_batch in
        select ib.id, ib.reserved_qty from inventory_batches ib
        join storage_locations sl on sl.id = ib.current_location_id
        where ib.tenant_id = v_reservation.tenant_id and ib.product_id = v_line.product_id
          and sl.warehouse_id = v_reservation.warehouse_id and ib.reserved_qty > 0
        order by ib.created_at
        for update
      loop
        exit when v_remaining <= 0;
        v_take := least(v_remaining, v_batch.reserved_qty);
        update inventory_batches set reserved_qty = reserved_qty - v_take where id = v_batch.id;
        v_remaining := v_remaining - v_take;
      end loop;
    else
      for v_stock in
        select ist.id, ist.reserved_qty from inventory_stock ist
        left join storage_locations sl on sl.id = ist.location_id
        where ist.tenant_id = v_reservation.tenant_id and ist.product_id = v_line.product_id
          and (sl.warehouse_id = v_reservation.warehouse_id or ist.location_id is null) and ist.reserved_qty > 0
        order by ist.updated_at
        for update of ist
      loop
        exit when v_remaining <= 0;
        v_take := least(v_remaining, v_stock.reserved_qty);
        update inventory_stock set reserved_qty = reserved_qty - v_take, updated_at = now() where id = v_stock.id;
        v_remaining := v_remaining - v_take;
      end loop;
    end if;
  end loop;

  update stock_reservations set status = 'released', released_at = now() where id = p_stock_reservation_id;
end;
$$;

revoke execute on function release_stock_reservation(uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- convert_reservation_to_sales_order: hands the already-reserved stock off
-- to a real sales order, created directly 'confirmed' -- confirm_sales_order
-- is deliberately NOT called here, since re-running its own reservation
-- pass against stock this reservation already holds would double-reserve.
-- inventory_stock/inventory_batches.reserved_qty is untouched by this
-- function; only sales_order_lines.reserved_quantity is set, for the same
-- bookkeeping/display consistency confirm_sales_order itself provides --
-- dispatch_delivery only ever reads the inventory rows' own reserved_qty,
-- so this handoff is functionally complete without touching them again.
-- ---------------------------------------------------------------------------
create function convert_reservation_to_sales_order(p_stock_reservation_id uuid, p_so_number text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_reservation stock_reservations%rowtype;
  v_sales_order_id uuid;
begin
  select * into v_reservation from stock_reservations where id = p_stock_reservation_id for update;
  if not found then
    raise exception 'Stock reservation not found';
  end if;
  if not has_permission(v_reservation.tenant_id, 'sales', 'edit') then
    raise exception 'Missing permission: sales.edit';
  end if;
  if not has_branch_access(v_reservation.tenant_id, v_reservation.branch_id) then
    raise exception 'You do not have access to the branch of this reservation';
  end if;
  if not has_capability(v_reservation.tenant_id, 'showroom_reservation') then
    raise exception 'The Showroom Reservation capability is not enabled for this tenant';
  end if;
  if v_reservation.status <> 'active' then
    raise exception 'Reservation is not active (current status: %)', v_reservation.status;
  end if;
  if v_reservation.expires_at < now() then
    raise exception 'This reservation has expired; release it and create a new one';
  end if;
  if p_so_number is null or length(trim(p_so_number)) = 0 then
    raise exception 'so_number is required';
  end if;

  insert into sales_orders (tenant_id, branch_id, customer_id, warehouse_id, so_number, status, order_date)
  values (v_reservation.tenant_id, v_reservation.branch_id, v_reservation.customer_id, v_reservation.warehouse_id, p_so_number, 'confirmed', current_date)
  returning id into v_sales_order_id;

  insert into sales_order_lines (tenant_id, sales_order_id, product_id, quantity, uom_id, unit_price, reserved_quantity, base_quantity)
  select v_reservation.tenant_id, v_sales_order_id, product_id, quantity, uom_id, unit_price, quantity, base_quantity
  from stock_reservation_lines where stock_reservation_id = p_stock_reservation_id;

  update stock_reservations
    set status = 'converted', converted_at = now(), sales_order_id = v_sales_order_id
    where id = p_stock_reservation_id;

  return v_sales_order_id;
end;
$$;

revoke execute on function convert_reservation_to_sales_order(uuid, text) from public, anon;
