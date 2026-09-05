-- Phase 6 -- Accounting depth: Chart of Accounts + double-entry ledger +
-- P&L/Balance Sheet reporting. Unlike every prior phase (one new business
-- workflow, reusing an existing permission resource), accounting is a
-- genuinely new domain that reads across every other module -- it earns
-- its own 'accounting' permission resource (same 11-action shape as
-- 'sales'/'purchasing'/'production'/'project'), gated for reporting via
-- the existing 'view_financial' action already in the Phase 0 catalog.
--
-- Scope decision, deliberately contained: rather than retrofitting a
-- journal-posting hook into every transaction RPC in the codebase (returns,
-- adjustments, production costing, project invoicing -- a much larger,
-- riskier blast radius), this phase wires auto-posting into exactly the
-- two RPCs that already carry the full trading loop's revenue/expense
-- recognition -- post_goods_receipt (inventory asset + payable) and
-- generate_sales_invoice_from_delivery (receivable + revenue + COGS) --
-- plus the two payment tables (cash movement) via new triggers, additive
-- to their existing sync triggers. This covers the complete, already-
-- functional Trading/Distribction loop end to end. Returns/adjustments/
-- production/project-invoice auto-posting is an explicit, documented
-- boundary for a future phase, exactly like Phase 5 left unit-tracked
-- reservation out of scope rather than half-building it.
--
-- A manual post_journal_entry RPC (plus reverse_journal_entry, since
-- posted entries are never edited, only reversed -- standard accounting
-- practice) covers everything else: opening balances, corrections,
-- operating expenses, and any workflow this phase didn't auto-wire.
--
-- Chart of Accounts follows the exact role_templates -> roles pattern
-- already established in Phase 0: a global account_templates catalog,
-- copied into a new tenant's own chart_of_accounts at creation time --
-- letting every tenant customize their own COA afterward without touching
-- the global template.

create type account_type as enum ('asset', 'liability', 'equity', 'revenue', 'expense');

create table account_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  account_type account_type not null,
  sort_order int not null default 0
);

insert into account_templates (code, name, account_type, sort_order) values
  ('1000', 'Cash and Bank', 'asset', 10),
  ('1100', 'Accounts Receivable', 'asset', 20),
  ('1200', 'Inventory', 'asset', 30),
  ('2000', 'Accounts Payable', 'liability', 40),
  ('2100', 'Tax Payable', 'liability', 50),
  ('3000', 'Owner''s Equity', 'equity', 60),
  ('3900', 'Retained Earnings', 'equity', 70),
  ('4000', 'Sales Revenue', 'revenue', 80),
  ('5000', 'Cost of Goods Sold', 'expense', 90),
  ('6000', 'Operating Expenses', 'expense', 100);

alter table account_templates enable row level security;
create policy account_templates_select on account_templates for select using (auth.role() = 'authenticated');

create table chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  code text not null,
  name text not null,
  account_type account_type not null,
  parent_account_id uuid references chart_of_accounts (id),
  is_active boolean not null default true,
  is_system boolean not null default false, -- seeded accounts auto-posting depends on by code; protected below
  created_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create index idx_chart_of_accounts_parent_account_id on chart_of_accounts (parent_account_id);

-- ---------------------------------------------------------------------------
-- Journal entries: always inserted as final/posted (no draft workflow,
-- matching customer_payments/supplier_payments having no draft stage
-- either) -- corrections happen via reverse_journal_entry, never by
-- editing a posted entry.
-- ---------------------------------------------------------------------------

create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  branch_id uuid not null references branches (id),
  entry_date date not null default current_date,
  reference_type text not null, -- 'goods_receipt' | 'sales_invoice' | 'customer_payment' | 'supplier_payment' | 'manual'
  reference_id uuid,
  description text,
  reverses_entry_id uuid references journal_entries (id),
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create table journal_entry_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  journal_entry_id uuid not null references journal_entries (id) on delete cascade,
  account_id uuid not null references chart_of_accounts (id),
  debit numeric(18, 4) not null default 0 check (debit >= 0),
  credit numeric(18, 4) not null default 0 check (credit >= 0),
  description text,
  check ((debit = 0) <> (credit = 0)) -- exactly one of debit/credit is nonzero per line
);

