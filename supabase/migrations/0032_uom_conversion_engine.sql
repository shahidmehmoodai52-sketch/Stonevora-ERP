-- Foundation hardening #1 (pre-Block/Slab): close the UOM-conversion gap
-- identified in docs/PRE_FACTORY_ARCHITECTURE_AUDIT.md section 6/7 -- none of
-- the four Phase 1 integrity functions converted a line's UOM before touching
-- qty_on_hand/reserved_qty, and the UI lets a PO/SO line use any UOM, not just
-- the product's base UOM. This was a live, reachable defect (not just a
-- factory prerequisite): receiving or selling in a non-base UOM silently
-- corrupted stock quantities.
--
-- The engine itself (uom/uom_conversions: global, tenant, and product-specific
-- factors) is NOT redesigned here -- it was already sound, per the audit. This
-- migration only adds the missing application of it.

-- convert_uom_quantity: resolves the conversion factor for a specific product
-- (a product-specific row wins), falling back to a tenant-custom rate, then
-- the global rate -- matching the precedence already implied by
-- uom_conversions' nullable product_id/tenant_id columns. Raises rather than
-- guessing when the units differ and no rate is configured; identity
-- (from = to) always short-circuits to the input quantity unchanged.
-- Deliberately NOT security definer: it only reads uom_conversions, which
-- RLS already exposes to any tenant member for their own tenant's + global
-- rows, and it runs under the caller's already-elevated context when invoked
-- from inside a SECURITY DEFINER function such as post_goods_receipt.
create function convert_uom_quantity(
  p_tenant_id uuid,
  p_product_id uuid,
  p_from_uom_id uuid,
  p_to_uom_id uuid,
  p_quantity numeric
) returns numeric
language plpgsql stable set search_path = public as $$
declare
  v_factor numeric(18, 6);
begin
  if p_from_uom_id = p_to_uom_id then
    return p_quantity;
  end if;

  select conversion_factor into v_factor
  from uom_conversions
  where from_uom_id = p_from_uom_id and to_uom_id = p_to_uom_id
    and (product_id = p_product_id or product_id is null)
    and (tenant_id = p_tenant_id or tenant_id is null)
  order by (product_id is null) asc, (tenant_id is null) asc
  limit 1;

  if v_factor is null then
    raise exception 'No UOM conversion defined from % to % for product % (tenant %)',
      p_from_uom_id, p_to_uom_id, p_product_id, p_tenant_id;
  end if;

  return p_quantity * v_factor;
end;
$$;

-- Each line keeps its entered quantity/uom_id (display, printing, invoicing)
-- and gains the converted base-UOM quantity actually applied to stock --
-- "never lose the original, always compute from a normalized value",
-- matching the existing goods_receipt_lines.total_unit_cost precedent.
alter table goods_receipt_lines add column base_quantity numeric(18, 4);
alter table sales_order_lines add column base_quantity numeric(18, 4);
alter table delivery_lines add column base_quantity numeric(18, 4);

