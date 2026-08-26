-- Security fix, found while researching Phase 3 (needed the same branch
-- check for its own new invoicing RPC and went looking for the existing
-- precedent to match -- found it missing instead). Migration 0033
-- (Foundation Hardening: Branch-level RLS) added has_branch_access() checks
-- to every purchasing/sales TABLE's RLS policies, but never propagated the
-- same check into the body of the four SECURITY DEFINER integrity functions
-- that actually perform the state-changing writes on those tables:
-- post_goods_receipt, confirm_sales_order, dispatch_delivery, and
-- generate_sales_invoice_from_delivery. Exactly the same bug class Milestone
-- 2 of the Factory work found and fixed for start_processing_job/
-- cancel_processing_job (0040): a SECURITY DEFINER function's own body
-- bypasses RLS entirely on the tables it touches, so relying on the table
-- policy is not sufficient -- the function itself must re-check branch
-- access explicitly.
--
-- Live-reproduced before this fix: a user scoped only to Branch B correctly
-- could not see a Branch A goods receipt via a plain select (RLS working for
-- reads), but calling post_goods_receipt(<branch-A-receipt-id>) directly
-- succeeded outright and fully posted it (status -> 'posted', stock
-- created) -- proving the four functions had no branch-level authorization
-- of their own. Each fix below is byte-for-byte identical to its current
-- body except for the inserted has_branch_access check.

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
  v_len_cm numeric(18, 6);
  v_wid_cm numeric(18, 6);
  v_hgt_cm numeric(18, 6);
  v_volume_cm3 numeric(24, 6);
  v_volume_uom_code text;
  v_volume numeric(14, 6);
  v_supplier_id uuid;
begin
  select * into v_receipt from goods_receipts where id = p_goods_receipt_id;
  if not found then
    raise exception 'Goods receipt not found';
  end if;
  if not has_permission(v_receipt.tenant_id, 'purchasing', 'edit') then
    raise exception 'Missing permission: purchasing.edit';
  end if;
  if not has_branch_access(v_receipt.tenant_id, v_receipt.branch_id) then
    raise exception 'You do not have access to the branch of this goods receipt';
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

    if v_tracking_mode = 'unit' then
      if not has_capability(v_receipt.tenant_id, 'block_slab_factory') then
        raise exception 'The Block/Slab Factory capability is not enabled for this tenant';
      end if;
      if v_line.quantity <> 1 then
        raise exception 'A unit-tracked (block) GRN line must have quantity = 1 -- each block is a distinct physical object with its own dimensions and cost; use one GRN line per block';
      end if;
      if v_line.unit_code is null or v_line.dimension_length is null or v_line.dimension_width is null
          or v_line.dimension_height is null or v_line.dimension_uom_id is null or v_line.volume_uom_id is null then
        raise exception 'Block intake requires unit_code, dimension_length/width/height, dimension_uom_id and volume_uom_id';
      end if;

      v_len_cm := convert_uom_quantity(v_receipt.tenant_id, null, v_line.dimension_uom_id, (select id from uom where code = 'CM' and tenant_id is null), v_line.dimension_length);
      v_wid_cm := convert_uom_quantity(v_receipt.tenant_id, null, v_line.dimension_uom_id, (select id from uom where code = 'CM' and tenant_id is null), v_line.dimension_width);
      v_hgt_cm := convert_uom_quantity(v_receipt.tenant_id, null, v_line.dimension_uom_id, (select id from uom where code = 'CM' and tenant_id is null), v_line.dimension_height);
      v_volume_cm3 := v_len_cm * v_wid_cm * v_hgt_cm;

      select code into v_volume_uom_code from uom where id = v_line.volume_uom_id;
      if v_volume_uom_code = 'M3' then
        -- 1 m3 = 1,000,000 cm3 exactly -- a physical constant, not a business rule.
        v_volume := v_volume_cm3 / 1000000;
      elsif v_volume_uom_code = 'CFT' then
        -- 1 cubic foot = 28316.846592 cm3 exactly.
        v_volume := v_volume_cm3 / 28316.846592;
      else
        raise exception 'Block volume can only be recorded in M3 or CFT (got %)', v_volume_uom_code;
      end if;

      select supplier_id into v_supplier_id from purchase_orders where id = v_receipt.purchase_order_id;

      insert into inventory_units (
        tenant_id, product_id, unit_code, unit_type, status, current_location_id,
        actual_length, actual_width, actual_thickness, dimension_uom_id,
        volume, volume_uom_id, weight, weight_uom_id, quality_grade,
        cost, supplier_id, goods_receipt_line_id, quarry_source
      ) values (
        v_receipt.tenant_id, v_line.product_id, v_line.unit_code, 'block', 'in_stock', v_line.location_id,
        v_line.dimension_length, v_line.dimension_width, v_line.dimension_height, v_line.dimension_uom_id,
        v_volume, v_line.volume_uom_id, v_line.unit_weight, v_line.unit_weight_uom_id, v_line.unit_quality_grade,
        v_total_unit_cost, v_supplier_id, v_line.id, v_line.quarry_source
      );
    elsif v_tracking_mode = 'batch' then
      if v_line.batch_number is null then
        raise exception 'A batch number is required to receive a batch-tracked product';
      end if;

      v_base_qty := convert_uom_quantity(v_receipt.tenant_id, v_line.product_id, v_line.uom_id, v_base_uom_id, v_line.quantity);
      v_base_unit_cost := (v_line.quantity * v_total_unit_cost) / nullif(v_base_qty, 0);

      insert into inventory_batches (
        tenant_id, product_id, batch_number, lot_number, shade_code, caliber_code,
        qty_on_hand, uom_id, cost_per_uom, current_location_id
      ) values (
        v_receipt.tenant_id, v_line.product_id, v_line.batch_number, v_line.lot_number,
        v_line.shade_code, v_line.caliber_code, v_base_qty, v_base_uom_id,
        v_base_unit_cost, v_line.location_id
      );

      update goods_receipt_lines set base_quantity = v_base_qty where id = v_line.id;
    else
      v_base_qty := convert_uom_quantity(v_receipt.tenant_id, v_line.product_id, v_line.uom_id, v_base_uom_id, v_line.quantity);
      v_base_unit_cost := (v_line.quantity * v_total_unit_cost) / nullif(v_base_qty, 0);

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

      update goods_receipt_lines set base_quantity = v_base_qty where id = v_line.id;
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
  if not has_branch_access(v_order.tenant_id, v_order.branch_id) then
    raise exception 'You do not have access to the branch of this sales order';
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
  if not has_branch_access(v_delivery.tenant_id, v_delivery.branch_id) then
    raise exception 'You do not have access to the branch of this delivery';
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