create index idx_journal_entries_branch_id on journal_entries (branch_id);
create index idx_journal_entries_reference on journal_entries (reference_type, reference_id);
create index idx_journal_entries_reverses_entry_id on journal_entries (reverses_entry_id);
create index idx_journal_entry_lines_journal_entry_id on journal_entry_lines (journal_entry_id);
create index idx_journal_entry_lines_account_id on journal_entry_lines (account_id);

-- ---------------------------------------------------------------------------
-- New 'accounting' permission resource -- same coarse-grained, 11-action
-- shape as every other resource (Phase 0's deliberate design).
-- ---------------------------------------------------------------------------

insert into permissions (resource, action) select 'accounting', a.action
from (values ('view'), ('create'), ('edit'), ('delete'), ('approve'), ('cancel'), ('print'), ('export'), ('view_cost'), ('view_profit'), ('view_financial')) as a(action);

-- ---------------------------------------------------------------------------
-- RLS. chart_of_accounts is tenant-wide reference data, not branch-scoped
-- (exactly like products/bill_of_materials). journal_entries/_lines are
-- branch-scoped like every transaction table since Phase 0's branch-level
-- RLS (0033).
-- ---------------------------------------------------------------------------

alter table chart_of_accounts enable row level security;
create policy chart_of_accounts_select on chart_of_accounts for select using (is_tenant_member(tenant_id));
create policy chart_of_accounts_insert on chart_of_accounts for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'accounting', 'create'));
create policy chart_of_accounts_update on chart_of_accounts for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'accounting', 'edit'))
  with check (is_tenant_member(tenant_id));
create policy chart_of_accounts_delete on chart_of_accounts for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'accounting', 'delete'));

-- Protects the identity of seeded, auto-posting-referenced accounts: code/
-- account_type/is_system cannot change and the row cannot be deleted once
-- is_system = true, UNLESS the delete is part of the owning tenant's own
-- cascade removal (ON DELETE CASCADE on chart_of_accounts.tenant_id) --
-- checked by whether the tenant row itself still exists, since Postgres
-- removes the parent row before firing the cascade's child deletes. A real
-- bug found live during this phase's own cleanup: without this exception,
-- the trigger blocked deleting a whole test tenant outright (the cascade
-- delete into chart_of_accounts hit its own is_system protection), fixed
-- and re-verified before the migration was committed. Name/is_active/
-- parent stay editable at all times.
create function protect_system_account() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.is_system and exists (select 1 from tenants where id = old.tenant_id) then
      raise exception 'This is a system account required by automatic posting and cannot be deleted';
    end if;
    return old;
  end if;

  if old.is_system and (new.code <> old.code or new.account_type <> old.account_type or new.is_system <> old.is_system) then
    raise exception 'The code, account type, and system flag of a system account cannot be changed';
  end if;
  return new;
end;
$$;

create trigger protect_system_account_update before update on chart_of_accounts
  for each row execute function protect_system_account();
create trigger protect_system_account_delete before delete on chart_of_accounts
  for each row execute function protect_system_account();

-- Trigger functions are never directly callable as RPCs -- matches the
-- established precedent (0013, 0027) for every prior trigger function in
-- this codebase; found by this migration's own security-advisor pass.
revoke execute on function protect_system_account() from public, anon, authenticated;

alter table journal_entries enable row level security;
create policy journal_entries_select on journal_entries for select
  using (is_tenant_member(tenant_id) and has_branch_access(tenant_id, branch_id));
create policy journal_entries_insert on journal_entries for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'accounting', 'create') and has_branch_access(tenant_id, branch_id));
-- No update/delete policy: posted entries are immutable, corrected only via reverse_journal_entry.

alter table journal_entry_lines enable row level security;
create policy journal_entry_lines_select on journal_entry_lines for select
  using (exists (select 1 from journal_entries je where je.id = journal_entry_lines.journal_entry_id and is_tenant_member(je.tenant_id) and has_branch_access(je.tenant_id, je.branch_id)));
create policy journal_entry_lines_insert on journal_entry_lines for insert
  with check (exists (select 1 from journal_entries je where je.id = journal_entry_lines.journal_entry_id and is_tenant_member(je.tenant_id) and has_permission(je.tenant_id, 'accounting', 'create') and has_branch_access(je.tenant_id, je.branch_id)));

