-- Phase 1.x (closing the deferred scope from Phase 1: Trading/Distribution):
-- Returns/Credit-Debit notes and a manual stock adjustment workflow. Both
-- are always-on Trading/Distribution features (no optional capability
-- gate), matching Phase 1's own scope.
--
-- Returns: a posted sales_return / purchase_return IS the credit note /
-- debit note -- no separate document-type table -- exactly the same
-- economy this codebase already applied to "a quotation is a sales order
-- in draft status" (0020_sales.sql). Both header tables carry their own
-- subtotal/total_amount (computed at posting time, summed from lines),
-- making the posted row a complete, self-contained financial document.
-- customer_ledger/supplier_ledger (0026) are extended below to include
-- posted returns as negative entries, exactly like payments already are --
-- this is how a credit/debit note actually offsets what's owed, without
-- inventing a separate application/allocation mechanism.
--
-- Scope boundary (documented, not silently dropped, matching this
-- project's established practice): unit-tracked (block/slab) products are
-- NOT returnable here, for the same reason confirm_sales_order rejects
-- them in Phase 1 -- they are not reservable/sellable through Phase 1's
-- own mechanisms yet, and Factory/Stone Fabrication (Phases 2-3) have their
-- own QC-driven status machine (in_stock/consumed/rejected) that already
-- covers "this piece turned out bad" without needing a return concept.
--
-- Stock adjustments: scoped to 'simple'/'batch' tracked products for the
-- same reason. A found/damaged/miscounted quantity always requires an
-- entered unit_cost when increasing stock -- never invented, never
-- silently defaulted to the existing average -- matching every prior
-- costing milestone's discipline (Milestone 1, Milestone 6).
--
-- Permission reuse: no new permission resource. Sales/purchase returns
-- reuse the existing 'sales'/'purchasing' resources (a return is just
-- another sales/purchasing-side transaction); stock adjustments reuse the
-- existing 'warehouse' resource ('edit'/'create') -- inventory_manager and
-- warehouse_staff, the two roles that actually run a stocktake or write
-- off damaged goods, already hold this grant, and no role wiring changes
-- are needed in create_tenant_for_user.
--
-- Branch-access lesson applied proactively (as it now was for Phase 3):
-- every new RPC below checks has_branch_access() in its body from this,
-- its first version.

alter table sales_invoice_lines add column returned_quantity numeric(18, 4) not null default 0;
alter table goods_receipt_lines add column returned_quantity numeric(18, 4) not null default 0;

-- ---------------------------------------------------------------------------
-- Stock adjustments
-- ---------------------------------------------------------------------------

create type stock_adjustment_status as enum ('draft', 'posted', 'cancelled');
create type stock_adjustment_reason as enum ('damage', 'shrinkage', 'theft', 'found', 'count_correction', 'other');

create table stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  branch_id uuid not null references branches (id),
  warehouse_id uuid not null references warehouses (id),
  adjustment_number text not null,
  adjustment_date date not null default current_date,
  reason_code stock_adjustment_reason not null,
  status stock_adjustment_status not null default 'draft',
  notes text,
  posted_at timestamptz,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  unique (tenant_id, adjustment_number)
);

create table stock_adjustment_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  stock_adjustment_id uuid not null references stock_adjustments (id) on delete cascade,
  product_id uuid not null references products (id),
  quantity_change numeric(18, 4) not null check (quantity_change <> 0),
  uom_id uuid not null references uom (id),
  unit_cost numeric(18, 4), -- required at posting time when quantity_change > 0; never invented
  location_id uuid references storage_locations (id), -- simple-tracked target/source
  batch_id uuid references inventory_batches (id), -- batch-tracked target/source; must pre-exist
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Sales returns (posted = credit note)
-- ---------------------------------------------------------------------------

create type sales_return_status as enum ('draft', 'posted', 'cancelled');

create table sales_returns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  branch_id uuid not null references branches (id),
  warehouse_id uuid not null references warehouses (id), -- restocking destination
  customer_id uuid not null references customers (id),
  sales_invoice_id uuid not null references sales_invoices (id),
  return_number text not null,
  return_date date not null default current_date,
  status sales_return_status not null default 'draft',
  reason text,
  subtotal numeric(18, 4) not null default 0,
  total_amount numeric(18, 4) not null default 0,
  posted_at timestamptz,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  unique (tenant_id, return_number)
);

