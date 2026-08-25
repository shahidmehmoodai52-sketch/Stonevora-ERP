-- Financial redaction for the sales side (mirrors products_secure from Phase 0):
-- unit_cost on invoice lines is the COGS snapshot, gated by view_cost/view_profit
-- so a salesperson can open an invoice without ever seeing what a line cost.
-- Purchasing data is intentionally NOT redacted this way — purchasing staff
-- necessarily need to see purchase cost to do their job; the protection this
-- spec cares about is cost leaking to the SALES side, not purchasing seeing its
-- own numbers.

create view sales_invoice_lines_secure
with (security_invoker = true) as
select
  l.id, l.tenant_id, l.sales_invoice_id, l.product_id, l.description,
  l.quantity, l.uom_id, l.unit_price, l.line_total,
  case when has_permission(l.tenant_id, 'sales', 'view_cost') or has_permission(l.tenant_id, 'sales', 'view_profit')
    then l.unit_cost else null end as unit_cost,
  case when has_permission(l.tenant_id, 'sales', 'view_profit')
    then l.line_total - (l.quantity * l.unit_cost) else null end as margin,
  l.created_at
from sales_invoice_lines l;

-- Customer/supplier ledger: a computed running balance from invoices and
-- payments rather than a duplicated ledger table that could drift out of sync.
-- Full double-entry general-ledger accounting (Chart of Accounts, journals) is
-- explicitly a later phase — this is the AR/AP-level ledger a trading business
-- needs day to day. security_invoker means each viewer only ever sees rows
-- their own RLS grants already allow through sales_invoices/customer_payments.

create view customer_ledger
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
) combined;

create view supplier_ledger
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
) combined;