create or replace function generate_sales_invoice_from_delivery(p_delivery_id uuid, p_invoice_number text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_delivery deliveries%rowtype;
  v_order sales_orders%rowtype;
  v_invoice_id uuid;
  v_line record;
  v_subtotal numeric(18, 4) := 0;
  v_line_total numeric(18, 4);
begin
  select * into v_delivery from deliveries where id = p_delivery_id;
  if not found then
    raise exception 'Delivery not found';
  end if;
  if not has_permission(v_delivery.tenant_id, 'sales', 'create') then
    raise exception 'Missing permission: sales.create';
  end if;
  if not has_branch_access(v_delivery.tenant_id, v_delivery.branch_id) then
    raise exception 'You do not have access to the branch of this delivery';
  end if;
  if v_delivery.status = 'draft' then
    raise exception 'Delivery must be dispatched before it can be invoiced';
  end if;

  select * into v_order from sales_orders where id = v_delivery.sales_order_id;

  insert into sales_invoices (tenant_id, branch_id, customer_id, sales_order_id, invoice_number, currency_id, status)
  values (v_delivery.tenant_id, v_delivery.branch_id, v_order.customer_id, v_order.id, p_invoice_number, v_order.currency_id, 'draft')
  returning id into v_invoice_id;

  for v_line in
    select dl.product_id, dl.quantity, dl.unit_cost, sol.unit_price, sol.uom_id
    from delivery_lines dl
    join sales_order_lines sol on sol.id = dl.sales_order_line_id
    where dl.delivery_id = p_delivery_id
  loop
    v_line_total := v_line.quantity * v_line.unit_price;
    v_subtotal := v_subtotal + v_line_total;
    insert into sales_invoice_lines (tenant_id, sales_invoice_id, product_id, quantity, uom_id, unit_price, line_total, unit_cost)
    values (v_delivery.tenant_id, v_invoice_id, v_line.product_id, v_line.quantity, v_line.uom_id, v_line.unit_price, v_line_total, v_line.unit_cost);
  end loop;

  update sales_invoices
    set subtotal = v_subtotal, total_amount = v_subtotal, status = 'posted'
    where id = v_invoice_id;

  update sales_orders set status = 'invoiced', updated_at = now() where id = v_order.id;

  return v_invoice_id;
end;
$$;
