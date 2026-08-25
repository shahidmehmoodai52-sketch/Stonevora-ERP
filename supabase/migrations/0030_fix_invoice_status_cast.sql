-- Bug fix caught by live integration testing: the CASE expression assigning
-- sales_invoices.status/purchase_invoices.status used plain text literals with
-- no cast, and Postgres could not infer the enum target type in this context
-- ("column is of type sales_invoice_status but expression is of type text").
-- Every other status-assigning CASE in this codebase (post_goods_receipt,
-- confirm_sales_order, dispatch_delivery) already casts explicitly — these two
-- trigger functions were the one place that didn't.

create or replace function sync_sales_invoice_paid_amount() returns trigger
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
        when v_total_paid <= 0 then 'posted'::sales_invoice_status
        when v_total_paid >= v_total_amount then 'paid'::sales_invoice_status
        else 'partially_paid'::sales_invoice_status
      end
  where id = v_invoice_id and status <> 'cancelled';

  return coalesce(new, old);
end;
$$;

create or replace function sync_purchase_invoice_paid_amount() returns trigger
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
        when v_total_paid <= 0 then 'posted'::purchase_invoice_status
        when v_total_paid >= v_total_amount then 'paid'::purchase_invoice_status
        else 'partially_paid'::purchase_invoice_status
      end
  where id = v_invoice_id;

  return coalesce(new, old);
end;
$$;