create table sales_return_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  sales_return_id uuid not null references sales_returns (id) on delete cascade,
  sales_invoice_line_id uuid not null references sales_invoice_lines (id),
  product_id uuid not null references products (id),
  quantity numeric(18, 4) not null,
  uom_id uuid not null references uom (id),
  unit_price numeric(18, 4) not null,
  unit_cost numeric(18, 4), -- COGS snapshot copied from the invoice line; required if restock = true
  line_total numeric(18, 4) not null,
  restock boolean not null default true, -- false = scrapped/damaged, credited but not returned to stock
  restock_location_id uuid references storage_locations (id), -- simple-tracked
  restock_batch_id uuid references inventory_batches (id), -- batch-tracked; must pre-exist
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Purchase returns (posted = debit note)
-- ---------------------------------------------------------------------------

create type purchase_return_status as enum ('draft', 'posted', 'cancelled');

create table purchase_returns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  branch_id uuid not null references branches (id),
  warehouse_id uuid not null references warehouses (id), -- shipping-from source
  supplier_id uuid not null references suppliers (id),
  goods_receipt_id uuid not null references goods_receipts (id),
  return_number text not null,
  return_date date not null default current_date,
  status purchase_return_status not null default 'draft',
  reason text,
  subtotal numeric(18, 4) not null default 0,
  total_amount numeric(18, 4) not null default 0,
  posted_at timestamptz,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  unique (tenant_id, return_number)
);

create table purchase_return_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  purchase_return_id uuid not null references purchase_returns (id) on delete cascade,
  goods_receipt_line_id uuid not null references goods_receipt_lines (id),
  product_id uuid not null references products (id),
  quantity numeric(18, 4) not null,
  uom_id uuid not null references uom (id),
  unit_cost numeric(18, 4) not null, -- what we paid; caller copies from goods_receipt_lines.total_unit_cost
  line_total numeric(18, 4) not null,
  location_id uuid references storage_locations (id), -- simple-tracked source
  batch_id uuid references inventory_batches (id), -- batch-tracked source
  created_at timestamptz not null default now()
);

create index idx_stock_adjustments_branch_id on stock_adjustments (branch_id);
create index idx_stock_adjustments_warehouse_id on stock_adjustments (warehouse_id);
create index idx_stock_adjustment_lines_stock_adjustment_id on stock_adjustment_lines (stock_adjustment_id);
create index idx_stock_adjustment_lines_product_id on stock_adjustment_lines (product_id);
create index idx_stock_adjustment_lines_uom_id on stock_adjustment_lines (uom_id);
create index idx_stock_adjustment_lines_location_id on stock_adjustment_lines (location_id);
create index idx_stock_adjustment_lines_batch_id on stock_adjustment_lines (batch_id);

create index idx_sales_returns_branch_id on sales_returns (branch_id);
create index idx_sales_returns_warehouse_id on sales_returns (warehouse_id);
create index idx_sales_returns_customer_id on sales_returns (customer_id);
create index idx_sales_returns_sales_invoice_id on sales_returns (sales_invoice_id);
create index idx_sales_return_lines_sales_return_id on sales_return_lines (sales_return_id);
create index idx_sales_return_lines_sales_invoice_line_id on sales_return_lines (sales_invoice_line_id);
create index idx_sales_return_lines_product_id on sales_return_lines (product_id);
create index idx_sales_return_lines_uom_id on sales_return_lines (uom_id);
create index idx_sales_return_lines_restock_location_id on sales_return_lines (restock_location_id);
create index idx_sales_return_lines_restock_batch_id on sales_return_lines (restock_batch_id);

create index idx_purchase_returns_branch_id on purchase_returns (branch_id);
create index idx_purchase_returns_warehouse_id on purchase_returns (warehouse_id);
create index idx_purchase_returns_supplier_id on purchase_returns (supplier_id);
create index idx_purchase_returns_goods_receipt_id on purchase_returns (goods_receipt_id);
create index idx_purchase_return_lines_purchase_return_id on purchase_return_lines (purchase_return_id);
create index idx_purchase_return_lines_goods_receipt_line_id on purchase_return_lines (goods_receipt_line_id);
create index idx_purchase_return_lines_product_id on purchase_return_lines (product_id);
create index idx_purchase_return_lines_uom_id on purchase_return_lines (uom_id);
create index idx_purchase_return_lines_location_id on purchase_return_lines (location_id);
create index idx_purchase_return_lines_batch_id on purchase_return_lines (batch_id);

