-- Phase 1 (Trading/Distribution): customer receipts and supplier payments.
-- Two dedicated tables rather than one polymorphic "payments" table — matches
-- the existing inventory_units/inventory_batches/inventory_stock precedent of
-- using a clean domain model per concept instead of one generic table trying
-- to represent every case.

create table customer_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  branch_id uuid not null references branches (id),
  customer_id uuid not null references customers (id),
  sales_invoice_id uuid references sales_invoices (id), -- null = on-account payment
  amount numeric(18, 4) not null,
  payment_date date not null default current_date,
  method text,
  reference text,
  notes text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create table supplier_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  branch_id uuid not null references branches (id),
  supplier_id uuid not null references suppliers (id),
  purchase_invoice_id uuid references purchase_invoices (id),
  amount numeric(18, 4) not null,
  payment_date date not null default current_date,
  method text,
  reference text,
  notes text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create index idx_customer_payments_branch_id on customer_payments (branch_id);
create index idx_customer_payments_customer_id on customer_payments (customer_id);
create index idx_customer_payments_sales_invoice_id on customer_payments (sales_invoice_id);
create index idx_supplier_payments_branch_id on supplier_payments (branch_id);
create index idx_supplier_payments_supplier_id on supplier_payments (supplier_id);
create index idx_supplier_payments_purchase_invoice_id on supplier_payments (purchase_invoice_id);

-- Keep invoice amount_paid/status in sync with recorded payments automatically —
-- the app never has to remember to update the invoice after inserting a payment.
create function sync_sales_invoice_paid_amount() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_invoice_id uuid := coalesce(new.sales_invoice_id, old.sales_invoice_id);
  v_total_paid numeric(18, 4);
  v_total_amount numeric(18, 4);
begin
  if v_invoice_id is null then
    return coalesce(new, old);
  end if;

  select coalesce(sum(amount), 0) into v_total_paid
  from customer_payments where sales_invoice_id = v_invoice_id;

  select total_amount into v_total_amount from sales_invoices where id = v_invoice_id;

  update sales_invoices
  set amount_paid = v_total_paid,
      status = case
        when v_total_paid <= 0 then 'posted'
        when v_total_paid >= v_total_amount then 'paid'
        else 'partially_paid'
      end
  where id = v_invoice_id and status <> 'cancelled';

  return coalesce(new, old);
end;
$$;

create trigger trg_sync_sales_invoice_paid_amount
  after insert or update or delete on customer_payments
  for each row execute function sync_sales_invoice_paid_amount();

create function sync_purchase_invoice_paid_amount() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_invoice_id uuid := coalesce(new.purchase_invoice_id, old.purchase_invoice_id);
  v_total_paid numeric(18, 4);
  v_total_amount numeric(18, 4);
begin
  if v_invoice_id is null then
    return coalesce(new, old);
  end if;

  select coalesce(sum(amount), 0) into v_total_paid
  from supplier_payments where purchase_invoice_id = v_invoice_id;

  select total_amount into v_total_amount from purchase_invoices where id = v_invoice_id;

  update purchase_invoices
  set amount_paid = v_total_paid,
      status = case
        when v_total_paid <= 0 then 'posted'
        when v_total_paid >= v_total_amount then 'paid'
        else 'partially_paid'
      end
  where id = v_invoice_id;

  return coalesce(new, old);
end;
$$;

create trigger trg_sync_purchase_invoice_paid_amount
  after insert or update or delete on supplier_payments
  for each row execute function sync_purchase_invoice_paid_amount();
