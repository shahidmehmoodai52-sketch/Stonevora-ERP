-- Phase 8 -- Reporting/Dashboards: cross-module analytics. Scoped, matching
-- the pattern this session and the user settled on for Phase 7, to the
-- backend/data layer this round -- eight reporting RPCs, live-SQL-verified
-- like every other phase. Actual dashboard UI (charts, KPI tiles) is a
-- separate, later frontend pass; every RPC here already returns exactly
-- the rows a dashboard screen would render directly.
--
-- No new permission resource: every report reuses the resource that
-- already owns its subject matter and the existing view/view_cost/
-- view_financial action split (Phase 0's own design) -- sales performance
-- under 'sales', inventory under 'product'/'warehouse', receivables/
-- payables aging under 'sales'/'purchasing' 'view_financial' (matching
-- how Phase 6 already gates P&L/Balance Sheet), and the unifying
-- dashboard summary under 'accounting' 'view_financial' since it exposes
-- company-wide revenue/profit figures, the same resource Phase 6 already
-- uses for exactly that class of report.
--
-- Branch scoping follows the underlying data, not a blanket rule: sales
-- reports take a required p_branch_id (sales_orders/sales_invoices are
-- branch-scoped, matching Phase 6/7's own "single branch, not an
-- unverified cross-branch aggregate" precedent). Inventory valuation and
-- low-stock are tenant-wide with NO branch parameter -- inventory_stock/
-- inventory_batches/inventory_units RLS itself is tenant-wide only (no
-- branch_id, confirmed by their own 0009 policies), so a report over them
-- can't be branch-scoped without inventing a scoping dimension the
-- underlying tables don't have. Payables aging is also tenant-wide for
-- the same structural reason: purchase_invoices carries no branch_id at
-- all (a pre-existing characteristic of that table, not new here -- it
-- also has no creation path in the app yet, noted during Phase 6's own
-- research; this report is written correctly against the schema as
-- designed and will simply be empty until that gap is closed).
--
-- get_dashboard_summary reuses get_profit_and_loss (Phase 6) internally
-- for revenue/COGS rather than re-deriving them from source tables a
-- second time -- one source of truth for "what is revenue for this
-- period," not two that could drift.
--
-- One small schema addition: products.reorder_point (nullable, tenant/
-- caller-set) -- the low-stock report needs a threshold to compare
-- against, and none existed; never invented as a computed default, only
-- ever read back as whatever the caller explicitly set.

alter table products add column reorder_point numeric(18, 4);

-- ---------------------------------------------------------------------------
-- get_sales_summary: top-line sales performance for one branch over one
-- date range. total_revenue is realized revenue (posted invoices), not
-- order value, matching accounting's own revenue-recognition point
-- (Phase 6 posts revenue at invoicing, not at order confirmation).
-- ---------------------------------------------------------------------------

create function get_sales_summary(p_tenant_id uuid, p_branch_id uuid, p_start_date date, p_end_date date)
returns table (order_count bigint, invoice_count bigint, total_revenue numeric, avg_invoice_value numeric)
language plpgsql security definer stable set search_path = public as $$
begin
  if not has_permission(p_tenant_id, 'sales', 'view') then
    raise exception 'Missing permission: sales.view';
  end if;
  if not has_branch_access(p_tenant_id, p_branch_id) then
    raise exception 'You do not have access to this branch';
  end if;

  return query
    select
      (select count(*) from sales_orders so where so.tenant_id = p_tenant_id and so.branch_id = p_branch_id
        and so.order_date between p_start_date and p_end_date and so.status <> 'cancelled'),
      (select count(*) from sales_invoices si where si.tenant_id = p_tenant_id and si.branch_id = p_branch_id
        and si.invoice_date between p_start_date and p_end_date and si.status <> 'cancelled'),
      coalesce((select sum(si.total_amount) from sales_invoices si where si.tenant_id = p_tenant_id and si.branch_id = p_branch_id
        and si.invoice_date between p_start_date and p_end_date and si.status <> 'cancelled'), 0),
      case when (select count(*) from sales_invoices si where si.tenant_id = p_tenant_id and si.branch_id = p_branch_id
        and si.invoice_date between p_start_date and p_end_date and si.status <> 'cancelled') > 0
        then (select sum(si.total_amount) from sales_invoices si where si.tenant_id = p_tenant_id and si.branch_id = p_branch_id
          and si.invoice_date between p_start_date and p_end_date and si.status <> 'cancelled')
          / (select count(*) from sales_invoices si where si.tenant_id = p_tenant_id and si.branch_id = p_branch_id
            and si.invoice_date between p_start_date and p_end_date and si.status <> 'cancelled')
        else 0 end;
end;
$$;

revoke execute on function get_sales_summary(uuid, uuid, date, date) from public, anon;

-- ---------------------------------------------------------------------------
-- get_top_customers / get_top_products: ranked by realized revenue over a
-- date range, same posted-invoice source as get_sales_summary.
-- ---------------------------------------------------------------------------

create function get_top_customers(p_tenant_id uuid, p_branch_id uuid, p_start_date date, p_end_date date, p_limit int default 10)
returns table (customer_id uuid, customer_name text, invoice_count bigint, total_revenue numeric)
language plpgsql security definer stable set search_path = public as $$
begin
  if not has_permission(p_tenant_id, 'sales', 'view') then
    raise exception 'Missing permission: sales.view';
  end if;
  if not has_branch_access(p_tenant_id, p_branch_id) then
    raise exception 'You do not have access to this branch';
  end if;

  return query
    select c.id, c.name, count(si.id), sum(si.total_amount)
    from sales_invoices si
    join customers c on c.id = si.customer_id
    where si.tenant_id = p_tenant_id and si.branch_id = p_branch_id
      and si.invoice_date between p_start_date and p_end_date and si.status <> 'cancelled'
    group by c.id, c.name
    order by sum(si.total_amount) desc
    limit p_limit;
end;
$$;

revoke execute on function get_top_customers(uuid, uuid, date, date, int) from public, anon;

create function get_top_products(p_tenant_id uuid, p_branch_id uuid, p_start_date date, p_end_date date, p_limit int default 10)
returns table (product_id uuid, sku text, name text, qty_sold numeric, total_revenue numeric)
language plpgsql security definer stable set search_path = public as $$
begin
  if not has_permission(p_tenant_id, 'sales', 'view') then
    raise exception 'Missing permission: sales.view';
  end if;
  if not has_branch_access(p_tenant_id, p_branch_id) then
    raise exception 'You do not have access to this branch';
  end if;

  return query
    select p.id, p.sku, p.name, sum(sil.quantity), sum(sil.line_total)
    from sales_invoice_lines sil
    join sales_invoices si on si.id = sil.sales_invoice_id
    join products p on p.id = sil.product_id
    where si.tenant_id = p_tenant_id and si.branch_id = p_branch_id
      and si.invoice_date between p_start_date and p_end_date and si.status <> 'cancelled'
    group by p.id, p.sku, p.name
    order by sum(sil.line_total) desc
    limit p_limit;
end;
$$;

revoke execute on function get_top_products(uuid, uuid, date, date, int) from public, anon;

-- ---------------------------------------------------------------------------
-- get_inventory_valuation: current stock value across all three tracking
-- paradigms, at each row's own recorded cost -- never a recomputed or
-- invented figure. Tenant-wide (see header note); gated on 'view_cost'
-- since unit cost is exactly the class of field products_secure already
-- redacts for roles without it.
-- ---------------------------------------------------------------------------

create function get_inventory_valuation(p_tenant_id uuid)
returns table (product_id uuid, sku text, name text, tracking_mode inventory_tracking_mode, qty_on_hand numeric, total_value numeric)
language plpgsql security definer stable set search_path = public as $$
begin
  if not has_permission(p_tenant_id, 'product', 'view_cost') then
    raise exception 'Missing permission: product.view_cost';
  end if;

  -- Note: the OUT parameter list above declares plpgsql variables named
  -- product_id/qty_on_hand, which shadow the identically-named table
  -- columns in these subqueries -- every reference to either must be
  -- table-qualified (inventory_stock.product_id, not bare product_id) or
  -- Postgres raises "column reference is ambiguous". Found live-testing
  -- this RPC for the first time.
  return query
    select p.id, p.sku, p.name, p.inventory_tracking_mode,
      coalesce(s.qty, 0) + coalesce(b.qty, 0) + coalesce(u.qty, 0),
      coalesce(s.value, 0) + coalesce(b.value, 0) + coalesce(u.value, 0)
    from products p
    left join (
      select inventory_stock.product_id, sum(inventory_stock.qty_on_hand) as qty, sum(inventory_stock.qty_on_hand * inventory_stock.avg_cost) as value
      from inventory_stock where tenant_id = p_tenant_id group by inventory_stock.product_id
    ) s on s.product_id = p.id
    left join (
      select inventory_batches.product_id, sum(inventory_batches.qty_on_hand) as qty, sum(inventory_batches.qty_on_hand * inventory_batches.cost_per_uom) as value
      from inventory_batches where tenant_id = p_tenant_id and status = 'in_stock' group by inventory_batches.product_id
    ) b on b.product_id = p.id
    left join (
      select inventory_units.product_id, count(*) as qty, sum(coalesce(inventory_units.cost, 0)) as value
      from inventory_units where tenant_id = p_tenant_id and status = 'in_stock' group by inventory_units.product_id
    ) u on u.product_id = p.id
    where p.tenant_id = p_tenant_id and (coalesce(s.qty, 0) + coalesce(b.qty, 0) + coalesce(u.qty, 0)) > 0
    order by (coalesce(s.value, 0) + coalesce(b.value, 0) + coalesce(u.value, 0)) desc;
end;
$$;

revoke execute on function get_inventory_valuation(uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- get_low_stock_report: products whose combined on-hand quantity has
-- fallen below their own explicit reorder_point. Products with no
-- reorder_point set are silently excluded -- no threshold was ever
-- invented for them. Tenant-wide (see header note); gated on 'warehouse'.
-- 'view' since only quantities, not cost, are exposed.
-- ---------------------------------------------------------------------------

create function get_low_stock_report(p_tenant_id uuid)
returns table (product_id uuid, sku text, name text, qty_on_hand numeric, reorder_point numeric, shortfall numeric)
language plpgsql security definer stable set search_path = public as $$
begin
  if not has_permission(p_tenant_id, 'warehouse', 'view') then
    raise exception 'Missing permission: warehouse.view';
  end if;

  -- Same OUT-parameter shadowing as get_inventory_valuation above --
  -- product_id/qty_on_hand must be table-qualified in these subqueries.
  return query
    select p.id, p.sku, p.name, coalesce(s.qty, 0) + coalesce(b.qty, 0), p.reorder_point, p.reorder_point - (coalesce(s.qty, 0) + coalesce(b.qty, 0))
    from products p
    left join (
      select inventory_stock.product_id, sum(inventory_stock.qty_on_hand) as qty from inventory_stock where tenant_id = p_tenant_id group by inventory_stock.product_id
    ) s on s.product_id = p.id
    left join (
      select inventory_batches.product_id, sum(inventory_batches.qty_on_hand) as qty from inventory_batches where tenant_id = p_tenant_id and status = 'in_stock' group by inventory_batches.product_id
    ) b on b.product_id = p.id
    where p.tenant_id = p_tenant_id and p.reorder_point is not null
      and (coalesce(s.qty, 0) + coalesce(b.qty, 0)) < p.reorder_point
    order by (p.reorder_point - (coalesce(s.qty, 0) + coalesce(b.qty, 0))) desc;
end;
$$;

revoke execute on function get_low_stock_report(uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- get_receivables_aging / get_payables_aging: standard 0-30/31-60/61-90/
-- 90+ day buckets, keyed off each invoice's own due_date (falling back to
-- invoice_date when due_date was never set, so an undated invoice still
-- ages instead of being silently dropped). Only invoices with a
-- balance still owed (total_amount > amount_paid) are included.
-- ---------------------------------------------------------------------------

create function get_receivables_aging(p_tenant_id uuid, p_branch_id uuid)
returns table (customer_id uuid, customer_name text, current_amount numeric, days_1_30 numeric, days_31_60 numeric, days_61_90 numeric, days_over_90 numeric, total_outstanding numeric)
language plpgsql security definer stable set search_path = public as $$
begin
  if not has_permission(p_tenant_id, 'sales', 'view_financial') then
    raise exception 'Missing permission: sales.view_financial';
  end if;
  if not has_branch_access(p_tenant_id, p_branch_id) then
    raise exception 'You do not have access to this branch';
  end if;

  return query
    select
      c.id, c.name,
      coalesce(sum(case when current_date - coalesce(si.due_date, si.invoice_date) <= 0 then si.total_amount - si.amount_paid else 0 end), 0),
      coalesce(sum(case when current_date - coalesce(si.due_date, si.invoice_date) between 1 and 30 then si.total_amount - si.amount_paid else 0 end), 0),
      coalesce(sum(case when current_date - coalesce(si.due_date, si.invoice_date) between 31 and 60 then si.total_amount - si.amount_paid else 0 end), 0),
      coalesce(sum(case when current_date - coalesce(si.due_date, si.invoice_date) between 61 and 90 then si.total_amount - si.amount_paid else 0 end), 0),
      coalesce(sum(case when current_date - coalesce(si.due_date, si.invoice_date) > 90 then si.total_amount - si.amount_paid else 0 end), 0),
      coalesce(sum(si.total_amount - si.amount_paid), 0)
    from sales_invoices si
    join customers c on c.id = si.customer_id
    where si.tenant_id = p_tenant_id and si.branch_id = p_branch_id
      and si.status <> 'cancelled' and si.total_amount > si.amount_paid
    group by c.id, c.name
    order by sum(si.total_amount - si.amount_paid) desc;
end;
$$;

revoke execute on function get_receivables_aging(uuid, uuid) from public, anon;

create function get_payables_aging(p_tenant_id uuid)
returns table (supplier_id uuid, supplier_name text, current_amount numeric, days_1_30 numeric, days_31_60 numeric, days_61_90 numeric, days_over_90 numeric, total_outstanding numeric)
language plpgsql security definer stable set search_path = public as $$
begin
  if not has_permission(p_tenant_id, 'purchasing', 'view_financial') then
    raise exception 'Missing permission: purchasing.view_financial';
  end if;

  return query
    select
      s.id, s.name,
      coalesce(sum(case when current_date - coalesce(pi.due_date, pi.invoice_date) <= 0 then pi.total_amount - pi.amount_paid else 0 end), 0),
      coalesce(sum(case when current_date - coalesce(pi.due_date, pi.invoice_date) between 1 and 30 then pi.total_amount - pi.amount_paid else 0 end), 0),
      coalesce(sum(case when current_date - coalesce(pi.due_date, pi.invoice_date) between 31 and 60 then pi.total_amount - pi.amount_paid else 0 end), 0),
      coalesce(sum(case when current_date - coalesce(pi.due_date, pi.invoice_date) between 61 and 90 then pi.total_amount - pi.amount_paid else 0 end), 0),
      coalesce(sum(case when current_date - coalesce(pi.due_date, pi.invoice_date) > 90 then pi.total_amount - pi.amount_paid else 0 end), 0),
      coalesce(sum(pi.total_amount - pi.amount_paid), 0)
    from purchase_invoices pi
    join suppliers s on s.id = pi.supplier_id
    where pi.tenant_id = p_tenant_id and pi.total_amount > pi.amount_paid
    group by s.id, s.name
    order by sum(pi.total_amount - pi.amount_paid) desc;
end;
$$;

revoke execute on function get_payables_aging(uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- get_dashboard_summary: the single call a dashboard's top KPI row would
-- make. Revenue/gross_profit are read from get_profit_and_loss (Phase 6)
-- rather than re-derived, so this can never disagree with the P&L report
-- itself. Gated on 'accounting'.'view_financial', the same resource/action
-- Phase 6 already uses for company-wide financial figures. low_stock_count
-- is computed inline (the same query get_low_stock_report itself runs)
-- rather than by calling that RPC -- it carries its own separate
-- 'warehouse'.'view' gate, and a caller with only accounting.view_financial
-- (a finance-only role, say) would otherwise see this whole summary fail
-- on a permission it was never meant to need for a single sub-count.
-- ---------------------------------------------------------------------------

create function get_dashboard_summary(p_tenant_id uuid, p_branch_id uuid, p_start_date date, p_end_date date)
returns table (
  total_revenue numeric, total_cogs numeric, gross_profit numeric,
  open_sales_orders bigint, open_purchase_orders bigint,
  outstanding_receivables numeric, outstanding_payables numeric,
  low_stock_count bigint
)
language plpgsql security definer stable set search_path = public as $$
declare
  v_revenue numeric := 0;
  v_cogs numeric := 0;
begin
  if not has_permission(p_tenant_id, 'accounting', 'view_financial') then
    raise exception 'Missing permission: accounting.view_financial';
  end if;
  if not has_branch_access(p_tenant_id, p_branch_id) then
    raise exception 'You do not have access to this branch';
  end if;

  select coalesce(sum(amount) filter (where account_type = 'revenue'), 0), coalesce(sum(amount) filter (where account_type = 'expense'), 0)
    into v_revenue, v_cogs
    from get_profit_and_loss(p_tenant_id, p_branch_id, p_start_date, p_end_date);

  return query
    select
      v_revenue, v_cogs, v_revenue - v_cogs,
      (select count(*) from sales_orders so where so.tenant_id = p_tenant_id and so.branch_id = p_branch_id and so.status in ('draft', 'confirmed', 'partially_delivered')),
      (select count(*) from purchase_orders po where po.tenant_id = p_tenant_id and po.branch_id = p_branch_id and po.status in ('draft', 'confirmed', 'partially_received')),
      (select coalesce(sum(si.total_amount - si.amount_paid), 0) from sales_invoices si where si.tenant_id = p_tenant_id and si.branch_id = p_branch_id and si.status <> 'cancelled' and si.total_amount > si.amount_paid),
      (select coalesce(sum(pi.total_amount - pi.amount_paid), 0) from purchase_invoices pi where pi.tenant_id = p_tenant_id and pi.total_amount > pi.amount_paid),
      (select count(*) from products p
        left join (select product_id, sum(qty_on_hand) as qty from inventory_stock where tenant_id = p_tenant_id group by product_id) s on s.product_id = p.id
        left join (select product_id, sum(qty_on_hand) as qty from inventory_batches where tenant_id = p_tenant_id and status = 'in_stock' group by product_id) b on b.product_id = p.id
        where p.tenant_id = p_tenant_id and p.reorder_point is not null and (coalesce(s.qty, 0) + coalesce(b.qty, 0)) < p.reorder_point);
end;
$$;

revoke execute on function get_dashboard_summary(uuid, uuid, date, date) from public, anon;