create trigger chart_of_accounts_audit after insert or update or delete on chart_of_accounts for each row execute function audit_trigger_fn();
create trigger journal_entries_audit after insert or update or delete on journal_entries for each row execute function audit_trigger_fn();
create trigger journal_entry_lines_audit after insert or update or delete on journal_entry_lines for each row execute function audit_trigger_fn();

-- ---------------------------------------------------------------------------
-- create_tenant_for_user: reproduced in full (required to add the new
-- 'accounting' permission grants). Two additions beyond the accounting
-- wiring: (1) seeds chart_of_accounts from account_templates for the new
-- tenant, mirroring the role_templates -> roles copy already done just
-- below it; (2) restores the `insert into tenant_capabilities` call for
-- 'trading_distribution' -- a real regression accidentally dropped when
-- Phase 3 (0046) last reproduced this function (present in 0031/0039/0043,
-- silently missing from 0046 onward). Found while researching this phase;
-- nothing in the codebase actually gates on 'trading_distribution' via
-- has_capability, so the bug was cosmetic (the Settings -> Business
-- capabilities screen would show it as off for any tenant created since
-- Phase 3) rather than a functional break, but it's fixed here rather than
-- left in place now that this function must be touched anyway.
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

  insert into chart_of_accounts (tenant_id, code, name, account_type, is_system)
    select v_tenant_id, at.code, at.name, at.account_type, true from account_templates at;

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
          or (v_permission.resource = 'accounting' and v_permission.action in ('create', 'edit'))
        when v_role.code = 'inventory_manager' then
          (v_permission.resource in ('product', 'warehouse')
            and v_permission.action in ('view', 'create', 'edit', 'delete', 'print', 'export'))
          or (v_permission.resource = 'purchasing' and v_permission.action = 'view')
        when v_role.code = 'purchase_manager' then
          v_permission.resource = 'purchasing'
          and v_permission.action in ('view', 'create', 'edit', 'delete', 'approve', 'cancel', 'print', 'export')
        when v_role.code = 'sales_manager' then
          (v_permission.resource = 'sales'
            and v_permission.action in ('view', 'create', 'edit', 'delete', 'approve', 'cancel', 'print', 'export', 'view_cost', 'view_profit'))
          or (v_permission.resource = 'project'
            and v_permission.action in ('view', 'create', 'edit', 'delete', 'approve', 'cancel', 'print', 'export', 'view_cost', 'view_profit'))
        when v_role.code = 'warehouse_staff' then
          (v_permission.resource in ('product', 'warehouse')
            and v_permission.action in ('view', 'create', 'edit'))
          or (v_permission.resource = 'purchasing' and v_permission.action in ('view', 'create', 'edit'))
        when v_role.code = 'dispatch_staff' then
          v_permission.resource = 'sales' and v_permission.action in ('view', 'create', 'edit')
        when v_role.code = 'qc_manager' then
          (v_permission.resource = 'product' and v_permission.action in ('view', 'edit'))
          or (v_permission.resource = 'warehouse' and v_permission.action = 'view')
          or (v_permission.resource = 'production' and v_permission.action in ('view', 'approve'))
        when v_role.code = 'salesperson' then
          (v_permission.resource in ('product', 'warehouse') and v_permission.action = 'view')
          or (v_permission.resource = 'sales' and v_permission.action in ('view', 'create', 'edit'))
        when v_role.code = 'viewer' then
          v_permission.action = 'view'
        when v_role.code in ('factory_manager', 'production_manager') then
          (v_permission.resource in ('product', 'warehouse') and v_permission.action = 'view')
          or (v_permission.resource = 'production'
            and v_permission.action in ('view', 'create', 'edit', 'delete', 'approve', 'cancel', 'print', 'export', 'view_cost'))
          or (v_permission.resource = 'project' and v_permission.action in ('view', 'create', 'edit'))
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
-- post_goods_receipt: reproduced in full (required to append journal
-- posting after the existing loop/status update). Adds exactly one
-- balanced entry per receipt: Dr Inventory / Cr Accounts Payable, for the
-- full landed cost recognized (sum of quantity * total_unit_cost across
-- every line, accumulated in the existing per-line loop -- the same value
-- already being written to inventory_stock/inventory_batches/
-- inventory_units, so this can never drift from the physical posting).
-- Byte-for-byte identical to the current body otherwise.
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
  v_total_received_value numeric(18, 4) := 0;
  v_inventory_account_id uuid;
  v_ap_account_id uuid;
  v_journal_entry_id uuid;
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

    v_total_received_value := v_total_received_value + (v_line.quantity * v_total_unit_cost);

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
        v_volume := v_volume_cm3 / 1000000;
      elsif v_volume_uom_code = 'CFT' then
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

  if v_total_received_value > 0 then
    select id into v_inventory_account_id from chart_of_accounts where tenant_id = v_receipt.tenant_id and code = '1200';
    select id into v_ap_account_id from chart_of_accounts where tenant_id = v_receipt.tenant_id and code = '2000';

    if v_inventory_account_id is not null and v_ap_account_id is not null then
      insert into journal_entries (tenant_id, branch_id, entry_date, reference_type, reference_id, description, created_by)
      values (v_receipt.tenant_id, v_receipt.branch_id, current_date, 'goods_receipt', p_goods_receipt_id, 'Goods receipt ' || v_receipt.grn_number, auth.uid())
      returning id into v_journal_entry_id;

      insert into journal_entry_lines (tenant_id, journal_entry_id, account_id, debit, credit) values
        (v_receipt.tenant_id, v_journal_entry_id, v_inventory_account_id, v_total_received_value, 0),
        (v_receipt.tenant_id, v_journal_entry_id, v_ap_account_id, 0, v_total_received_value);
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- generate_sales_invoice_from_delivery: reproduced in full (required to
-- append journal posting after invoice/order status updates). Adds two
-- balanced entries: Dr Accounts Receivable / Cr Sales Revenue for the
-- invoice subtotal, and Dr Cost of Goods Sold / Cr Inventory for the sum
-- of quantity * unit_cost already captured on each delivery line at
-- dispatch time -- the exact same COGS figure the invoice line itself
-- stores, so this can never drift from what dispatch_delivery already
-- decremented. Byte-for-byte identical to the current body otherwise.
-- ---------------------------------------------------------------------------

