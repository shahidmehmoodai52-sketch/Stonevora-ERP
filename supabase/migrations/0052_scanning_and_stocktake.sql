-- Phase 7 -- QR/Mobile/barcode: scanning flows for receiving, put-away,
-- picking, and stocktake, plus a barcode/QR generator. Scoped, per explicit
-- user decision, to the backend/data layer this round (schema, RPCs, live
-- SQL-verified) -- matching the pattern already set by Phases 3-6 (backend
-- first, camera-based scanning UI is a separate, later pass this session
-- cannot verify the way it verifies SQL).
--
-- Two genuinely new pieces, plus one pure-lookup convenience function:
--
-- 1. Stocktake (physical count) workflow -- the one piece of "receiving/
--    put-away/picking/stocktake" that had NO backing schema at all yet
--    (receiving/put-away/picking already have full RPCs from Phase 1/
--    Phase 1.x; a scanner just fills their existing fields faster, no new
--    RPC needed for those three). draft -> counting -> posted/cancelled.
--    Reuses Phase 1.x's stock_adjustments engine for the actual stock
--    correction (reason_code = 'count_correction', already in that
--    enum) rather than re-implementing cost-blending/decrement logic a
--    second time -- post_stocktake builds one stock_adjustments document
--    from every counted variance and calls the existing
--    post_stock_adjustment(uuid) directly. Same unit-tracked-product
--    boundary post_stock_adjustment itself already draws (Factory/Stone
--    Fabrication have their own QC-driven status machine for that).
--
-- 2. Barcode/QR generator -- generate_product_barcode/
--    generate_inventory_unit_qr_code assign a real, checksum-valid EAN-13
--    code (GS1's 20-29 prefix range, reserved for internal/restricted-
--    circulation use -- correct practice for an internally-assigned code
--    with no registered GS1 company prefix, not an invented format) only
--    when the row doesn't already have one -- never overwrites a real
--    manufacturer barcode a user already entered.
--
-- resolve_scanned_code is a plain SECURITY INVOKER lookup (no RLS bypass
-- needed or wanted) a scanning UI calls to turn one scanned string into
-- whichever product/location/unit/batch it matches, across every existing
-- scannable field (products.barcode/qr_code_value/sku,
-- storage_locations.code, inventory_units.unit_code/qr_code_value,
-- inventory_batches.batch_number) -- receiving/put-away/picking screens
-- then feed the resolved id into their EXISTING insert flows (GRN lines,
-- delivery lines, ...), so none of those existing RPCs need to change at
-- all.

create type stocktake_status as enum ('draft', 'counting', 'posted', 'cancelled');

create table stocktakes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  branch_id uuid not null references branches (id),
  warehouse_id uuid not null references warehouses (id),
  stocktake_number text not null,
  status stocktake_status not null default 'draft',
  notes text,
  stock_adjustment_id uuid references stock_adjustments (id), -- set at posting, null if the count found zero variance
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  posted_at timestamptz,
  unique (tenant_id, stocktake_number)
);

create table stocktake_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  stocktake_id uuid not null references stocktakes (id) on delete cascade,
  product_id uuid not null references products (id),
  location_id uuid references storage_locations (id), -- simple-tracked: which location's inventory_stock row
  batch_id uuid references inventory_batches (id), -- batch-tracked: which specific batch
  uom_id uuid not null references uom (id),
  system_quantity numeric(18, 4), -- snapshotted by start_stocktake_count; locked so later stock movement can't shift the baseline mid-count
  counted_quantity numeric(18, 4), -- null until actually counted
  counted_at timestamptz,
  counted_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create index idx_stocktakes_branch_id on stocktakes (branch_id);
create index idx_stocktakes_warehouse_id on stocktakes (warehouse_id);
create index idx_stocktakes_stock_adjustment_id on stocktakes (stock_adjustment_id);
create index idx_stocktake_lines_stocktake_id on stocktake_lines (stocktake_id);
create index idx_stocktake_lines_product_id on stocktake_lines (product_id);
create index idx_stocktake_lines_location_id on stocktake_lines (location_id);
create index idx_stocktake_lines_batch_id on stocktake_lines (batch_id);
create index idx_stocktake_lines_uom_id on stocktake_lines (uom_id);