-- ---------------------------------------------------------------------------
-- RLS -- identical shape to every other Phase 1 header (branch_id direct) /
-- line table (no branch_id, scoped via its parent).
-- ---------------------------------------------------------------------------

alter table stock_adjustments enable row level security;
create policy stock_adjustments_select on stock_adjustments for select
  using (is_tenant_member(tenant_id) and has_branch_access(tenant_id, branch_id));
create policy stock_adjustments_insert on stock_adjustments for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'warehouse', 'create') and has_branch_access(tenant_id, branch_id));
create policy stock_adjustments_update on stock_adjustments for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'warehouse', 'edit') and has_branch_access(tenant_id, branch_id))
  with check (is_tenant_member(tenant_id) and has_branch_access(tenant_id, branch_id));
create policy stock_adjustments_delete on stock_adjustments for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'warehouse', 'delete') and has_branch_access(tenant_id, branch_id));

alter table stock_adjustment_lines enable row level security;
create policy stock_adjustment_lines_select on stock_adjustment_lines for select
  using (exists (select 1 from stock_adjustments a where a.id = stock_adjustment_lines.stock_adjustment_id and is_tenant_member(a.tenant_id) and has_branch_access(a.tenant_id, a.branch_id)));
create policy stock_adjustment_lines_insert on stock_adjustment_lines for insert
  with check (exists (select 1 from stock_adjustments a where a.id = stock_adjustment_lines.stock_adjustment_id and is_tenant_member(a.tenant_id) and has_permission(a.tenant_id, 'warehouse', 'create') and has_branch_access(a.tenant_id, a.branch_id)));
create policy stock_adjustment_lines_update on stock_adjustment_lines for update
  using (exists (select 1 from stock_adjustments a where a.id = stock_adjustment_lines.stock_adjustment_id and is_tenant_member(a.tenant_id) and has_permission(a.tenant_id, 'warehouse', 'edit') and has_branch_access(a.tenant_id, a.branch_id)))
  with check (exists (select 1 from stock_adjustments a where a.id = stock_adjustment_lines.stock_adjustment_id and is_tenant_member(a.tenant_id) and has_branch_access(a.tenant_id, a.branch_id)));
create policy stock_adjustment_lines_delete on stock_adjustment_lines for delete
  using (exists (select 1 from stock_adjustments a where a.id = stock_adjustment_lines.stock_adjustment_id and is_tenant_member(a.tenant_id) and has_permission(a.tenant_id, 'warehouse', 'delete') and has_branch_access(a.tenant_id, a.branch_id)));

alter table sales_returns enable row level security;
create policy sales_returns_select on sales_returns for select
  using (is_tenant_member(tenant_id) and has_branch_access(tenant_id, branch_id));
create policy sales_returns_insert on sales_returns for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'create') and has_branch_access(tenant_id, branch_id));
create policy sales_returns_update on sales_returns for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'edit') and has_branch_access(tenant_id, branch_id))
  with check (is_tenant_member(tenant_id) and has_branch_access(tenant_id, branch_id));
create policy sales_returns_delete on sales_returns for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'delete') and has_branch_access(tenant_id, branch_id));

alter table sales_return_lines enable row level security;
create policy sales_return_lines_select on sales_return_lines for select
  using (exists (select 1 from sales_returns r where r.id = sales_return_lines.sales_return_id and is_tenant_member(r.tenant_id) and has_branch_access(r.tenant_id, r.branch_id)));
create policy sales_return_lines_insert on sales_return_lines for insert
  with check (exists (select 1 from sales_returns r where r.id = sales_return_lines.sales_return_id and is_tenant_member(r.tenant_id) and has_permission(r.tenant_id, 'sales', 'create') and has_branch_access(r.tenant_id, r.branch_id)));
create policy sales_return_lines_update on sales_return_lines for update
  using (exists (select 1 from sales_returns r where r.id = sales_return_lines.sales_return_id and is_tenant_member(r.tenant_id) and has_permission(r.tenant_id, 'sales', 'edit') and has_branch_access(r.tenant_id, r.branch_id)))
  with check (exists (select 1 from sales_returns r where r.id = sales_return_lines.sales_return_id and is_tenant_member(r.tenant_id) and has_branch_access(r.tenant_id, r.branch_id)));