create or replace function generate_sales_invoice_from_delivery(p_delivery_id uuid, p_invoice_number text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_delivery deliveries%rowtype;
  v_order sales_orders%rowtype;
  v_invoice_id uuid;
  v_line record;
  v_subtotal numeric(18, 4) := 0;
  v_line_total numeric(18, 4);
  v_total_cogs numeric(18, 4) := 0;
  v_ar_account_id uuid;
  v_revenue_account_id uuid;
  v_cogs_account_id uuid;
  v_inventory_account_id uuid;
  v_journal_entry_id uuid;
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
    v_total_cogs := v_total_cogs + (v_line.quantity * coalesce(v_line.unit_cost, 0));
    insert into sales_invoice_lines (tenant_id, sales_invoice_id, product_id, quantity, uom_id, unit_price, line_total, unit_cost)
    values (v_delivery.tenant_id, v_invoice_id, v_line.product_id, v_line.quantity, v_line.uom_id, v_line.unit_price, v_line_total, v_line.unit_cost);
  end loop;

  update sales_invoices
    set subtotal = v_subtotal, total_amount = v_subtotal, status = 'posted'
    where id = v_invoice_id;

  update sales_orders set status = 'invoiced', updated_at = now() where id = v_order.id;

  select id into v_ar_account_id from chart_of_accounts where tenant_id = v_delivery.tenant_id and code = '1100';
  select id into v_revenue_account_id from chart_of_accounts where tenant_id = v_delivery.tenant_id and code = '4000';
  select id into v_cogs_account_id from chart_of_accounts where tenant_id = v_delivery.tenant_id and code = '5000';
  select id into v_inventory_account_id from chart_of_accounts where tenant_id = v_delivery.tenant_id and code = '1200';

  if v_subtotal > 0 and v_ar_account_id is not null and v_revenue_account_id is not null then
    insert into journal_entries (tenant_id, branch_id, entry_date, reference_type, reference_id, description, created_by)
    values (v_delivery.tenant_id, v_delivery.branch_id, current_date, 'sales_invoice', v_invoice_id, 'Sales invoice ' || p_invoice_number, auth.uid())
    returning id into v_journal_entry_id;

    insert into journal_entry_lines (tenant_id, journal_entry_id, account_id, debit, credit) values
      (v_delivery.tenant_id, v_journal_entry_id, v_ar_account_id, v_subtotal, 0),
      (v_delivery.tenant_id, v_journal_entry_id, v_revenue_account_id, 0, v_subtotal);
  end if;

  if v_total_cogs > 0 and v_cogs_account_id is not null and v_inventory_account_id is not null then
    insert into journal_entries (tenant_id, branch_id, entry_date, reference_type, reference_id, description, created_by)
    values (v_delivery.tenant_id, v_delivery.branch_id, current_date, 'sales_invoice', v_invoice_id, 'COGS for sales invoice ' || p_invoice_number, auth.uid())
    returning id into v_journal_entry_id;

    insert into journal_entry_lines (tenant_id, journal_entry_id, account_id, debit, credit) values
      (v_delivery.tenant_id, v_journal_entry_id, v_cogs_account_id, v_total_cogs, 0),
      (v_delivery.tenant_id, v_journal_entry_id, v_inventory_account_id, 0, v_total_cogs);
  end if;

  return v_invoice_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Payment journal posting: additive AFTER INSERT triggers alongside the
-- existing sync_sales_invoice_paid_amount/sync_purchase_invoice_paid_amount
-- triggers from 0021 (not modified) -- customer/supplier payments are
-- plain table inserts with no dedicated RPC, so a trigger is the existing
-- precedent for their side effects.
-- ---------------------------------------------------------------------------

create function post_customer_payment_journal_entry() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_cash_account_id uuid;
  v_ar_account_id uuid;
  v_journal_entry_id uuid;
begin
  select id into v_cash_account_id from chart_of_accounts where tenant_id = new.tenant_id and code = '1000';
  select id into v_ar_account_id from chart_of_accounts where tenant_id = new.tenant_id and code = '1100';

  if new.amount > 0 and v_cash_account_id is not null and v_ar_account_id is not null then
    insert into journal_entries (tenant_id, branch_id, entry_date, reference_type, reference_id, description, created_by)
    values (new.tenant_id, new.branch_id, new.payment_date, 'customer_payment', new.id, 'Customer payment' || case when new.reference is not null then ' ' || new.reference else '' end, new.created_by)
    returning id into v_journal_entry_id;

    insert into journal_entry_lines (tenant_id, journal_entry_id, account_id, debit, credit) values
      (new.tenant_id, v_journal_entry_id, v_cash_account_id, new.amount, 0),
      (new.tenant_id, v_journal_entry_id, v_ar_account_id, 0, new.amount);
  end if;

  return new;
end;
$$;

create trigger trg_post_customer_payment_journal_entry
  after insert on customer_payments
  for each row execute function post_customer_payment_journal_entry();

revoke execute on function post_customer_payment_journal_entry() from public, anon, authenticated;

create function post_supplier_payment_journal_entry() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_cash_account_id uuid;
  v_ap_account_id uuid;
  v_journal_entry_id uuid;
begin
  select id into v_cash_account_id from chart_of_accounts where tenant_id = new.tenant_id and code = '1000';
  select id into v_ap_account_id from chart_of_accounts where tenant_id = new.tenant_id and code = '2000';

  if new.amount > 0 and v_cash_account_id is not null and v_ap_account_id is not null then
    insert into journal_entries (tenant_id, branch_id, entry_date, reference_type, reference_id, description, created_by)
    values (new.tenant_id, new.branch_id, new.payment_date, 'supplier_payment', new.id, 'Supplier payment' || case when new.reference is not null then ' ' || new.reference else '' end, new.created_by)
    returning id into v_journal_entry_id;

    insert into journal_entry_lines (tenant_id, journal_entry_id, account_id, debit, credit) values
      (new.tenant_id, v_journal_entry_id, v_ap_account_id, new.amount, 0),
      (new.tenant_id, v_journal_entry_id, v_cash_account_id, 0, new.amount);
  end if;

  return new;
end;
$$;

create trigger trg_post_supplier_payment_journal_entry
  after insert on supplier_payments
  for each row execute function post_supplier_payment_journal_entry();

revoke execute on function post_supplier_payment_journal_entry() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- post_journal_entry: manual entry for everything auto-posting doesn't
-- cover yet (opening balances, corrections, operating expenses, returns/
-- adjustments/production/project-invoice postings until a future phase
-- wires those in). p_lines is a jsonb array of
-- {account_id, debit, credit, description}, mirroring the existing
-- p_slabs-jsonb-array precedent (complete_processing_job). Validates the
-- entry balances (sum debit = sum credit) before writing anything.
-- ---------------------------------------------------------------------------

create function post_journal_entry(
  p_tenant_id uuid,
  p_branch_id uuid,
  p_entry_date date,
  p_description text,
  p_lines jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_journal_entry_id uuid;
  v_line jsonb;
  v_total_debit numeric(18, 4) := 0;
  v_total_credit numeric(18, 4) := 0;
  v_debit numeric(18, 4);
  v_credit numeric(18, 4);
begin
  if not has_permission(p_tenant_id, 'accounting', 'create') then
    raise exception 'Missing permission: accounting.create';
  end if;
  if not has_branch_access(p_tenant_id, p_branch_id) then
    raise exception 'You do not have access to this branch';
  end if;
  if p_lines is null or jsonb_array_length(p_lines) < 2 then
    raise exception 'A journal entry requires at least two lines';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_debit := coalesce((v_line->>'debit')::numeric, 0);
    v_credit := coalesce((v_line->>'credit')::numeric, 0);
    if (v_debit = 0) = (v_credit = 0) then
      raise exception 'Each line must have exactly one of debit or credit set to a positive amount';
    end if;
    v_total_debit := v_total_debit + v_debit;
    v_total_credit := v_total_credit + v_credit;
  end loop;

  if v_total_debit <> v_total_credit then
    raise exception 'Journal entry does not balance: total debit % does not equal total credit %', v_total_debit, v_total_credit;
  end if;

  insert into journal_entries (tenant_id, branch_id, entry_date, reference_type, description, created_by)
  values (p_tenant_id, p_branch_id, coalesce(p_entry_date, current_date), 'manual', p_description, auth.uid())
  returning id into v_journal_entry_id;

  insert into journal_entry_lines (tenant_id, journal_entry_id, account_id, debit, credit, description)
  select p_tenant_id, v_journal_entry_id, (l->>'account_id')::uuid, coalesce((l->>'debit')::numeric, 0), coalesce((l->>'credit')::numeric, 0), l->>'description'
  from jsonb_array_elements(p_lines) as l;

  return v_journal_entry_id;
end;
$$;

revoke execute on function post_journal_entry(uuid, uuid, date, text, jsonb) from public, anon;

-- ---------------------------------------------------------------------------
-- reverse_journal_entry: never edit a posted entry -- create the mirror
-- image instead, referencing what it reverses. Rejects double-reversal.
-- ---------------------------------------------------------------------------

create function reverse_journal_entry(p_journal_entry_id uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_original journal_entries%rowtype;
  v_reversal_id uuid;
begin
  select * into v_original from journal_entries where id = p_journal_entry_id;
  if not found then
    raise exception 'Journal entry not found';
  end if;
  if not has_permission(v_original.tenant_id, 'accounting', 'edit') then
    raise exception 'Missing permission: accounting.edit';
  end if;
  if not has_branch_access(v_original.tenant_id, v_original.branch_id) then
    raise exception 'You do not have access to the branch of this journal entry';
  end if;
  if exists (select 1 from journal_entries where reverses_entry_id = p_journal_entry_id) then
    raise exception 'This journal entry has already been reversed';
  end if;

  insert into journal_entries (tenant_id, branch_id, entry_date, reference_type, reference_id, description, reverses_entry_id, created_by)
  values (v_original.tenant_id, v_original.branch_id, current_date, v_original.reference_type, v_original.reference_id,
    'Reversal of: ' || coalesce(v_original.description, '') || case when p_reason is not null then ' (' || p_reason || ')' else '' end,
    p_journal_entry_id, auth.uid())
  returning id into v_reversal_id;

  insert into journal_entry_lines (tenant_id, journal_entry_id, account_id, debit, credit, description)
  select tenant_id, v_reversal_id, account_id, credit, debit, description
  from journal_entry_lines where journal_entry_id = p_journal_entry_id;

  return v_reversal_id;
end;
$$;

revoke execute on function reverse_journal_entry(uuid, text) from public, anon;

-- ---------------------------------------------------------------------------
-- get_profit_and_loss / get_balance_sheet: reporting RPCs gated on
-- 'view_financial' (already in the Phase 0 action catalog). Deliberately
-- single-branch only (p_branch_id is required, not optional) -- a
-- company-wide, cross-branch aggregate would need to check every branch
-- the caller has access to, which no existing report in this codebase does
-- yet; left as a documented boundary rather than building an unverified
-- privilege surface.
--
-- get_balance_sheet includes a synthetic "Current Period Earnings" equity
-- line (revenue net minus expense net, cumulative to the as-of date): this
-- phase adds no period-close step that sweeps revenue/expense balances
-- into retained earnings, so without this line the balance sheet identity
-- (assets = liabilities + equity) would only hold by coincidence -- found
-- live during this phase's own verification (a real trading-loop test
-- produced assets of 1600 against liabilities+equity of 1200 before this
-- fix, off by exactly the 400 of unclosed net income) and fixed before the
-- migration was committed, the same in-place-fix-before-commit pattern
-- used for real bugs found in every prior phase.
-- ---------------------------------------------------------------------------

create function get_profit_and_loss(p_tenant_id uuid, p_branch_id uuid, p_start_date date, p_end_date date)
returns table (account_id uuid, code text, name text, account_type account_type, amount numeric)
language plpgsql security definer stable set search_path = public as $$
begin
  if not has_permission(p_tenant_id, 'accounting', 'view_financial') then
    raise exception 'Missing permission: accounting.view_financial';
  end if;
  if not has_branch_access(p_tenant_id, p_branch_id) then
    raise exception 'You do not have access to this branch';
  end if;

  return query
    select coa.id, coa.code, coa.name, coa.account_type,
      case when coa.account_type = 'revenue' then coalesce(sum(jel.credit - jel.debit), 0)
           else coalesce(sum(jel.debit - jel.credit), 0) end as amount
    from chart_of_accounts coa
    left join journal_entry_lines jel on jel.account_id = coa.id
    left join journal_entries je on je.id = jel.journal_entry_id
      and je.branch_id = p_branch_id and je.entry_date between p_start_date and p_end_date
    where coa.tenant_id = p_tenant_id and coa.account_type in ('revenue', 'expense')
    group by coa.id, coa.code, coa.name, coa.account_type
    order by coa.account_type, coa.code;
end;
$$;

revoke execute on function get_profit_and_loss(uuid, uuid, date, date) from public, anon;

create function get_balance_sheet(p_tenant_id uuid, p_branch_id uuid, p_as_of_date date)
returns table (account_id uuid, code text, name text, account_type account_type, amount numeric)
language plpgsql security definer stable set search_path = public as $$
begin
  if not has_permission(p_tenant_id, 'accounting', 'view_financial') then
    raise exception 'Missing permission: accounting.view_financial';
  end if;
  if not has_branch_access(p_tenant_id, p_branch_id) then
    raise exception 'You do not have access to this branch';
  end if;

  return query
    select coa.id, coa.code, coa.name, coa.account_type,
      case when coa.account_type = 'asset' then coalesce(sum(jel.debit - jel.credit), 0)
           else coalesce(sum(jel.credit - jel.debit), 0) end as amount
    from chart_of_accounts coa
    left join journal_entry_lines jel on jel.account_id = coa.id
    left join journal_entries je on je.id = jel.journal_entry_id
      and je.branch_id = p_branch_id and je.entry_date <= p_as_of_date
    where coa.tenant_id = p_tenant_id and coa.account_type in ('asset', 'liability', 'equity')
    group by coa.id, coa.code, coa.name, coa.account_type

    union all

    select null::uuid, '3999', 'Current Period Earnings', 'equity'::account_type,
      coalesce(sum(case when coa.account_type = 'revenue' then jel.credit - jel.debit
                         when coa.account_type = 'expense' then -(jel.debit - jel.credit)
                         else 0 end), 0)
    from chart_of_accounts coa
    join journal_entry_lines jel on jel.account_id = coa.id
    join journal_entries je on je.id = jel.journal_entry_id
      and je.branch_id = p_branch_id and je.entry_date <= p_as_of_date
    where coa.tenant_id = p_tenant_id and coa.account_type in ('revenue', 'expense')

    order by account_type, code;
end;
$$;

revoke execute on function get_balance_sheet(uuid, uuid, date) from public, anon;
