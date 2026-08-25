-- Foundation hardening #4 (pre-Block/Slab): the stock-transfer module, per
-- docs/PRE_FACTORY_ARCHITECTURE_AUDIT.md section 3/12 -- a `stock_transfers`
-- table did not exist at all, which blocks any real multi-branch/multi-godown
-- business (central warehouse + shops, factory + warehouse + retail) from
-- safely moving stock between locations. Modeled as Source location -> a
-- distinct in_transit STATE (not a phantom "Transit" location -- matching the
-- audit's own recommendation, since inventory_stock/inventory_batches have no
-- notion of a third physical place, only a status) -> Destination location.
--
-- Both ends of a transfer are pinned to a specific, real storage_location
-- (source_location_id / destination_location_id) rather than "floating"
-- (null-location) stock. This is deliberate: existing floating stock already
-- matches ANY warehouse in confirm_sales_order/dispatch_delivery's OR-null
-- clause, so crediting a transfer's arrival as floating would make it look
-- available everywhere, not just at the destination -- the exact "silently
-- unsafe" outcome the task warns against. Requiring a real location keeps
-- this table entirely self-contained: zero changes to post_goods_receipt,
-- confirm_sales_order, or dispatch_delivery were needed to build this.

create type stock_transfer_status as enum ('draft', 'requested', 'in_transit', 'received', 'cancelled');

create table stock_transfers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  transfer_number text not null,
  source_branch_id uuid not null references branches (id),
  source_warehouse_id uuid not null references warehouses (id),
  destination_branch_id uuid not null references branches (id),
  destination_warehouse_id uuid not null references warehouses (id),
  status stock_transfer_status not null default 'draft',
  requested_at timestamptz,
  shipped_at timestamptz,
  received_at timestamptz,
  cancelled_at timestamptz,
  notes text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, transfer_number),
  check (source_warehouse_id <> destination_warehouse_id)
);

create table stock_transfer_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  stock_transfer_id uuid not null references stock_transfers (id) on delete cascade,
  product_id uuid not null references products (id),
  quantity numeric(18, 4) not null,
  uom_id uuid not null references uom (id),
  base_quantity numeric(18, 4), -- resolved to the product's base UOM at ship time (same pattern as goods_receipt_lines/sales_order_lines)
  source_location_id uuid references storage_locations (id), -- required at ship time for simple-tracked lines; must belong to the transfer's source warehouse
  destination_location_id uuid references storage_locations (id), -- required at receive time; must belong to the destination warehouse
  source_batch_id uuid references inventory_batches (id), -- required at ship time for batch-tracked lines -- the exact batch moved, preserving batch/lot/shade/caliber identity
  destination_batch_id uuid references inventory_batches (id), -- set at receive time: the batch row credited at destination (matched by batch_number, or newly created preserving the same batch/lot/shade/caliber)
  received_quantity numeric(18, 4) not null default 0,
  created_at timestamptz not null default now()
);

create index idx_stock_transfers_tenant_id on stock_transfers (tenant_id);
create index idx_stock_transfers_source_branch_id on stock_transfers (source_branch_id);
create index idx_stock_transfers_destination_branch_id on stock_transfers (destination_branch_id);
create index idx_stock_transfers_source_warehouse_id on stock_transfers (source_warehouse_id);
create index idx_stock_transfers_destination_warehouse_id on stock_transfers (destination_warehouse_id);
create index idx_stock_transfer_lines_stock_transfer_id on stock_transfer_lines (stock_transfer_id);
create index idx_stock_transfer_lines_product_id on stock_transfer_lines (product_id);
create index idx_stock_transfer_lines_source_batch_id on stock_transfer_lines (source_batch_id);

-- ---------------------------------------------------------------------------
-- RLS: reuses the 'warehouse' permission resource (a transfer is a warehouse/
-- inventory operation, not a new business domain) and the branch-scoping
-- helper from 0033. A transfer spans two branches, so select/most actions
-- check EITHER end; insert requires access to the source (the sender doesn't
-- need a role at the destination branch to send stock there -- matching how
-- a real warehouse team operates); ship/receive/cancel enforce the specific
-- relevant side again inside the RPC itself (defense in depth, same as every
-- other Phase 1 integrity function).
-- ---------------------------------------------------------------------------

alter table stock_transfers enable row level security;
create policy stock_transfers_select on stock_transfers for select
  using (is_tenant_member(tenant_id) and (has_branch_access(tenant_id, source_branch_id) or has_branch_access(tenant_id, destination_branch_id)));