create policy sales_return_lines_delete on sales_return_lines for delete
  using (exists (select 1 from sales_returns r where r.id = sales_return_lines.sales_return_id and is_tenant_member(r.tenant_id) and has_permission(r.tenant_id, 'sales', 'delete') and has_branch_access(r.tenant_id, r.branch_id)));

alter table purchase_returns enable row level security;
create policy purchase_returns_select on purchase_returns for select
  using (is_tenant_member(tenant_id) and has_branch_access(tenant_id, branch_id));
create policy purchase_returns_insert on purchase_returns for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'purchasing', 'create') and has_branch_access(tenant_id, branch_id));
create policy purchase_returns_update on purchase_returns for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'purchasing', 'edit') and has_branch_access(tenant_id, branch_id))
  with check (is_tenant_member(tenant_id) and has_branch_access(tenant_id, branch_id));
create policy purchase_returns_delete on purchase_returns for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'purchasing', 'delete') and has_branch_access(tenant_id, branch_id));

alter table purchase_return_lines enable row level security;
create policy purchase_return_lines_select on purchase_return_lines for select
  using (exists (select 1 from purchase_returns r where r.id = purchase_return_lines.purchase_return_id and is_tenant_member(r.tenant_id) and has_branch_access(r.tenant_id, r.branch_id)));
create policy purchase_return_lines_insert on purchase_return_lines for insert
  with check (exists (select 1 from purchase_returns r where r.id = purchase_return_lines.purchase_return_id and is_tenant_member(r.tenant_id) and has_permission(r.tenant_id, 'purchasing', 'create') and has_branch_access(r.tenant_id, r.branch_id)));
create policy purchase_return_lines_update on purchase_return_lines for update
  using (exists (select 1 from purchase_returns r where r.id = purchase_return_lines.purchase_return_id and is_tenant_member(r.tenant_id) and has_permission(r.tenant_id, 'purchasing', 'edit') and has_branch_access(r.tenant_id, r.branch_id)))
  with check (exists (select 1 from purchase_returns r where r.id = purchase_return_lines.purchase_return_id and is_tenant_member(r.tenant_id) and has_branch_access(r.tenant_id, r.branch_id)));
create policy purchase_return_lines_delete on purchase_return_lines for delete
  using (exists (select 1 from purchase_returns r where r.id = purchase_return_lines.purchase_return_id and is_tenant_member(r.tenant_id) and has_permission(r.tenant_id, 'purchasing', 'delete') and has_branch_access(r.tenant_id, r.branch_id)));

create trigger stock_adjustments_audit after insert or update or delete on stock_adjustments for each row execute function audit_trigger_fn();
create trigger stock_adjustment_lines_audit after insert or update or delete on stock_adjustment_lines for each row execute function audit_trigger_fn();
create trigger sales_returns_audit after insert or update or delete on sales_returns for each row execute function audit_trigger_fn();
create trigger sales_return_lines_audit after insert or update or delete on sales_return_lines for each row execute function audit_trigger_fn();
create trigger purchase_returns_audit after insert or update or delete on purchase_returns for each row execute function audit_trigger_fn();
create trigger purchase_return_lines_audit after insert or update or delete on purchase_return_lines for each row execute function audit_trigger_fn();

