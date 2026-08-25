-- Performance advisor: covering indexes for Phase 1's flagged foreign keys —
-- tenant_id on every line table (backs every RLS policy's is_tenant_member()
-- check) and created_by on every header table.

create index idx_customer_payments_created_by on customer_payments (created_by);
create index idx_customer_payments_tenant_id on customer_payments (tenant_id);
create index idx_deliveries_created_by on deliveries (created_by);
create index idx_delivery_lines_tenant_id on delivery_lines (tenant_id);
create index idx_goods_receipt_lines_tenant_id on goods_receipt_lines (tenant_id);
create index idx_goods_receipts_created_by on goods_receipts (created_by);
create index idx_purchase_invoices_created_by on purchase_invoices (created_by);
create index idx_purchase_order_lines_tenant_id on purchase_order_lines (tenant_id);
create index idx_purchase_orders_created_by on purchase_orders (created_by);
create index idx_sales_invoice_lines_tenant_id on sales_invoice_lines (tenant_id);
create index idx_sales_invoices_created_by on sales_invoices (created_by);
create index idx_sales_order_lines_tenant_id on sales_order_lines (tenant_id);
create index idx_sales_orders_created_by on sales_orders (created_by);
create index idx_supplier_payments_created_by on supplier_payments (created_by);
create index idx_supplier_payments_tenant_id on supplier_payments (tenant_id);