-- ---------------------------------------------------------------------------
-- RLS. stocktakes(_lines) reuse the 'warehouse' resource with branch
-- scoping, byte-for-byte the same shape as stock_adjustments(_lines)
-- (0048) -- a physical count is a warehouse-side transaction, the same
-- reasoning that already put manual stock_adjustments on 'warehouse'.
-- ---------------------------------------------------------------------------

alter table stocktakes enable row level security;
create policy stocktakes_select on stocktakes for select
  using (is_tenant_member(tenant_id) and has_branch_access(tenant_id, branch_id));
create policy stocktakes_insert on stocktakes for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'warehouse', 'create') and has_branch_access(tenant_id, branch_id));
create policy stocktakes_update on stocktakes for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'warehouse', 'edit') and has_branch_access(tenant_id, branch_id))
  with check (is_tenant_member(tenant_id) and has_branch_access(tenant_id, branch_id));
create policy stocktakes_delete on stocktakes for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'warehouse', 'delete') and has_branch_access(tenant_id, branch_id));

alter table stocktake_lines enable row level security;
create policy stocktake_lines_select on stocktake_lines for select
  using (exists (select 1 from stocktakes s where s.id = stocktake_lines.stocktake_id and is_tenant_member(s.tenant_id) and has_branch_access(s.tenant_id, s.branch_id)));
create policy stocktake_lines_insert on stocktake_lines for insert
  with check (exists (select 1 from stocktakes s where s.id = stocktake_lines.stocktake_id and is_tenant_member(s.tenant_id) and has_permission(s.tenant_id, 'warehouse', 'create') and has_branch_access(s.tenant_id, s.branch_id)));
create policy stocktake_lines_update on stocktake_lines for update
  using (exists (select 1 from stocktakes s where s.id = stocktake_lines.stocktake_id and is_tenant_member(s.tenant_id) and has_permission(s.tenant_id, 'warehouse', 'edit') and has_branch_access(s.tenant_id, s.branch_id)))
  with check (exists (select 1 from stocktakes s where s.id = stocktake_lines.stocktake_id and is_tenant_member(s.tenant_id) and has_branch_access(s.tenant_id, s.branch_id)));
create policy stocktake_lines_delete on stocktake_lines for delete
  using (exists (select 1 from stocktakes s where s.id = stocktake_lines.stocktake_id and is_tenant_member(s.tenant_id) and has_permission(s.tenant_id, 'warehouse', 'delete') and has_branch_access(s.tenant_id, s.branch_id)));

create trigger stocktakes_audit after insert or update or delete on stocktakes for each row execute function audit_trigger_fn();
create trigger stocktake_lines_audit after insert or update or delete on stocktake_lines for each row execute function audit_trigger_fn();

-- ---------------------------------------------------------------------------
-- start_stocktake_count: snapshots each line's system_quantity from live
-- inventory right now, so the comparison against what's physically counted
-- stays fixed even if other transactions move stock while counting is in
-- progress. Same unit-tracked rejection post_stock_adjustment already
-- enforces, applied at the same point in the lifecycle (before any
-- snapshot is taken).
-- ---------------------------------------------------------------------------