-- ---------------------------------------------------------------------------
-- post_stock_adjustment: locks the header, requires 'draft', applies each
-- line's quantity_change to inventory_stock (simple, keyed by location_id,
-- null = warehouse-level generic bucket -- same convention post_goods_receipt
-- already uses) or inventory_batches (batch, keyed by an existing batch_id --
-- a brand-new batch is out of scope here, matching how add_project_material
-- never invents a new inventory_unit either). Increasing stock blends into
-- the weighted-average cost using the caller's entered unit_cost (required,
-- never defaulted to the existing average); decreasing stock validates
-- against (qty_on_hand - reserved_qty), the same "available" guard
-- confirm_sales_order uses.
-- ---------------------------------------------------------------------------
create function post_stock_adjustment(p_stock_adjustment_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_adj stock_adjustments%rowtype;
  v_line record;
  v_tracking_mode inventory_tracking_mode;
  v_base_uom_id uuid;
  v_base_qty numeric(18, 4);
  v_stock record;
  v_batch record;
  v_new_qty numeric(18, 4);
  v_new_cost numeric(18, 4);
begin
  select * into v_adj from stock_adjustments where id = p_stock_adjustment_id for update;
  if not found then
    raise exception 'Stock adjustment not found';
  end if;
  if not has_permission(v_adj.tenant_id, 'warehouse', 'edit') then
    raise exception 'Missing permission: warehouse.edit';
  end if;
  if not has_branch_access(v_adj.tenant_id, v_adj.branch_id) then
    raise exception 'You do not have access to the branch of this stock adjustment';
  end if;
  if v_adj.status <> 'draft' then
    raise exception 'Stock adjustment is not in draft status';
  end if;

  for v_line in select * from stock_adjustment_lines where stock_adjustment_id = p_stock_adjustment_id loop
    select inventory_tracking_mode, base_uom_id into v_tracking_mode, v_base_uom_id from products where id = v_line.product_id;
    if v_tracking_mode = 'unit' then
      raise exception 'Unit-tracked products (blocks/slabs) are not adjustable through this workflow';
    end if;

    v_base_qty := convert_uom_quantity(v_adj.tenant_id, v_line.product_id, v_line.uom_id, v_base_uom_id, abs(v_line.quantity_change));

    if v_line.quantity_change > 0 and v_line.unit_cost is null then
      raise exception 'unit_cost is required when increasing stock (line for product %)', v_line.product_id;
    end if;

    if v_tracking_mode = 'batch' then
      if v_line.batch_id is null then
        raise exception 'A batch_id is required for a batch-tracked adjustment line';
      end if;
      select * into v_batch from inventory_batches where id = v_line.batch_id and tenant_id = v_adj.tenant_id and product_id = v_line.product_id for update;
      if not found then
        raise exception 'Batch not found for this product';
      end if;

      if v_line.quantity_change > 0 then
        v_new_qty := v_batch.qty_on_hand + v_base_qty;
        v_new_cost := (v_batch.qty_on_hand * v_batch.cost_per_uom + v_base_qty * v_line.unit_cost) / nullif(v_new_qty, 0);
        update inventory_batches set qty_on_hand = v_new_qty, cost_per_uom = coalesce(v_new_cost, v_batch.cost_per_uom) where id = v_batch.id;
      else
        if (v_batch.qty_on_hand - v_batch.reserved_qty) < v_base_qty then
          raise exception 'Insufficient available stock in batch to decrease by %: available %', v_base_qty, v_batch.qty_on_hand - v_batch.reserved_qty;
        end if;
        update inventory_batches set qty_on_hand = v_batch.qty_on_hand - v_base_qty where id = v_batch.id;
      end if;
    else
      select * into v_stock from inventory_stock
        where tenant_id = v_adj.tenant_id and product_id = v_line.product_id and location_id is not distinct from v_line.location_id
        for update;

      if v_line.quantity_change > 0 then
        if found then
          v_new_qty := v_stock.qty_on_hand + v_base_qty;
          v_new_cost := (v_stock.qty_on_hand * v_stock.avg_cost + v_base_qty * v_line.unit_cost) / nullif(v_new_qty, 0);
          update inventory_stock set qty_on_hand = v_new_qty, avg_cost = coalesce(v_new_cost, v_stock.avg_cost), updated_at = now() where id = v_stock.id;
        else
          insert into inventory_stock (tenant_id, product_id, location_id, qty_on_hand, avg_cost, uom_id)
          values (v_adj.tenant_id, v_line.product_id, v_line.location_id, v_base_qty, v_line.unit_cost, v_base_uom_id);
        end if;
      else
        if not found or (v_stock.qty_on_hand - v_stock.reserved_qty) < v_base_qty then
          raise exception 'Insufficient available stock to decrease by %: available %', v_base_qty, coalesce(v_stock.qty_on_hand - v_stock.reserved_qty, 0);
        end if;
        update inventory_stock set qty_on_hand = v_stock.qty_on_hand - v_base_qty, updated_at = now() where id = v_stock.id;
      end if;
    end if;
  end loop;

  update stock_adjustments set status = 'posted', posted_at = now() where id = p_stock_adjustment_id;
end;
$$;

revoke execute on function post_stock_adjustment(uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- post_sales_return: locks the header, requires 'draft', validates every
-- line against the invoice it claims (same invoice, not already fully
-- returned -- tracked via sales_invoice_lines.returned_quantity, the same
-- cumulative-tracking idiom purchase_order_lines.received_quantity and
-- sales_order_lines.delivered_quantity already use), restocks (when
-- restock = true) into inventory_stock/inventory_batches by blending the
-- line's own unit_cost into the weighted average -- the same blend
-- post_goods_receipt uses for a genuine receipt, because a restock IS a
-- receipt of previously-sold goods. Sums to subtotal/total_amount so the
-- posted row is a complete credit note on its own.
-- ---------------------------------------------------------------------------
create function post_sales_return(p_sales_return_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_return sales_returns%rowtype;
  v_line record;
  v_invline sales_invoice_lines%rowtype;
  v_tracking_mode inventory_tracking_mode;
  v_base_uom_id uuid;
  v_base_qty numeric(18, 4);
  v_stock record;
  v_batch record;
  v_new_qty numeric(18, 4);
  v_new_cost numeric(18, 4);
  v_subtotal numeric(18, 4) := 0;
begin
  select * into v_return from sales_returns where id = p_sales_return_id for update;
  if not found then
    raise exception 'Sales return not found';
  end if;
  if not has_permission(v_return.tenant_id, 'sales', 'edit') then
    raise exception 'Missing permission: sales.edit';
  end if;
  if not has_branch_access(v_return.tenant_id, v_return.branch_id) then
    raise exception 'You do not have access to the branch of this sales return';
  end if;
  if v_return.status <> 'draft' then
    raise exception 'Sales return is not in draft status';
  end if;

  for v_line in select * from sales_return_lines where sales_return_id = p_sales_return_id loop
    select * into v_invline from sales_invoice_lines where id = v_line.sales_invoice_line_id and sales_invoice_id = v_return.sales_invoice_id for update;
    if not found then
      raise exception 'Invoice line % does not belong to this return''s invoice', v_line.sales_invoice_line_id;
    end if;
    if v_line.quantity <= 0 then
      raise exception 'Return quantity must be greater than zero';
    end if;
    if v_invline.returned_quantity + v_line.quantity > v_invline.quantity then
      raise exception 'Cannot return more than was invoiced for line % (invoiced %, already returned %)', v_line.sales_invoice_line_id, v_invline.quantity, v_invline.returned_quantity;
    end if;

    select inventory_tracking_mode, base_uom_id into v_tracking_mode, v_base_uom_id from products where id = v_line.product_id;
    if v_tracking_mode = 'unit' then
      raise exception 'Unit-tracked products (blocks/slabs) are not yet returnable in Phase 1';
    end if;

    if v_line.restock then
      if v_line.unit_cost is null then
        raise exception 'unit_cost is required to restock a return line (product %)', v_line.product_id;
      end if;
      v_base_qty := convert_uom_quantity(v_return.tenant_id, v_line.product_id, v_line.uom_id, v_base_uom_id, v_line.quantity);

      if v_tracking_mode = 'batch' then
        if v_line.restock_batch_id is null then
          raise exception 'A restock_batch_id is required to restock a batch-tracked return line';
        end if;
        select * into v_batch from inventory_batches where id = v_line.restock_batch_id and tenant_id = v_return.tenant_id and product_id = v_line.product_id for update;
        if not found then
          raise exception 'Restock batch not found for this product';
        end if;
        v_new_qty := v_batch.qty_on_hand + v_base_qty;
        v_new_cost := (v_batch.qty_on_hand * v_batch.cost_per_uom + v_base_qty * v_line.unit_cost) / nullif(v_new_qty, 0);
        update inventory_batches set qty_on_hand = v_new_qty, cost_per_uom = coalesce(v_new_cost, v_batch.cost_per_uom) where id = v_batch.id;
      else
        select * into v_stock from inventory_stock
          where tenant_id = v_return.tenant_id and product_id = v_line.product_id and location_id is not distinct from v_line.restock_location_id
          for update;
        if found then
          v_new_qty := v_stock.qty_on_hand + v_base_qty;
          v_new_cost := (v_stock.qty_on_hand * v_stock.avg_cost + v_base_qty * v_line.unit_cost) / nullif(v_new_qty, 0);
          update inventory_stock set qty_on_hand = v_new_qty, avg_cost = coalesce(v_new_cost, v_stock.avg_cost), updated_at = now() where id = v_stock.id;
        else
          insert into inventory_stock (tenant_id, product_id, location_id, qty_on_hand, avg_cost, uom_id)
          values (v_return.tenant_id, v_line.product_id, v_line.restock_location_id, v_base_qty, v_line.unit_cost, v_base_uom_id);
        end if;
      end if;
    end if;

    update sales_invoice_lines set returned_quantity = returned_quantity + v_line.quantity where id = v_line.sales_invoice_line_id;
    v_subtotal := v_subtotal + v_line.line_total;
  end loop;

  update sales_returns set subtotal = v_subtotal, total_amount = v_subtotal, status = 'posted', posted_at = now() where id = p_sales_return_id;
end;
$$;

revoke execute on function post_sales_return(uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- post_purchase_return: the mirror image of post_sales_return -- goods
-- physically leave our stock back to the supplier, validated against
-- availability (qty_on_hand - reserved_qty) exactly like a dispatch, and
-- against how much was actually received on that GRN line (returned_quantity
-- on goods_receipt_lines, the same cumulative idiom as above). No cost
-- blending on the way out -- avg_cost/cost_per_uom are untouched, matching
-- dispatch_delivery's own plain decrement.
-- ---------------------------------------------------------------------------
create function post_purchase_return(p_purchase_return_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_return purchase_returns%rowtype;
  v_line record;
  v_grnline goods_receipt_lines%rowtype;
  v_tracking_mode inventory_tracking_mode;
  v_base_uom_id uuid;
  v_base_qty numeric(18, 4);
  v_stock record;
  v_batch record;
  v_subtotal numeric(18, 4) := 0;
begin
  select * into v_return from purchase_returns where id = p_purchase_return_id for update;
  if not found then
    raise exception 'Purchase return not found';
  end if;
  if not has_permission(v_return.tenant_id, 'purchasing', 'edit') then
    raise exception 'Missing permission: purchasing.edit';
  end if;
  if not has_branch_access(v_return.tenant_id, v_return.branch_id) then
    raise exception 'You do not have access to the branch of this purchase return';
  end if;
  if v_return.status <> 'draft' then
    raise exception 'Purchase return is not in draft status';
  end if;

  for v_line in select * from purchase_return_lines where purchase_return_id = p_purchase_return_id loop
    select * into v_grnline from goods_receipt_lines where id = v_line.goods_receipt_line_id and goods_receipt_id = v_return.goods_receipt_id for update;
    if not found then
      raise exception 'GRN line % does not belong to this return''s goods receipt', v_line.goods_receipt_line_id;
    end if;
    if v_line.quantity <= 0 then
      raise exception 'Return quantity must be greater than zero';
    end if;
    if v_grnline.returned_quantity + v_line.quantity > v_grnline.quantity then
      raise exception 'Cannot return more than was received for line % (received %, already returned %)', v_line.goods_receipt_line_id, v_grnline.quantity, v_grnline.returned_quantity;
    end if;

    select inventory_tracking_mode, base_uom_id into v_tracking_mode, v_base_uom_id from products where id = v_line.product_id;
    if v_tracking_mode = 'unit' then
      raise exception 'Unit-tracked products (blocks/slabs) are not yet returnable in Phase 1';
    end if;

    v_base_qty := convert_uom_quantity(v_return.tenant_id, v_line.product_id, v_line.uom_id, v_base_uom_id, v_line.quantity);

    if v_tracking_mode = 'batch' then
      if v_line.batch_id is null then
        raise exception 'A batch_id is required for a batch-tracked purchase return line';
      end if;
      select * into v_batch from inventory_batches where id = v_line.batch_id and tenant_id = v_return.tenant_id and product_id = v_line.product_id for update;
      if not found then
        raise exception 'Batch not found for this product';
      end if;
      if (v_batch.qty_on_hand - v_batch.reserved_qty) < v_base_qty then
        raise exception 'Insufficient available stock in batch to return %: available %', v_base_qty, v_batch.qty_on_hand - v_batch.reserved_qty;
      end if;
      update inventory_batches set qty_on_hand = v_batch.qty_on_hand - v_base_qty where id = v_batch.id;
    else
      select * into v_stock from inventory_stock
        where tenant_id = v_return.tenant_id and product_id = v_line.product_id and location_id is not distinct from v_line.location_id
        for update;
      if not found or (v_stock.qty_on_hand - v_stock.reserved_qty) < v_base_qty then
        raise exception 'Insufficient available stock to return %: available %', v_base_qty, coalesce(v_stock.qty_on_hand - v_stock.reserved_qty, 0);
      end if;
      update inventory_stock set qty_on_hand = v_stock.qty_on_hand - v_base_qty, updated_at = now() where id = v_stock.id;
    end if;

    update goods_receipt_lines set returned_quantity = returned_quantity + v_line.quantity where id = v_line.goods_receipt_line_id;
    v_subtotal := v_subtotal + v_line.line_total;
  end loop;

  update purchase_returns set subtotal = v_subtotal, total_amount = v_subtotal, status = 'posted', posted_at = now() where id = p_purchase_return_id;
end;
$$;

revoke execute on function post_purchase_return(uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- Financial redaction for sales_return_lines, mirroring sales_invoice_lines_secure
-- (0026) exactly -- a credit note's COGS/margin is exactly as sensitive as an
-- invoice's.
-- ---------------------------------------------------------------------------
create view sales_return_lines_secure
with (security_invoker = true) as
select
  l.id, l.tenant_id, l.sales_return_id, l.sales_invoice_line_id, l.product_id,
  l.quantity, l.uom_id, l.unit_price, l.line_total, l.restock,
  case when has_permission((select tenant_id from sales_returns where id = l.sales_return_id), 'sales', 'view_cost')
      or has_permission((select tenant_id from sales_returns where id = l.sales_return_id), 'sales', 'view_profit')
    then l.unit_cost else null end as unit_cost,
  case when has_permission((select tenant_id from sales_returns where id = l.sales_return_id), 'sales', 'view_profit')
    then l.line_total - (l.quantity * l.unit_cost) else null end as margin,
  l.created_at
from sales_return_lines l;

-- ---------------------------------------------------------------------------
-- Extend customer_ledger/supplier_ledger (0026) to include posted returns as
-- negative entries -- the same sign convention payments already use. This is
-- the actual mechanism by which a credit/debit note offsets what's owed; a
-- separate allocation/application workflow (applying a specific credit note
-- to a specific future invoice) is out of scope here, same as this project's
-- other documented, not-silently-dropped boundaries.
-- ---------------------------------------------------------------------------
create or replace view customer_ledger
with (security_invoker = true) as
select
  tenant_id, customer_id, entry_date, entry_type, reference, amount,
  sum(amount) over (
    partition by tenant_id, customer_id
    order by entry_date, entry_type, id
    rows between unbounded preceding and current row
  ) as running_balance
from (
  select tenant_id, customer_id, invoice_date as entry_date, 'invoice' as entry_type,
    invoice_number as reference, total_amount as amount, id
  from sales_invoices
  where status <> 'cancelled'
  union all
  select tenant_id, customer_id, payment_date as entry_date, 'payment' as entry_type,
    coalesce(reference, 'Payment') as reference, -amount as amount, id
  from customer_payments
  union all
  select tenant_id, customer_id, return_date as entry_date, 'credit_note' as entry_type,
    return_number as reference, -total_amount as amount, id
  from sales_returns
  where status = 'posted'
) combined;

create or replace view supplier_ledger
with (security_invoker = true) as
select
  tenant_id, supplier_id, entry_date, entry_type, reference, amount,
  sum(amount) over (
    partition by tenant_id, supplier_id
    order by entry_date, entry_type, id
    rows between unbounded preceding and current row
  ) as running_balance
from (
  select tenant_id, supplier_id, invoice_date as entry_date, 'invoice' as entry_type,
    invoice_number as reference, total_amount as amount, id
  from purchase_invoices
  union all
  select tenant_id, supplier_id, payment_date as entry_date, 'payment' as entry_type,
    coalesce(reference, 'Payment') as reference, -amount as amount, id
  from supplier_payments
  union all
  select tenant_id, supplier_id, return_date as entry_date, 'debit_note' as entry_type,
    return_number as reference, -total_amount as amount, id
  from purchase_returns
  where status = 'posted'
) combined;
