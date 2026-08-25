-- Phase 1 RLS: identical pattern to every Phase 0 table — enable RLS, then
-- select/insert/update/delete policies built on is_tenant_member() +
-- has_permission(tenant_id, resource, action). 'purchasing' covers the buy-side
-- (suppliers, POs, GRNs, purchase invoices, supplier payments); 'sales' covers
-- the sell-side (customers, price lists, sales orders, deliveries, sales
-- invoices, customer payments).

-- suppliers, purchase_orders, purchase_order_lines, goods_receipts,
-- goods_receipt_lines, purchase_invoices, supplier_payments -> 'purchasing'

alter table suppliers enable row level security;
create policy suppliers_select on suppliers for select using (is_tenant_member(tenant_id));
create policy suppliers_insert on suppliers for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'purchasing', 'create'));
create policy suppliers_update on suppliers for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'purchasing', 'edit'))
  with check (is_tenant_member(tenant_id));
create policy suppliers_delete on suppliers for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'purchasing', 'delete'));

alter table purchase_orders enable row level security;
create policy purchase_orders_select on purchase_orders for select using (is_tenant_member(tenant_id));
create policy purchase_orders_insert on purchase_orders for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'purchasing', 'create'));
create policy purchase_orders_update on purchase_orders for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'purchasing', 'edit'))
  with check (is_tenant_member(tenant_id));
create policy purchase_orders_delete on purchase_orders for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'purchasing', 'delete'));

alter table purchase_order_lines enable row level security;
create policy purchase_order_lines_select on purchase_order_lines for select using (is_tenant_member(tenant_id));
create policy purchase_order_lines_insert on purchase_order_lines for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'purchasing', 'create'));
create policy purchase_order_lines_update on purchase_order_lines for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'purchasing', 'edit'))
  with check (is_tenant_member(tenant_id));
create policy purchase_order_lines_delete on purchase_order_lines for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'purchasing', 'delete'));

alter table goods_receipts enable row level security;
create policy goods_receipts_select on goods_receipts for select using (is_tenant_member(tenant_id));
create policy goods_receipts_insert on goods_receipts for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'purchasing', 'create'));
create policy goods_receipts_update on goods_receipts for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'purchasing', 'edit'))
  with check (is_tenant_member(tenant_id));
create policy goods_receipts_delete on goods_receipts for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'purchasing', 'delete'));

alter table goods_receipt_lines enable row level security;
create policy goods_receipt_lines_select on goods_receipt_lines for select using (is_tenant_member(tenant_id));
create policy goods_receipt_lines_insert on goods_receipt_lines for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'purchasing', 'create'));
create policy goods_receipt_lines_update on goods_receipt_lines for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'purchasing', 'edit'))
  with check (is_tenant_member(tenant_id));
create policy goods_receipt_lines_delete on goods_receipt_lines for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'purchasing', 'delete'));

alter table purchase_invoices enable row level security;
create policy purchase_invoices_select on purchase_invoices for select using (is_tenant_member(tenant_id));
create policy purchase_invoices_insert on purchase_invoices for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'purchasing', 'create'));
create policy purchase_invoices_update on purchase_invoices for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'purchasing', 'edit'))
  with check (is_tenant_member(tenant_id));
create policy purchase_invoices_delete on purchase_invoices for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'purchasing', 'delete'));

alter table supplier_payments enable row level security;
create policy supplier_payments_select on supplier_payments for select using (is_tenant_member(tenant_id));
create policy supplier_payments_insert on supplier_payments for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'purchasing', 'create'));
create policy supplier_payments_update on supplier_payments for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'purchasing', 'edit'))
  with check (is_tenant_member(tenant_id));
create policy supplier_payments_delete on supplier_payments for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'purchasing', 'delete'));

-- customers, price_lists, price_list_items, sales_orders, sales_order_lines,
-- deliveries, delivery_lines, sales_invoices, sales_invoice_lines,
-- customer_payments -> 'sales'

alter table customers enable row level security;
create policy customers_select on customers for select using (is_tenant_member(tenant_id));
create policy customers_insert on customers for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'create'));
create policy customers_update on customers for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'edit'))
  with check (is_tenant_member(tenant_id));
create policy customers_delete on customers for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'delete'));

alter table price_lists enable row level security;
create policy price_lists_select on price_lists for select using (is_tenant_member(tenant_id));
create policy price_lists_insert on price_lists for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'create'));
create policy price_lists_update on price_lists for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'edit'))
  with check (is_tenant_member(tenant_id));
create policy price_lists_delete on price_lists for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'delete'));

alter table price_list_items enable row level security;
create policy price_list_items_select on price_list_items for select using (is_tenant_member(tenant_id));
create policy price_list_items_insert on price_list_items for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'create'));
create policy price_list_items_update on price_list_items for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'edit'))
  with check (is_tenant_member(tenant_id));
create policy price_list_items_delete on price_list_items for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'delete'));

alter table sales_orders enable row level security;
create policy sales_orders_select on sales_orders for select using (is_tenant_member(tenant_id));
create policy sales_orders_insert on sales_orders for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'create'));
create policy sales_orders_update on sales_orders for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'edit'))
  with check (is_tenant_member(tenant_id));
create policy sales_orders_delete on sales_orders for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'delete'));

alter table sales_order_lines enable row level security;
create policy sales_order_lines_select on sales_order_lines for select using (is_tenant_member(tenant_id));
create policy sales_order_lines_insert on sales_order_lines for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'create'));
create policy sales_order_lines_update on sales_order_lines for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'edit'))
  with check (is_tenant_member(tenant_id));
create policy sales_order_lines_delete on sales_order_lines for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'delete'));

alter table deliveries enable row level security;
create policy deliveries_select on deliveries for select using (is_tenant_member(tenant_id));
create policy deliveries_insert on deliveries for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'create'));
create policy deliveries_update on deliveries for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'edit'))
  with check (is_tenant_member(tenant_id));
create policy deliveries_delete on deliveries for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'delete'));

alter table delivery_lines enable row level security;
create policy delivery_lines_select on delivery_lines for select using (is_tenant_member(tenant_id));
create policy delivery_lines_insert on delivery_lines for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'create'));
create policy delivery_lines_update on delivery_lines for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'edit'))
  with check (is_tenant_member(tenant_id));
create policy delivery_lines_delete on delivery_lines for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'delete'));

alter table sales_invoices enable row level security;
create policy sales_invoices_select on sales_invoices for select using (is_tenant_member(tenant_id));
create policy sales_invoices_insert on sales_invoices for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'create'));
create policy sales_invoices_update on sales_invoices for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'edit'))
  with check (is_tenant_member(tenant_id));
create policy sales_invoices_delete on sales_invoices for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'delete'));

alter table sales_invoice_lines enable row level security;
create policy sales_invoice_lines_select on sales_invoice_lines for select using (is_tenant_member(tenant_id));
create policy sales_invoice_lines_insert on sales_invoice_lines for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'create'));
create policy sales_invoice_lines_update on sales_invoice_lines for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'edit'))
  with check (is_tenant_member(tenant_id));
create policy sales_invoice_lines_delete on sales_invoice_lines for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'delete'));

alter table customer_payments enable row level security;
create policy customer_payments_select on customer_payments for select using (is_tenant_member(tenant_id));
create policy customer_payments_insert on customer_payments for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'create'));
create policy customer_payments_update on customer_payments for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'edit'))
  with check (is_tenant_member(tenant_id));
create policy customer_payments_delete on customer_payments for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'delete'));