create policy stock_transfers_insert on stock_transfers for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'warehouse', 'create') and has_branch_access(tenant_id, source_branch_id));
create policy stock_transfers_update on stock_transfers for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'warehouse', 'edit') and (has_branch_access(tenant_id, source_branch_id) or has_branch_access(tenant_id, destination_branch_id)))
  with check (is_tenant_member(tenant_id));
create policy stock_transfers_delete on stock_transfers for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'warehouse', 'delete') and has_branch_access(tenant_id, source_branch_id));

alter table stock_transfer_lines enable row level security;
create policy stock_transfer_lines_select on stock_transfer_lines for select
  using (exists (select 1 from stock_transfers st where st.id = stock_transfer_lines.stock_transfer_id and is_tenant_member(st.tenant_id) and (has_branch_access(st.tenant_id, st.source_branch_id) or has_branch_access(st.tenant_id, st.destination_branch_id))));
create policy stock_transfer_lines_insert on stock_transfer_lines for insert
  with check (exists (select 1 from stock_transfers st where st.id = stock_transfer_lines.stock_transfer_id and is_tenant_member(st.tenant_id) and has_permission(st.tenant_id, 'warehouse', 'create') and has_branch_access(st.tenant_id, st.source_branch_id)));
create policy stock_transfer_lines_update on stock_transfer_lines for update
  using (exists (select 1 from stock_transfers st where st.id = stock_transfer_lines.stock_transfer_id and is_tenant_member(st.tenant_id) and has_permission(st.tenant_id, 'warehouse', 'edit') and (has_branch_access(st.tenant_id, st.source_branch_id) or has_branch_access(st.tenant_id, st.destination_branch_id))))
  with check (exists (select 1 from stock_transfers st where st.id = stock_transfer_lines.stock_transfer_id and is_tenant_member(st.tenant_id) and (has_branch_access(st.tenant_id, st.source_branch_id) or has_branch_access(st.tenant_id, st.destination_branch_id))));
create policy stock_transfer_lines_delete on stock_transfer_lines for delete
  using (exists (select 1 from stock_transfers st where st.id = stock_transfer_lines.stock_transfer_id and is_tenant_member(st.tenant_id) and has_permission(st.tenant_id, 'warehouse', 'delete') and has_branch_access(st.tenant_id, st.source_branch_id)));

create trigger stock_transfers_audit
  after insert or update or delete on stock_transfers
  for each row execute function audit_trigger_fn();
create trigger stock_transfer_lines_audit
  after insert or update or delete on stock_transfer_lines
  for each row execute function audit_trigger_fn();

