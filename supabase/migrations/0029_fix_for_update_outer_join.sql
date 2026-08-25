-- Bug fix caught by live integration testing: Postgres rejects "FOR UPDATE"
-- on the nullable side of an outer join ("FOR UPDATE cannot be applied to the
-- nullable side of an outer join"). confirm_sales_order() and
-- dispatch_delivery()'s simple-tracking-mode loops both LEFT JOIN
-- storage_locations (to allow location_id IS NULL stock), so the implicit
-- "FOR UPDATE" locking every table in the FROM clause failed outright — this
-- broke reservation/dispatch for every simple-tracked product, the default and
-- most common tracking mode. Fix: lock only inventory_stock explicitly.

create or replace function confirm_sales_order(p_sales_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_order sales_orders%rowtype;
  v_line record;
  v_tracking_mode inventory_tracking_mode;
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

  for v_line in select * from sales_order_lines where sales_order_id = p_sales_order_id loop
    select inventory_tracking_mode into v_tracking_mode from products where id = v_line.product_id;

    if v_tracking_mode = 'unit' then
      raise exception 'Unit-tracked products (blocks/slabs) are not yet reservable in Phase 1';
    elsif v_tracking_mode = 'batch' then
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

    if v_available < v_line.quantity then
      raise exception 'Insufficient available stock for product %: requested %, available %',
        v_line.product_id, v_line.quantity, v_available;
    end if;
  end loop;

  for v_line in select * from sales_order_lines where sales_order_id = p_sales_order_id loop
    select inventory_tracking_mode into v_tracking_mode from products where id = v_line.product_id;
    v_remaining := v_line.quantity;

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

    update sales_order_lines set reserved_quantity = v_line.quantity where id = v_line.id;
  end loop;

  update sales_orders set status = 'confirmed', updated_at = now() where id = p_sales_order_id;
end;
$$;

create or replace function dispatch_delivery(p_delivery_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_delivery deliveries%rowtype;
  v_line record;
  v_tracking_mode inventory_tracking_mode;
  v_remaining numeric(18, 4);
  v_take numeric(18, 4);
  v_batch record;
  v_stock record;
  v_total_cost numeric(18, 4);
  v_total_qty numeric(18, 4);
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
    select inventory_tracking_mode into v_tracking_mode from products where id = v_line.product_id;
    v_remaining := v_line.quantity;
    v_total_cost := 0;
    v_total_qty := 0;

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
        v_total_qty := v_total_qty + v_take;
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
        v_total_qty := v_total_qty + v_take;
        v_remaining := v_remaining - v_take;
      end loop;
    end if;

    if v_remaining > 0 then
      raise exception 'Not enough reserved stock to dispatch product %: short by %', v_line.product_id, v_remaining;
    end if;

    v_weighted_cost := case when v_total_qty > 0 then v_total_cost / v_total_qty else 0 end;
    update delivery_lines set unit_cost = v_weighted_cost where id = v_line.id;

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