-- ---------------------------------------------------------------------------
-- post_goods_receipt: now converts the received quantity into the product's
-- base UOM before it ever reaches inventory_stock/inventory_batches, so those
-- tables' qty_on_hand is always base-UOM-denominated regardless of what UOM a
-- given GRN line was entered in. Also converts into the originating PO line's
-- own UOM (which may differ from the GRN line's) before incrementing
-- received_quantity, so partial-receipt tracking stays correct too.
-- ---------------------------------------------------------------------------
create or replace function post_goods_receipt(p_goods_receipt_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_receipt goods_receipts%rowtype;
  v_total_extra numeric(18, 4);
  v_total_basis numeric(18, 4);
  v_line record;
  v_share numeric(18, 4);
  v_allocated numeric(18, 4);
  v_total_unit_cost numeric(18, 4);
  v_tracking_mode inventory_tracking_mode;
  v_base_uom_id uuid;
  v_base_qty numeric(18, 4);
  v_base_unit_cost numeric(18, 4);
  v_po_line_uom_id uuid;
  v_po_received_qty numeric(18, 4);
  v_existing_stock record;
  v_new_qty numeric(18, 4);
  v_new_avg numeric(18, 4);
  v_po_fully_received boolean;
begin
  select * into v_receipt from goods_receipts where id = p_goods_receipt_id;
  if not found then
    raise exception 'Goods receipt not found';
  end if;
  if not has_permission(v_receipt.tenant_id, 'purchasing', 'edit') then
    raise exception 'Missing permission: purchasing.edit';
  end if;
  if v_receipt.status <> 'draft' then
    raise exception 'Goods receipt is not in draft status';
  end if;

  v_total_extra := v_receipt.freight_cost + v_receipt.duty_cost + v_receipt.handling_cost + v_receipt.other_cost;

  if v_receipt.landed_cost_basis = 'value' then
    select coalesce(sum(quantity * unit_cost), 0) into v_total_basis
    from goods_receipt_lines where goods_receipt_id = p_goods_receipt_id;
  else
    select coalesce(sum(quantity), 0) into v_total_basis
    from goods_receipt_lines where goods_receipt_id = p_goods_receipt_id;
  end if;

  for v_line in select * from goods_receipt_lines where goods_receipt_id = p_goods_receipt_id loop
    if v_total_basis > 0 then
      if v_receipt.landed_cost_basis = 'value' then
        v_share := (v_line.quantity * v_line.unit_cost) / v_total_basis;
      else
        v_share := v_line.quantity / v_total_basis;
      end if;
    else
      v_share := 0;
    end if;

    v_allocated := v_total_extra * v_share;
    v_total_unit_cost := (v_line.quantity * v_line.unit_cost + v_allocated) / nullif(v_line.quantity, 0);

    update goods_receipt_lines
      set allocated_landed_cost = v_allocated, total_unit_cost = v_total_unit_cost
      where id = v_line.id;

    select inventory_tracking_mode, base_uom_id into v_tracking_mode, v_base_uom_id
      from products where id = v_line.product_id;

    v_base_qty := convert_uom_quantity(v_receipt.tenant_id, v_line.product_id, v_line.uom_id, v_base_uom_id, v_line.quantity);
    v_base_unit_cost := (v_line.quantity * v_total_unit_cost) / nullif(v_base_qty, 0);

    update goods_receipt_lines set base_quantity = v_base_qty where id = v_line.id;

    if v_tracking_mode = 'unit' then
      raise exception 'Unit-tracked products (blocks/slabs) are received via the Factory module, not yet available in Phase 1';
    elsif v_tracking_mode = 'batch' then
      if v_line.batch_number is null then
        raise exception 'A batch number is required to receive a batch-tracked product';
      end if;
      insert into inventory_batches (
        tenant_id, product_id, batch_number, lot_number, shade_code, caliber_code,
        qty_on_hand, uom_id, cost_per_uom, current_location_id
      ) values (
        v_receipt.tenant_id, v_line.product_id, v_line.batch_number, v_line.lot_number,
        v_line.shade_code, v_line.caliber_code, v_base_qty, v_base_uom_id,
        v_base_unit_cost, v_line.location_id
      );
    else
      select * into v_existing_stock from inventory_stock
        where tenant_id = v_receipt.tenant_id and product_id = v_line.product_id
          and location_id is not distinct from v_line.location_id
        for update;

      if found then
        v_new_qty := v_existing_stock.qty_on_hand + v_base_qty;
        v_new_avg := (v_existing_stock.qty_on_hand * v_existing_stock.avg_cost + v_base_qty * v_base_unit_cost)
          / nullif(v_new_qty, 0);
        update inventory_stock
          set qty_on_hand = v_new_qty, avg_cost = coalesce(v_new_avg, v_base_unit_cost), updated_at = now()
          where id = v_existing_stock.id;
      else
        insert into inventory_stock (tenant_id, product_id, location_id, qty_on_hand, avg_cost, uom_id)
        values (v_receipt.tenant_id, v_line.product_id, v_line.location_id, v_base_qty, v_base_unit_cost, v_base_uom_id);
      end if;
    end if;

    select uom_id into v_po_line_uom_id from purchase_order_lines where id = v_line.purchase_order_line_id;
    v_po_received_qty := convert_uom_quantity(v_receipt.tenant_id, v_line.product_id, v_line.uom_id, v_po_line_uom_id, v_line.quantity);

    update purchase_order_lines
      set received_quantity = received_quantity + v_po_received_qty
      where id = v_line.purchase_order_line_id;
  end loop;

  select bool_and(received_quantity >= quantity) into v_po_fully_received
    from purchase_order_lines where purchase_order_id = v_receipt.purchase_order_id;

  update purchase_orders
    set status = case when v_po_fully_received then 'received'::purchase_order_status else 'partially_received'::purchase_order_status end,
        updated_at = now()
    where id = v_receipt.purchase_order_id;

  update goods_receipts set status = 'posted' where id = p_goods_receipt_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- confirm_sales_order: validates and reserves against base-UOM quantities
-- (matching inventory_stock/inventory_batches' base-UOM qty_on_hand from the
-- fix above), while sales_order_lines.reserved_quantity keeps tracking the
-- line's own entered UOM (unchanged, for display) and a new base_quantity
-- column records what was actually reserved in base-UOM terms.
-- ---------------------------------------------------------------------------
create or replace function confirm_sales_order(p_sales_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_order sales_orders%rowtype;
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
  select * into v_order from sales_orders where id = p_sales_order_id;
  if not found then
    raise exception 'Sales order not found';
  end if;
  if not has_permission(v_order.tenant_id, 'sales', 'edit') then
    raise exception 'Missing permission: sales.edit';
  end if;
  if v_order.status <> 'draft' then
    raise exception 'Sales order is not in draft status';
  end if;
  if v_order.warehouse_id is null then
    raise exception 'A fulfilling warehouse must be set before confirming';
  end if;

  -- Pass 1: validate every line before reserving anything.
  for v_line in select * from sales_order_lines where sales_order_id = p_sales_order_id loop
    select inventory_tracking_mode, base_uom_id into v_tracking_mode, v_base_uom_id from products where id = v_line.product_id;

    if v_tracking_mode = 'unit' then
      raise exception 'Unit-tracked products (blocks/slabs) are not yet reservable in Phase 1';
    end if;

    v_base_qty := convert_uom_quantity(v_order.tenant_id, v_line.product_id, v_line.uom_id, v_base_uom_id, v_line.quantity);

    if v_tracking_mode = 'batch' then
      select coalesce(sum(ib.qty_on_hand - ib.reserved_qty), 0) into v_available
      from inventory_batches ib
      join storage_locations sl on sl.id = ib.current_location_id
      where ib.tenant_id = v_order.tenant_id and ib.product_id = v_line.product_id
        and sl.warehouse_id = v_order.warehouse_id;
    else
      select coalesce(sum(ist.qty_on_hand - ist.reserved_qty), 0) into v_available
      from inventory_stock ist
      left join storage_locations sl on sl.id = ist.location_id
      where ist.tenant_id = v_order.tenant_id and ist.product_id = v_line.product_id
        and (sl.warehouse_id = v_order.warehouse_id or ist.location_id is null);
    end if;

    if v_available < v_base_qty then
      raise exception 'Insufficient available stock for product %: requested % (base units), available %',
        v_line.product_id, v_base_qty, v_available;
    end if;
  end loop;

  -- Pass 2: every line already validated -- reserve for real.
  for v_line in select * from sales_order_lines where sales_order_id = p_sales_order_id loop
    select inventory_tracking_mode, base_uom_id into v_tracking_mode, v_base_uom_id from products where id = v_line.product_id;
    v_base_qty := convert_uom_quantity(v_order.tenant_id, v_line.product_id, v_line.uom_id, v_base_uom_id, v_line.quantity);
    v_remaining := v_base_qty;

    if v_tracking_mode = 'batch' then
      for v_batch in
        select ib.id, ib.qty_on_hand, ib.reserved_qty from inventory_batches ib
        join storage_locations sl on sl.id = ib.current_location_id
        where ib.tenant_id = v_order.tenant_id and ib.product_id = v_line.product_id
          and sl.warehouse_id = v_order.warehouse_id
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
        where ist.tenant_id = v_order.tenant_id and ist.product_id = v_line.product_id
          and (sl.warehouse_id = v_order.warehouse_id or ist.location_id is null)
          and (ist.qty_on_hand - ist.reserved_qty) > 0
        order by ist.updated_at
        for update of ist
      loop
        exit when v_remaining <= 0;
        v_take := least(v_remaining, v_stock.qty_on_hand - v_stock.reserved_qty);
        update inventory_stock set reserved_qty = reserved_qty + v_take where id = v_stock.id;
        v_remaining := v_remaining - v_take;
      end loop;
    end if;

    update sales_order_lines set reserved_quantity = v_line.quantity, base_quantity = v_base_qty where id = v_line.id;
  end loop;

  update sales_orders set status = 'confirmed', updated_at = now() where id = p_sales_order_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- dispatch_delivery: decrements stock in base-UOM terms (matching the
-- reservation made in base units above); the COGS snapshot on delivery_lines
-- stays denominated per the line's own entered UOM (total currency cost /
-- entered quantity) so it remains directly comparable to sales_order_lines'
-- per-entered-UOM unit_price, unchanged from before.
-- ---------------------------------------------------------------------------
create or replace function dispatch_delivery(p_delivery_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_delivery deliveries%rowtype;
  v_line record;
  v_sol_uom_id uuid;
  v_tracking_mode inventory_tracking_mode;
  v_base_uom_id uuid;
  v_base_qty numeric(18, 4);
  v_remaining numeric(18, 4);
  v_take numeric(18, 4);
  v_batch record;
  v_stock record;
  v_total_cost numeric(18, 4);
  v_weighted_cost numeric(18, 4);
begin
  select * into v_delivery from deliveries where id = p_delivery_id;
  if not found then
    raise exception 'Delivery not found';
  end if;
  if not has_permission(v_delivery.tenant_id, 'sales', 'edit') then
    raise exception 'Missing permission: sales.edit';
  end if;
  if v_delivery.status <> 'draft' then
    raise exception 'Delivery is not in draft status';
  end if;

  for v_line in select * from delivery_lines where delivery_id = p_delivery_id loop
    select inventory_tracking_mode, base_uom_id into v_tracking_mode, v_base_uom_id from products where id = v_line.product_id;
    select uom_id into v_sol_uom_id from sales_order_lines where id = v_line.sales_order_line_id;

    v_base_qty := convert_uom_quantity(v_delivery.tenant_id, v_line.product_id, v_sol_uom_id, v_base_uom_id, v_line.quantity);
    v_remaining := v_base_qty;
    v_total_cost := 0;

    if v_tracking_mode = 'batch' then
      for v_batch in
        select ib.id, ib.qty_on_hand, ib.reserved_qty, ib.cost_per_uom from inventory_batches ib
        join storage_locations sl on sl.id = ib.current_location_id
        where ib.tenant_id = v_delivery.tenant_id and ib.product_id = v_line.product_id
          and sl.warehouse_id = v_delivery.warehouse_id
          and ib.reserved_qty > 0
        order by ib.created_at
        for update
      loop
        exit when v_remaining <= 0;
        v_take := least(v_remaining, v_batch.reserved_qty, v_batch.qty_on_hand);
        update inventory_batches
          set qty_on_hand = qty_on_hand - v_take, reserved_qty = reserved_qty - v_take
          where id = v_batch.id;
        v_total_cost := v_total_cost + v_take * v_batch.cost_per_uom;
        v_remaining := v_remaining - v_take;
      end loop;
    else
      for v_stock in
        select ist.id, ist.qty_on_hand, ist.reserved_qty, ist.avg_cost from inventory_stock ist
        left join storage_locations sl on sl.id = ist.location_id
        where ist.tenant_id = v_delivery.tenant_id and ist.product_id = v_line.product_id
          and (sl.warehouse_id = v_delivery.warehouse_id or ist.location_id is null)
          and ist.reserved_qty > 0
        order by ist.updated_at
        for update of ist
      loop
        exit when v_remaining <= 0;
        v_take := least(v_remaining, v_stock.reserved_qty, v_stock.qty_on_hand);
        update inventory_stock
          set qty_on_hand = qty_on_hand - v_take, reserved_qty = reserved_qty - v_take, updated_at = now()
          where id = v_stock.id;
        v_total_cost := v_total_cost + v_take * v_stock.avg_cost;
        v_remaining := v_remaining - v_take;
      end loop;
    end if;

    if v_remaining > 0 then
      raise exception 'Not enough reserved stock to dispatch product %: short by % (base units)', v_line.product_id, v_remaining;
    end if;

    v_weighted_cost := case when v_line.quantity > 0 then v_total_cost / v_line.quantity else 0 end;
    update delivery_lines set unit_cost = v_weighted_cost, base_quantity = v_base_qty where id = v_line.id;

    update sales_order_lines
      set delivered_quantity = delivered_quantity + v_line.quantity
      where id = v_line.sales_order_line_id;
  end loop;

  update deliveries set status = 'dispatched' where id = p_delivery_id;

  update sales_orders so
    set status = case
        when (select bool_and(sol.delivered_quantity >= sol.quantity) from sales_order_lines sol where sol.sales_order_id = so.id)
          then 'delivered'::sales_order_status
        else 'partially_delivered'::sales_order_status
      end,
      updated_at = now()
  where so.id = v_delivery.sales_order_id;
end;
$$;