-- ---------------------------------------------------------------------------
-- ship_stock_transfer: validates + decrements source inventory in one atomic
-- transaction (never a partial decrement on failure, matching every other
-- Phase 1 integrity function). Locks the transfer header row itself
-- (for update) as the very first statement so a concurrent duplicate call
-- serializes behind it and is rejected by the status check once it proceeds
-- -- the "duplicate request must not create duplicate inventory movement" and
-- "concurrent transfer must not create negative stock" guarantees.
-- ---------------------------------------------------------------------------
create function ship_stock_transfer(p_stock_transfer_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_transfer stock_transfers%rowtype;
  v_line record;
  v_tracking_mode inventory_tracking_mode;
  v_base_uom_id uuid;
  v_base_qty numeric(18, 4);
  v_source_batch record;
  v_source_stock record;
begin
  select * into v_transfer from stock_transfers where id = p_stock_transfer_id for update;
  if not found then
    raise exception 'Stock transfer not found';
  end if;
  if not has_permission(v_transfer.tenant_id, 'warehouse', 'edit') then
    raise exception 'Missing permission: warehouse.edit';
  end if;
  if not has_branch_access(v_transfer.tenant_id, v_transfer.source_branch_id) then
    raise exception 'You do not have access to the source branch of this transfer';
  end if;
  if v_transfer.status not in ('draft', 'requested') then
    raise exception 'Stock transfer is not in a shippable status';
  end if;

  for v_line in select * from stock_transfer_lines where stock_transfer_id = p_stock_transfer_id loop
    select inventory_tracking_mode, base_uom_id into v_tracking_mode, v_base_uom_id from products where id = v_line.product_id;

    if v_tracking_mode = 'unit' then
      raise exception 'Unit-tracked products (blocks/slabs) are transferred via the Factory module, not yet available in Phase 1';
    end if;

    v_base_qty := convert_uom_quantity(v_transfer.tenant_id, v_line.product_id, v_line.uom_id, v_base_uom_id, v_line.quantity);
    update stock_transfer_lines set base_quantity = v_base_qty where id = v_line.id;

    if v_tracking_mode = 'batch' then
      if v_line.source_batch_id is null then
        raise exception 'A source batch must be specified to transfer a batch-tracked product (preserves batch/lot/shade/caliber identity)';
      end if;

      select ib.* into v_source_batch
        from inventory_batches ib
        join storage_locations sl on sl.id = ib.current_location_id
        where ib.id = v_line.source_batch_id and ib.tenant_id = v_transfer.tenant_id and ib.product_id = v_line.product_id
          and sl.warehouse_id = v_transfer.source_warehouse_id
        for update;
      if not found then
        raise exception 'Source batch not found in the source warehouse for product %', v_line.product_id;
      end if;
      if v_source_batch.qty_on_hand - v_source_batch.reserved_qty < v_base_qty then
        raise exception 'Insufficient available quantity in source batch for product %: requested %, available %',
          v_line.product_id, v_base_qty, v_source_batch.qty_on_hand - v_source_batch.reserved_qty;
      end if;

      update inventory_batches set qty_on_hand = qty_on_hand - v_base_qty where id = v_source_batch.id;
    else
      if v_line.source_location_id is null then
        raise exception 'A source location must be specified to transfer product % (unassigned/floating stock cannot be transferred)', v_line.product_id;
      end if;

      select ist.* into v_source_stock
        from inventory_stock ist
        join storage_locations sl on sl.id = ist.location_id
        where ist.tenant_id = v_transfer.tenant_id and ist.product_id = v_line.product_id
          and ist.location_id = v_line.source_location_id and sl.warehouse_id = v_transfer.source_warehouse_id
        for update;
      if not found or (v_source_stock.qty_on_hand - v_source_stock.reserved_qty) < v_base_qty then
        raise exception 'Insufficient available stock at the source location for product %: requested %, available %',
          v_line.product_id, v_base_qty, coalesce(v_source_stock.qty_on_hand - v_source_stock.reserved_qty, 0);
      end if;

      update inventory_stock set qty_on_hand = qty_on_hand - v_base_qty, updated_at = now() where id = v_source_stock.id;
    end if;
  end loop;

  update stock_transfers set status = 'in_transit', shipped_at = now(), updated_at = now() where id = p_stock_transfer_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- receive_stock_transfer: credits destination inventory. Supports partial
-- receipt via p_line_quantities (a jsonb map of line id -> quantity to
-- receive now, in the line's base UOM; omitted lines receive their full
-- outstanding shipped quantity). Only the quantity actually received becomes
-- available at the destination -- a short receipt is recorded as-is on the
-- line (received_quantity < base_quantity) rather than silently completed.
-- ---------------------------------------------------------------------------
create function receive_stock_transfer(p_stock_transfer_id uuid, p_line_quantities jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_transfer stock_transfers%rowtype;
  v_line record;
  v_tracking_mode inventory_tracking_mode;
  v_receipt_qty numeric(18, 4);
  v_outstanding numeric(18, 4);
  v_dest_batch record;
  v_new_dest_batch_id uuid;
  v_existing_stock record;
begin
  select * into v_transfer from stock_transfers where id = p_stock_transfer_id for update;
  if not found then
    raise exception 'Stock transfer not found';
  end if;
  if not has_permission(v_transfer.tenant_id, 'warehouse', 'edit') then
    raise exception 'Missing permission: warehouse.edit';
  end if;
  if not has_branch_access(v_transfer.tenant_id, v_transfer.destination_branch_id) then
    raise exception 'You do not have access to the destination branch of this transfer';
  end if;
  if v_transfer.status <> 'in_transit' then
    raise exception 'Stock transfer is not in transit';
  end if;

  for v_line in select * from stock_transfer_lines where stock_transfer_id = p_stock_transfer_id loop
    select inventory_tracking_mode into v_tracking_mode from products where id = v_line.product_id;

    v_outstanding := v_line.base_quantity - v_line.received_quantity;
    v_receipt_qty := coalesce((p_line_quantities ->> v_line.id::text)::numeric, v_outstanding);

    if v_receipt_qty <= 0 then
      continue;
    end if;
    if v_receipt_qty > v_outstanding then
      raise exception 'Cannot receive more than the outstanding shipped quantity for line % (outstanding %)', v_line.id, v_outstanding;
    end if;
    if v_line.destination_location_id is null then
      raise exception 'A destination location must be specified before receiving product %', v_line.product_id;
    end if;

    if not exists (select 1 from storage_locations sl where sl.id = v_line.destination_location_id and sl.warehouse_id = v_transfer.destination_warehouse_id) then
      raise exception 'Destination location for product % does not belong to the transfer''s destination warehouse', v_line.product_id;
    end if;

    if v_tracking_mode = 'batch' then
      select * into v_dest_batch
        from inventory_batches
        where tenant_id = v_transfer.tenant_id and product_id = v_line.product_id
          and current_location_id = v_line.destination_location_id
          and batch_number = (select batch_number from inventory_batches where id = v_line.source_batch_id)
        for update;

      if found then
        update inventory_batches set qty_on_hand = qty_on_hand + v_receipt_qty where id = v_dest_batch.id;
        v_new_dest_batch_id := v_dest_batch.id;
      else
        insert into inventory_batches (tenant_id, product_id, batch_number, lot_number, shade_code, caliber_code, qty_on_hand, uom_id, cost_per_uom, current_location_id)
        select tenant_id, product_id, batch_number, lot_number, shade_code, caliber_code, v_receipt_qty, uom_id, cost_per_uom, v_line.destination_location_id
        from inventory_batches where id = v_line.source_batch_id
        returning id into v_new_dest_batch_id;
      end if;

      update stock_transfer_lines set destination_batch_id = v_new_dest_batch_id where id = v_line.id;
    else
      select * into v_existing_stock from inventory_stock
        where tenant_id = v_transfer.tenant_id and product_id = v_line.product_id and location_id = v_line.destination_location_id
        for update;

      if found then
        update inventory_stock set qty_on_hand = qty_on_hand + v_receipt_qty, updated_at = now() where id = v_existing_stock.id;
      else
        insert into inventory_stock (tenant_id, product_id, location_id, qty_on_hand, avg_cost, uom_id)
        select v_transfer.tenant_id, v_line.product_id, v_line.destination_location_id, v_receipt_qty, coalesce(src.avg_cost, 0), src.uom_id
        from inventory_stock src
        where src.tenant_id = v_transfer.tenant_id and src.product_id = v_line.product_id and src.location_id = v_line.source_location_id;
      end if;
    end if;

    update stock_transfer_lines set received_quantity = received_quantity + v_receipt_qty where id = v_line.id;
  end loop;

  update stock_transfers set status = 'received', received_at = now(), updated_at = now() where id = p_stock_transfer_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- cancel_stock_transfer: from draft/requested there is nothing to undo. From
-- in_transit, restores exactly what ship_stock_transfer decremented, into the
-- same source location/batch it came from -- never a fabricated new home for
-- the stock. Not permitted once received (that is a completed movement; a
-- reversal of a received transfer is a distinct workflow, out of scope here).
-- ---------------------------------------------------------------------------
create function cancel_stock_transfer(p_stock_transfer_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_transfer stock_transfers%rowtype;
  v_line record;
  v_tracking_mode inventory_tracking_mode;
begin
  select * into v_transfer from stock_transfers where id = p_stock_transfer_id for update;
  if not found then
    raise exception 'Stock transfer not found';
  end if;
  if not has_permission(v_transfer.tenant_id, 'warehouse', 'edit') then
    raise exception 'Missing permission: warehouse.edit';
  end if;
  if not has_branch_access(v_transfer.tenant_id, v_transfer.source_branch_id) then
    raise exception 'You do not have access to the source branch of this transfer';
  end if;
  if v_transfer.status = 'received' then
    raise exception 'A received transfer cannot be cancelled';
  end if;
  if v_transfer.status = 'cancelled' then
    raise exception 'Stock transfer is already cancelled';
  end if;

  if v_transfer.status = 'in_transit' then
    for v_line in select * from stock_transfer_lines where stock_transfer_id = p_stock_transfer_id loop
      select inventory_tracking_mode into v_tracking_mode from products where id = v_line.product_id;

      if v_tracking_mode = 'batch' then
        update inventory_batches set qty_on_hand = qty_on_hand + v_line.base_quantity where id = v_line.source_batch_id;
      else
        update inventory_stock set qty_on_hand = qty_on_hand + v_line.base_quantity, updated_at = now()
          where tenant_id = v_transfer.tenant_id and product_id = v_line.product_id and location_id = v_line.source_location_id;
      end if;
    end loop;
  end if;

  update stock_transfers set status = 'cancelled', cancelled_at = now(), updated_at = now() where id = p_stock_transfer_id;
end;
$$;

revoke execute on function ship_stock_transfer(uuid) from public, anon;
revoke execute on function receive_stock_transfer(uuid, jsonb) from public, anon;
revoke execute on function cancel_stock_transfer(uuid) from public, anon;
