-- Bug found via live testing while verifying the stock-transfer module: the
-- original receive_stock_transfer always flipped the transfer to 'received'
-- after a single call, even on a partial receipt -- closing the transfer
-- with no way to receive the remaining outstanding quantity later. Fix:
-- only mark 'received' once every line's received_quantity has caught up to
-- its shipped base_quantity; otherwise the transfer stays 'in_transit' so a
-- follow-up receive_stock_transfer call can top it up.
create or replace function receive_stock_transfer(p_stock_transfer_id uuid, p_line_quantities jsonb default '{}'::jsonb) returns void
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
  v_fully_received boolean;
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

  select bool_and(received_quantity >= base_quantity) into v_fully_received
    from stock_transfer_lines where stock_transfer_id = p_stock_transfer_id;

  if v_fully_received then
    update stock_transfers set status = 'received', received_at = now(), updated_at = now() where id = p_stock_transfer_id;
  else
    update stock_transfers set updated_at = now() where id = p_stock_transfer_id;
  end if;
end;
$$;
