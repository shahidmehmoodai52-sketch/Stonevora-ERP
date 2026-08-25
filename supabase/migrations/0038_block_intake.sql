-- Factory Milestone 1 (Block/Slab Factory, optional capability): Raw Block
-- Intake. Reuses the existing Supplier -> PO -> GRN workflow end to end (a
-- block is still purchased and received exactly like any other product) and
-- the existing inventory_units table (unit_type/parent_unit_id/genealogy/
-- area/QR/cost columns already laid down in 0017) -- no duplicate block
-- inventory architecture is introduced.
--
-- Research (marble/granite ERP practice, see chat for sources): blocks are
-- tracked with a unique identity, dimensions, volume, weight where
-- applicable, source/quarry, and a preserved landed cost; a supplier invoice
-- for quarry blocks is conventionally itemized one block per line, since
-- each block's size/grade differs and its price is negotiated per block --
-- not as an aggregate "N blocks" split by an invented equal-division rule.
-- That real-world convention is the business rule adopted here: a
-- unit-tracked GRN line represents exactly one block. This sidesteps the
-- "how do you split cost across several physically distinct blocks on one
-- line" question the master rules warn against inventing an answer to,
-- rather than answering it with an unresearched assumption.

-- ---------------------------------------------------------------------------
-- Missing UOMs needed to actually capture block dimensions/volume: the
-- existing catalog had no plain length units short of "Running Foot/Meter",
-- no cubic-foot volume unit (the common trade unit for stone blocks in
-- several target markets), and no dedicated "Block" count unit.
-- ---------------------------------------------------------------------------
insert into uom (tenant_id, code, name, category) values
  (null, 'CM', 'Centimeter', 'length'),
  (null, 'INCH', 'Inch', 'length'),
  (null, 'MM', 'Millimeter', 'length'),
  (null, 'CFT', 'Cubic Foot', 'volume'),
  (null, 'BLOCK', 'Block', 'count');

-- Physical-constant conversions (exact, not business rules) so
-- convert_uom_quantity can normalize any linear dimension to a common unit.
insert into uom_conversions (tenant_id, product_id, from_uom_id, to_uom_id, conversion_factor)
select null, null, rm.id, cm.id, 100
from uom rm, uom cm where rm.code = 'RM' and cm.code = 'CM' and rm.tenant_id is null and cm.tenant_id is null;
insert into uom_conversions (tenant_id, product_id, from_uom_id, to_uom_id, conversion_factor)
select null, null, cm.id, rm.id, 0.01
from uom cm, uom rm where cm.code = 'CM' and rm.code = 'RM' and cm.tenant_id is null and rm.tenant_id is null;
insert into uom_conversions (tenant_id, product_id, from_uom_id, to_uom_id, conversion_factor)
select null, null, i.id, cm.id, 2.54
from uom i, uom cm where i.code = 'INCH' and cm.code = 'CM' and i.tenant_id is null and cm.tenant_id is null;
insert into uom_conversions (tenant_id, product_id, from_uom_id, to_uom_id, conversion_factor)
select null, null, cm.id, i.id, 0.3937007874
from uom cm, uom i where cm.code = 'CM' and i.code = 'INCH' and cm.tenant_id is null and i.tenant_id is null;
insert into uom_conversions (tenant_id, product_id, from_uom_id, to_uom_id, conversion_factor)
select null, null, mm.id, cm.id, 0.1
from uom mm, uom cm where mm.code = 'MM' and cm.code = 'CM' and mm.tenant_id is null and cm.tenant_id is null;
insert into uom_conversions (tenant_id, product_id, from_uom_id, to_uom_id, conversion_factor)
select null, null, cm.id, mm.id, 10
from uom cm, uom mm where cm.code = 'CM' and mm.code = 'MM' and cm.tenant_id is null and mm.tenant_id is null;

-- ---------------------------------------------------------------------------
-- inventory_units.status has been free text since Phase 0 ("in_stock"
-- default, never actually written to by any workflow yet). This is the first
-- real write to it -- convert it to an enum now, per the factory-readiness
-- recommendation, rather than let ad hoc status strings accumulate.
-- ---------------------------------------------------------------------------
create type inventory_unit_status as enum ('in_stock');

alter table inventory_units alter column status drop default;
alter table inventory_units alter column status type inventory_unit_status using status::inventory_unit_status;
alter table inventory_units alter column status set default 'in_stock';

-- ---------------------------------------------------------------------------
-- has_capability: lets an integrity function enforce "factory is optional"
-- at the database layer, not just by hiding UI -- mirrors has_branch_access's
-- shape exactly.
-- ---------------------------------------------------------------------------
create function has_capability(check_tenant_id uuid, check_capability_code text) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from tenant_capabilities tc
    join business_capabilities bc on bc.id = tc.capability_id
    where tc.tenant_id = check_tenant_id and bc.code = check_capability_code
  );
$$;

revoke execute on function has_capability(uuid, text) from public, anon;

-- ---------------------------------------------------------------------------
-- Block-intake fields on goods_receipt_lines, used only when the line's
-- product is unit-tracked -- same precedent as the existing batch/lot/shade/
-- caliber columns already on this table for batch-tracked lines.
-- ---------------------------------------------------------------------------
alter table goods_receipt_lines
  add column unit_code text,
  add column dimension_length numeric(10, 3),
  add column dimension_width numeric(10, 3),
  add column dimension_height numeric(10, 3),
  add column dimension_uom_id uuid references uom (id),
  add column volume_uom_id uuid references uom (id),
  add column unit_weight numeric(14, 4),
  add column unit_weight_uom_id uuid references uom (id),
  add column quarry_source text,
  add column unit_quality_grade text;

-- ---------------------------------------------------------------------------
-- inventory_units gains the fields block intake actually populates. Existing
-- columns (unit_code, status, current_location_id, actual_length/width/
-- thickness, quality_grade, unit_type, parent_unit_id, cost) are reused as-is;
-- actual_length/width/thickness finally get a declared unit via
-- dimension_uom_id (they never had one).
-- ---------------------------------------------------------------------------
alter table inventory_units
  add column dimension_uom_id uuid references uom (id),
  add column volume numeric(14, 6),
  add column volume_uom_id uuid references uom (id),
  add column weight numeric(14, 4),
  add column weight_uom_id uuid references uom (id),
  add column supplier_id uuid references suppliers (id),
  add column goods_receipt_line_id uuid references goods_receipt_lines (id),
  add column quarry_source text;

create index idx_inventory_units_goods_receipt_line_id on inventory_units (goods_receipt_line_id);
create index idx_inventory_units_supplier_id on inventory_units (supplier_id);

-- ---------------------------------------------------------------------------
-- post_goods_receipt: the unit-tracking branch, previously an unconditional
-- rejection, now performs real block intake -- everything else (batch/simple
-- branches, landed-cost allocation, PO received-quantity tracking) is
-- byte-for-byte unchanged from 0032_uom_conversion_engine.sql.
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