create function start_stocktake_count(p_stocktake_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_stocktake stocktakes%rowtype;
  v_line record;
  v_tracking_mode inventory_tracking_mode;
  v_system_qty numeric(18, 4);
begin
  select * into v_stocktake from stocktakes where id = p_stocktake_id for update;
  if not found then
    raise exception 'Stocktake not found';
  end if;
  if not has_permission(v_stocktake.tenant_id, 'warehouse', 'edit') then
    raise exception 'Missing permission: warehouse.edit';
  end if;
  if not has_branch_access(v_stocktake.tenant_id, v_stocktake.branch_id) then
    raise exception 'You do not have access to the branch of this stocktake';
  end if;
  if v_stocktake.status <> 'draft' then
    raise exception 'Stocktake is not in draft status';
  end if;
  if not exists (select 1 from stocktake_lines where stocktake_id = p_stocktake_id) then
    raise exception 'A stocktake requires at least one line before counting can start';
  end if;

  for v_line in select * from stocktake_lines where stocktake_id = p_stocktake_id loop
    select inventory_tracking_mode into v_tracking_mode from products where id = v_line.product_id;
    if v_tracking_mode = 'unit' then
      raise exception 'Unit-tracked products (blocks/slabs) are not countable through this workflow';
    end if;

    if v_tracking_mode = 'batch' then
      if v_line.batch_id is null then
        raise exception 'A batch_id is required for a batch-tracked stocktake line';
      end if;
      select qty_on_hand into v_system_qty from inventory_batches
        where id = v_line.batch_id and tenant_id = v_stocktake.tenant_id and product_id = v_line.product_id;
    else
      select qty_on_hand into v_system_qty from inventory_stock
        where tenant_id = v_stocktake.tenant_id and product_id = v_line.product_id and location_id is not distinct from v_line.location_id;
    end if;

    update stocktake_lines set system_quantity = coalesce(v_system_qty, 0) where id = v_line.id;
  end loop;

  update stocktakes set status = 'counting', started_at = now() where id = p_stocktake_id;
end;
$$;

revoke execute on function start_stocktake_count(uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- record_stocktake_count: what a scan-driven counting screen calls per
-- item counted -- one line at a time, so counting can proceed in any
-- order and be resumed if interrupted.
-- ---------------------------------------------------------------------------

create function record_stocktake_count(p_stocktake_line_id uuid, p_counted_quantity numeric) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_line stocktake_lines%rowtype;
  v_stocktake stocktakes%rowtype;
begin
  select * into v_line from stocktake_lines where id = p_stocktake_line_id for update;
  if not found then
    raise exception 'Stocktake line not found';
  end if;
  select * into v_stocktake from stocktakes where id = v_line.stocktake_id;
  if not has_permission(v_stocktake.tenant_id, 'warehouse', 'edit') then
    raise exception 'Missing permission: warehouse.edit';
  end if;
  if not has_branch_access(v_stocktake.tenant_id, v_stocktake.branch_id) then
    raise exception 'You do not have access to the branch of this stocktake';
  end if;
  if v_stocktake.status <> 'counting' then
    raise exception 'Stocktake is not in counting status';
  end if;
  if p_counted_quantity is null or p_counted_quantity < 0 then
    raise exception 'counted_quantity must be zero or greater';
  end if;

  update stocktake_lines
    set counted_quantity = p_counted_quantity, counted_at = now(), counted_by = auth.uid()
    where id = p_stocktake_line_id;
end;
$$;

revoke execute on function record_stocktake_count(uuid, numeric) from public, anon;

-- ---------------------------------------------------------------------------
-- post_stocktake: every line must be counted first. Builds exactly one
-- stock_adjustments document from the counted variances (skipped entirely
-- if every line matched -- a perfect count needs no correction) and posts
-- it through the existing post_stock_adjustment(uuid), inheriting its
-- cost-blending/decrement logic and its own permission/branch checks
-- rather than duplicating either. A found item's unit_cost (increase) is
-- valued at the product's current weighted-average cost -- reusing an
-- existing system number, not inventing one, the standard way count
-- variances are valued when no new purchase price applies. If a line has
-- never had any inventory_stock/inventory_batches row at all, there is no
-- average cost to read, and post_stock_adjustment will reject that line
-- (as it already does for any manual increase with no unit_cost) --
-- inherited, not new, behavior; that item must be corrected with a manual
-- stock_adjustment carrying an explicit cost instead.
-- ---------------------------------------------------------------------------

create function post_stocktake(p_stocktake_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_stocktake stocktakes%rowtype;
  v_line record;
  v_adjustment_id uuid;
  v_variance numeric(18, 4);
  v_unit_cost numeric(18, 4);
  v_uncounted_count int;
begin
  select * into v_stocktake from stocktakes where id = p_stocktake_id for update;
  if not found then
    raise exception 'Stocktake not found';
  end if;
  if not has_permission(v_stocktake.tenant_id, 'warehouse', 'edit') then
    raise exception 'Missing permission: warehouse.edit';
  end if;
  if not has_branch_access(v_stocktake.tenant_id, v_stocktake.branch_id) then
    raise exception 'You do not have access to the branch of this stocktake';
  end if;
  if v_stocktake.status <> 'counting' then
    raise exception 'Stocktake is not in counting status';
  end if;

  select count(*) into v_uncounted_count from stocktake_lines where stocktake_id = p_stocktake_id and counted_quantity is null;
  if v_uncounted_count > 0 then
    raise exception 'Every line must be counted before posting: % line(s) still uncounted', v_uncounted_count;
  end if;

  for v_line in select * from stocktake_lines where stocktake_id = p_stocktake_id loop
    v_variance := v_line.counted_quantity - coalesce(v_line.system_quantity, 0);
    if v_variance <> 0 then
      if v_adjustment_id is null then
        insert into stock_adjustments (tenant_id, branch_id, warehouse_id, adjustment_number, reason_code, notes)
        values (v_stocktake.tenant_id, v_stocktake.branch_id, v_stocktake.warehouse_id, 'STK-' || v_stocktake.stocktake_number, 'count_correction', 'Generated from stocktake ' || v_stocktake.stocktake_number)
        returning id into v_adjustment_id;
      end if;

      v_unit_cost := null;
      if v_variance > 0 then
        if v_line.batch_id is not null then
          select cost_per_uom into v_unit_cost from inventory_batches where id = v_line.batch_id;
        else
          select avg_cost into v_unit_cost from inventory_stock
            where tenant_id = v_stocktake.tenant_id and product_id = v_line.product_id and location_id is not distinct from v_line.location_id;
        end if;
      end if;

      insert into stock_adjustment_lines (tenant_id, stock_adjustment_id, product_id, quantity_change, uom_id, unit_cost, location_id, batch_id)
      values (v_stocktake.tenant_id, v_adjustment_id, v_line.product_id, v_variance, v_line.uom_id, v_unit_cost, v_line.location_id, v_line.batch_id);
    end if;
  end loop;

  if v_adjustment_id is not null then
    perform post_stock_adjustment(v_adjustment_id);
  end if;

  update stocktakes set status = 'posted', posted_at = now(), stock_adjustment_id = v_adjustment_id where id = p_stocktake_id;

  return v_adjustment_id;
end;
$$;

revoke execute on function post_stocktake(uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- cancel_stocktake: abandons a count before it's posted. No stock has ever
-- moved for a draft/counting stocktake (only post_stocktake ever touches
-- real inventory), so there is nothing to release -- unlike
-- cancel_production_batch/cancel_stock_transfer, this is a true no-op
-- undo, not a recorded loss.
-- ---------------------------------------------------------------------------

create function cancel_stocktake(p_stocktake_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_stocktake stocktakes%rowtype;
begin
  select * into v_stocktake from stocktakes where id = p_stocktake_id for update;
  if not found then
    raise exception 'Stocktake not found';
  end if;
  if not has_permission(v_stocktake.tenant_id, 'warehouse', 'edit') then
    raise exception 'Missing permission: warehouse.edit';
  end if;
  if not has_branch_access(v_stocktake.tenant_id, v_stocktake.branch_id) then
    raise exception 'You do not have access to the branch of this stocktake';
  end if;
  if v_stocktake.status not in ('draft', 'counting') then
    raise exception 'Only a draft or in-progress stocktake can be cancelled (current status: %)', v_stocktake.status;
  end if;

  update stocktakes set status = 'cancelled' where id = p_stocktake_id;
end;
$$;

revoke execute on function cancel_stocktake(uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- Barcode/QR generator. generate_ean13_code is the shared checksum
-- generator (GS1's 20-29 prefix range, reserved for internal/restricted-
-- circulation use); the two public RPCs below are thin, idempotent
-- wrappers that only assign a code when the row doesn't already have one.
-- ---------------------------------------------------------------------------

create function generate_ean13_code(p_tenant_id uuid, p_pool text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_digits text;
  v_sum int;
  v_check int;
  v_code text;
  v_taken boolean;
  v_attempt int := 0;
begin
  loop
    v_attempt := v_attempt + 1;
    if v_attempt > 20 then
      raise exception 'Could not generate a unique code after % attempts', v_attempt - 1;
    end if;

    v_digits := (20 + floor(random() * 10))::int::text || lpad(floor(random() * 10000000000)::bigint::text, 10, '0');
    v_sum := 0;
    for i in 1..12 loop
      v_sum := v_sum + substr(v_digits, i, 1)::int * (case when i % 2 = 1 then 1 else 3 end);
    end loop;
    v_check := (10 - (v_sum % 10)) % 10;
    v_code := v_digits || v_check::text;

    if p_pool = 'product' then
      select exists(select 1 from products where tenant_id = p_tenant_id and (barcode = v_code or qr_code_value = v_code)) into v_taken;
    else
      select exists(select 1 from inventory_units where tenant_id = p_tenant_id and qr_code_value = v_code) into v_taken;
    end if;

    exit when not v_taken;
  end loop;

  return v_code;
end;
$$;

revoke execute on function generate_ean13_code(uuid, text) from public, anon, authenticated;

create function generate_product_barcode(p_product_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_product products%rowtype;
  v_code text;
begin
  select * into v_product from products where id = p_product_id for update;
  if not found then
    raise exception 'Product not found';
  end if;
  if not has_permission(v_product.tenant_id, 'product', 'edit') then
    raise exception 'Missing permission: product.edit';
  end if;

  if v_product.barcode is not null then
    return v_product.barcode;
  end if;

  v_code := generate_ean13_code(v_product.tenant_id, 'product');
  update products set barcode = v_code, qr_code_value = coalesce(qr_code_value, v_code) where id = p_product_id;
  return v_code;
end;
$$;

revoke execute on function generate_product_barcode(uuid) from public, anon;

create function generate_inventory_unit_qr_code(p_inventory_unit_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_unit inventory_units%rowtype;
  v_code text;
begin
  select * into v_unit from inventory_units where id = p_inventory_unit_id for update;
  if not found then
    raise exception 'Inventory unit not found';
  end if;
  if not has_permission(v_unit.tenant_id, 'product', 'edit') then
    raise exception 'Missing permission: product.edit';
  end if;

  if v_unit.qr_code_value is not null then
    return v_unit.qr_code_value;
  end if;

  v_code := generate_ean13_code(v_unit.tenant_id, 'unit');
  update inventory_units set qr_code_value = v_code where id = p_inventory_unit_id;
  return v_code;
end;
$$;

revoke execute on function generate_inventory_unit_qr_code(uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- resolve_scanned_code: plain SECURITY INVOKER lookup -- deliberately NOT
-- security definer, since RLS on every table it reads already scopes the
-- result correctly to whatever the calling user can see; no privilege
-- bypass is needed or wanted for a read-only convenience query a client
-- could otherwise run as four separate selects.
-- ---------------------------------------------------------------------------

create function resolve_scanned_code(p_tenant_id uuid, p_code text)
returns table (match_type text, id uuid, label text, secondary text)
language sql stable set search_path = public as $$
  select 'product'::text, p.id, p.name, p.sku
    from products p where p.tenant_id = p_tenant_id and (p.barcode = p_code or p.qr_code_value = p_code or p.sku = p_code)
  union all
  select 'storage_location'::text, sl.id, coalesce(sl.name, sl.code), sl.path
    from storage_locations sl where sl.tenant_id = p_tenant_id and sl.code = p_code
  union all
  select 'inventory_unit'::text, iu.id, iu.unit_code, iu.status::text
    from inventory_units iu where iu.tenant_id = p_tenant_id and (iu.unit_code = p_code or iu.qr_code_value = p_code)
  union all
  select 'inventory_batch'::text, ib.id, ib.batch_number, ib.status::text
    from inventory_batches ib where ib.tenant_id = p_tenant_id and ib.batch_number = p_code
  limit 10;
$$;

revoke execute on function resolve_scanned_code(uuid, text) from public, anon;
