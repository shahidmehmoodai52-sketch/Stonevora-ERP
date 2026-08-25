-- Foundation hardening #2 (pre-Block/Slab): enforce user_roles.branch_id at
-- the database layer. Per docs/PRE_FACTORY_ARCHITECTURE_AUDIT.md section 11:
-- user_roles.branch_id has existed since Phase 0 ("optional: scope a role to
-- one branch") but was never read by has_permission() or by any RLS policy --
-- a role scoped to Branch A could act on Branch B's purchase/sales/payment
-- records through the same policies that correctly stop cross-tenant access.
--
-- This does NOT replace or weaken is_tenant_member()/has_permission() -- both
-- are preserved exactly as-is. has_branch_access() is a new, independent
-- check ANDed on top, on the specific tables that carry a branch_id.
--
-- Backward compatible by construction: a user with no branch-scoped role at
-- all (branch_id is null on every one of their role rows -- true for every
-- tenant today, since nothing has ever written a non-null branch_id) keeps
-- exactly the same access as before. The restriction only engages once a
-- tenant actually assigns a role to a specific branch.
create function has_branch_access(check_tenant_id uuid, check_branch_id uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from user_roles ur
    where ur.tenant_id = check_tenant_id
      and ur.user_id = auth.uid()
      and (ur.branch_id is null or ur.branch_id = check_branch_id)
  );
$$;

revoke execute on function has_branch_access(uuid, uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- Header tables with a direct branch_id column.
-- (purchase_invoices is intentionally excluded -- it has no branch_id column
-- and no non-nullable way to derive one; documented in the audit as an
-- acknowledged gap, not silently skipped.)
-- ---------------------------------------------------------------------------

drop policy purchase_orders_select on purchase_orders;
drop policy purchase_orders_insert on purchase_orders;
drop policy purchase_orders_update on purchase_orders;
drop policy purchase_orders_delete on purchase_orders;
create policy purchase_orders_select on purchase_orders for select
  using (is_tenant_member(tenant_id) and has_branch_access(tenant_id, branch_id));
create policy purchase_orders_insert on purchase_orders for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'purchasing', 'create') and has_branch_access(tenant_id, branch_id));
create policy purchase_orders_update on purchase_orders for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'purchasing', 'edit') and has_branch_access(tenant_id, branch_id))
  with check (is_tenant_member(tenant_id) and has_branch_access(tenant_id, branch_id));
create policy purchase_orders_delete on purchase_orders for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'purchasing', 'delete') and has_branch_access(tenant_id, branch_id));

drop policy goods_receipts_select on goods_receipts;
drop policy goods_receipts_insert on goods_receipts;
drop policy goods_receipts_update on goods_receipts;
drop policy goods_receipts_delete on goods_receipts;
create policy goods_receipts_select on goods_receipts for select
  using (is_tenant_member(tenant_id) and has_branch_access(tenant_id, branch_id));
create policy goods_receipts_insert on goods_receipts for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'purchasing', 'create') and has_branch_access(tenant_id, branch_id));
create policy goods_receipts_update on goods_receipts for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'purchasing', 'edit') and has_branch_access(tenant_id, branch_id))
  with check (is_tenant_member(tenant_id) and has_branch_access(tenant_id, branch_id));
create policy goods_receipts_delete on goods_receipts for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'purchasing', 'delete') and has_branch_access(tenant_id, branch_id));

drop policy sales_orders_select on sales_orders;
drop policy sales_orders_insert on sales_orders;
drop policy sales_orders_update on sales_orders;
drop policy sales_orders_delete on sales_orders;
create policy sales_orders_select on sales_orders for select
  using (is_tenant_member(tenant_id) and has_branch_access(tenant_id, branch_id));
create policy sales_orders_insert on sales_orders for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'create') and has_branch_access(tenant_id, branch_id));
create policy sales_orders_update on sales_orders for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'edit') and has_branch_access(tenant_id, branch_id))
  with check (is_tenant_member(tenant_id) and has_branch_access(tenant_id, branch_id));
create policy sales_orders_delete on sales_orders for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'delete') and has_branch_access(tenant_id, branch_id));

drop policy deliveries_select on deliveries;
drop policy deliveries_insert on deliveries;
drop policy deliveries_update on deliveries;
drop policy deliveries_delete on deliveries;
create policy deliveries_select on deliveries for select
  using (is_tenant_member(tenant_id) and has_branch_access(tenant_id, branch_id));
create policy deliveries_insert on deliveries for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'create') and has_branch_access(tenant_id, branch_id));
create policy deliveries_update on deliveries for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'edit') and has_branch_access(tenant_id, branch_id))
  with check (is_tenant_member(tenant_id) and has_branch_access(tenant_id, branch_id));
create policy deliveries_delete on deliveries for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'delete') and has_branch_access(tenant_id, branch_id));

drop policy sales_invoices_select on sales_invoices;
drop policy sales_invoices_insert on sales_invoices;
drop policy sales_invoices_update on sales_invoices;
drop policy sales_invoices_delete on sales_invoices;
create policy sales_invoices_select on sales_invoices for select
  using (is_tenant_member(tenant_id) and has_branch_access(tenant_id, branch_id));
create policy sales_invoices_insert on sales_invoices for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'create') and has_branch_access(tenant_id, branch_id));
create policy sales_invoices_update on sales_invoices for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'edit') and has_branch_access(tenant_id, branch_id))
  with check (is_tenant_member(tenant_id) and has_branch_access(tenant_id, branch_id));
create policy sales_invoices_delete on sales_invoices for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'delete') and has_branch_access(tenant_id, branch_id));

drop policy customer_payments_select on customer_payments;
drop policy customer_payments_insert on customer_payments;
drop policy customer_payments_update on customer_payments;
drop policy customer_payments_delete on customer_payments;
create policy customer_payments_select on customer_payments for select
  using (is_tenant_member(tenant_id) and has_branch_access(tenant_id, branch_id));
create policy customer_payments_insert on customer_payments for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'create') and has_branch_access(tenant_id, branch_id));
create policy customer_payments_update on customer_payments for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'edit') and has_branch_access(tenant_id, branch_id))
  with check (is_tenant_member(tenant_id) and has_branch_access(tenant_id, branch_id));
create policy customer_payments_delete on customer_payments for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'sales', 'delete') and has_branch_access(tenant_id, branch_id));

drop policy supplier_payments_select on supplier_payments;
drop policy supplier_payments_insert on supplier_payments;
drop policy supplier_payments_update on supplier_payments;
drop policy supplier_payments_delete on supplier_payments;
create policy supplier_payments_select on supplier_payments for select
  using (is_tenant_member(tenant_id) and has_branch_access(tenant_id, branch_id));
create policy supplier_payments_insert on supplier_payments for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'purchasing', 'create') and has_branch_access(tenant_id, branch_id));
create policy supplier_payments_update on supplier_payments for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'purchasing', 'edit') and has_branch_access(tenant_id, branch_id))
  with check (is_tenant_member(tenant_id) and has_branch_access(tenant_id, branch_id));
create policy supplier_payments_delete on supplier_payments for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'purchasing', 'delete') and has_branch_access(tenant_id, branch_id));

-- warehouses (Phase 0, 0002_hierarchy.sql/0009_rls_policies.sql) also carries
-- a direct, non-nullable branch_id -- included here for the same reason as
-- the transactional tables above. storage_locations (child of warehouses) is
-- deliberately left as tenant-scoped only in this task: restricting it would
-- need an extra join to warehouses for every zone/row/rack/position, and
-- browsing a bin hierarchy is not the same class of leak as seeing another
-- branch's sales/purchase/payment records -- documented as a scoping
-- boundary, not an oversight.

drop policy warehouses_select on warehouses;
drop policy warehouses_insert on warehouses;
drop policy warehouses_update on warehouses;
drop policy warehouses_delete on warehouses;
create policy warehouses_select on warehouses for select
  using (is_tenant_member(tenant_id) and has_branch_access(tenant_id, branch_id));
create policy warehouses_insert on warehouses for insert
  with check (is_tenant_member(tenant_id) and has_permission(tenant_id, 'warehouse', 'create') and has_branch_access(tenant_id, branch_id));
create policy warehouses_update on warehouses for update
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'warehouse', 'edit') and has_branch_access(tenant_id, branch_id))
  with check (is_tenant_member(tenant_id) and has_branch_access(tenant_id, branch_id));
create policy warehouses_delete on warehouses for delete
  using (is_tenant_member(tenant_id) and has_permission(tenant_id, 'warehouse', 'delete') and has_branch_access(tenant_id, branch_id));

-- ---------------------------------------------------------------------------
-- Line tables: no branch_id of their own -- scoped via an EXISTS join to the
-- parent header's branch_id, the same join-to-parent shape already used by
-- product_dimensions (0009_rls_policies.sql) for a table without tenant_id.
-- ---------------------------------------------------------------------------

drop policy purchase_order_lines_select on purchase_order_lines;
drop policy purchase_order_lines_insert on purchase_order_lines;
drop policy purchase_order_lines_update on purchase_order_lines;
drop policy purchase_order_lines_delete on purchase_order_lines;
create policy purchase_order_lines_select on purchase_order_lines for select
  using (exists (select 1 from purchase_orders po where po.id = purchase_order_lines.purchase_order_id and is_tenant_member(po.tenant_id) and has_branch_access(po.tenant_id, po.branch_id)));
create policy purchase_order_lines_insert on purchase_order_lines for insert
  with check (exists (select 1 from purchase_orders po where po.id = purchase_order_lines.purchase_order_id and is_tenant_member(po.tenant_id) and has_permission(po.tenant_id, 'purchasing', 'create') and has_branch_access(po.tenant_id, po.branch_id)));
create policy purchase_order_lines_update on purchase_order_lines for update
  using (exists (select 1 from purchase_orders po where po.id = purchase_order_lines.purchase_order_id and is_tenant_member(po.tenant_id) and has_permission(po.tenant_id, 'purchasing', 'edit') and has_branch_access(po.tenant_id, po.branch_id)))
  with check (exists (select 1 from purchase_orders po where po.id = purchase_order_lines.purchase_order_id and is_tenant_member(po.tenant_id) and has_branch_access(po.tenant_id, po.branch_id)));
create policy purchase_order_lines_delete on purchase_order_lines for delete
  using (exists (select 1 from purchase_orders po where po.id = purchase_order_lines.purchase_order_id and is_tenant_member(po.tenant_id) and has_permission(po.tenant_id, 'purchasing', 'delete') and has_branch_access(po.tenant_id, po.branch_id)));

drop policy goods_receipt_lines_select on goods_receipt_lines;
drop policy goods_receipt_lines_insert on goods_receipt_lines;
drop policy goods_receipt_lines_update on goods_receipt_lines;
drop policy goods_receipt_lines_delete on goods_receipt_lines;
create policy goods_receipt_lines_select on goods_receipt_lines for select
  using (exists (select 1 from goods_receipts gr where gr.id = goods_receipt_lines.goods_receipt_id and is_tenant_member(gr.tenant_id) and has_branch_access(gr.tenant_id, gr.branch_id)));
create policy goods_receipt_lines_insert on goods_receipt_lines for insert
  with check (exists (select 1 from goods_receipts gr where gr.id = goods_receipt_lines.goods_receipt_id and is_tenant_member(gr.tenant_id) and has_permission(gr.tenant_id, 'purchasing', 'create') and has_branch_access(gr.tenant_id, gr.branch_id)));
create policy goods_receipt_lines_update on goods_receipt_lines for update
  using (exists (select 1 from goods_receipts gr where gr.id = goods_receipt_lines.goods_receipt_id and is_tenant_member(gr.tenant_id) and has_permission(gr.tenant_id, 'purchasing', 'edit') and has_branch_access(gr.tenant_id, gr.branch_id)))
  with check (exists (select 1 from goods_receipts gr where gr.id = goods_receipt_lines.goods_receipt_id and is_tenant_member(gr.tenant_id) and has_branch_access(gr.tenant_id, gr.branch_id)));
create policy goods_receipt_lines_delete on goods_receipt_lines for delete
  using (exists (select 1 from goods_receipts gr where gr.id = goods_receipt_lines.goods_receipt_id and is_tenant_member(gr.tenant_id) and has_permission(gr.tenant_id, 'purchasing', 'delete') and has_branch_access(gr.tenant_id, gr.branch_id)));

drop policy sales_order_lines_select on sales_order_lines;
drop policy sales_order_lines_insert on sales_order_lines;
drop policy sales_order_lines_update on sales_order_lines;
drop policy sales_order_lines_delete on sales_order_lines;
create policy sales_order_lines_select on sales_order_lines for select
  using (exists (select 1 from sales_orders so where so.id = sales_order_lines.sales_order_id and is_tenant_member(so.tenant_id) and has_branch_access(so.tenant_id, so.branch_id)));
create policy sales_order_lines_insert on sales_order_lines for insert
  with check (exists (select 1 from sales_orders so where so.id = sales_order_lines.sales_order_id and is_tenant_member(so.tenant_id) and has_permission(so.tenant_id, 'sales', 'create') and has_branch_access(so.tenant_id, so.branch_id)));
create policy sales_order_lines_update on sales_order_lines for update
  using (exists (select 1 from sales_orders so where so.id = sales_order_lines.sales_order_id and is_tenant_member(so.tenant_id) and has_permission(so.tenant_id, 'sales', 'edit') and has_branch_access(so.tenant_id, so.branch_id)))
  with check (exists (select 1 from sales_orders so where so.id = sales_order_lines.sales_order_id and is_tenant_member(so.tenant_id) and has_branch_access(so.tenant_id, so.branch_id)));
create policy sales_order_lines_delete on sales_order_lines for delete
  using (exists (select 1 from sales_orders so where so.id = sales_order_lines.sales_order_id and is_tenant_member(so.tenant_id) and has_permission(so.tenant_id, 'sales', 'delete') and has_branch_access(so.tenant_id, so.branch_id)));

drop policy delivery_lines_select on delivery_lines;
drop policy delivery_lines_insert on delivery_lines;
drop policy delivery_lines_update on delivery_lines;
drop policy delivery_lines_delete on delivery_lines;
create policy delivery_lines_select on delivery_lines for select
  using (exists (select 1 from deliveries d where d.id = delivery_lines.delivery_id and is_tenant_member(d.tenant_id) and has_branch_access(d.tenant_id, d.branch_id)));
create policy delivery_lines_insert on delivery_lines for insert
  with check (exists (select 1 from deliveries d where d.id = delivery_lines.delivery_id and is_tenant_member(d.tenant_id) and has_permission(d.tenant_id, 'sales', 'create') and has_branch_access(d.tenant_id, d.branch_id)));
create policy delivery_lines_update on delivery_lines for update
  using (exists (select 1 from deliveries d where d.id = delivery_lines.delivery_id and is_tenant_member(d.tenant_id) and has_permission(d.tenant_id, 'sales', 'edit') and has_branch_access(d.tenant_id, d.branch_id)))
  with check (exists (select 1 from deliveries d where d.id = delivery_lines.delivery_id and is_tenant_member(d.tenant_id) and has_branch_access(d.tenant_id, d.branch_id)));
create policy delivery_lines_delete on delivery_lines for delete
  using (exists (select 1 from deliveries d where d.id = delivery_lines.delivery_id and is_tenant_member(d.tenant_id) and has_permission(d.tenant_id, 'sales', 'delete') and has_branch_access(d.tenant_id, d.branch_id)));

drop policy sales_invoice_lines_select on sales_invoice_lines;
drop policy sales_invoice_lines_insert on sales_invoice_lines;
drop policy sales_invoice_lines_update on sales_invoice_lines;
drop policy sales_invoice_lines_delete on sales_invoice_lines;
create policy sales_invoice_lines_select on sales_invoice_lines for select
  using (exists (select 1 from sales_invoices si where si.id = sales_invoice_lines.sales_invoice_id and is_tenant_member(si.tenant_id) and has_branch_access(si.tenant_id, si.branch_id)));
create policy sales_invoice_lines_insert on sales_invoice_lines for insert
  with check (exists (select 1 from sales_invoices si where si.id = sales_invoice_lines.sales_invoice_id and is_tenant_member(si.tenant_id) and has_permission(si.tenant_id, 'sales', 'create') and has_branch_access(si.tenant_id, si.branch_id)));
create policy sales_invoice_lines_update on sales_invoice_lines for update
  using (exists (select 1 from sales_invoices si where si.id = sales_invoice_lines.sales_invoice_id and is_tenant_member(si.tenant_id) and has_permission(si.tenant_id, 'sales', 'edit') and has_branch_access(si.tenant_id, si.branch_id)))
  with check (exists (select 1 from sales_invoices si where si.id = sales_invoice_lines.sales_invoice_id and is_tenant_member(si.tenant_id) and has_branch_access(si.tenant_id, si.branch_id)));
create policy sales_invoice_lines_delete on sales_invoice_lines for delete
  using (exists (select 1 from sales_invoices si where si.id = sales_invoice_lines.sales_invoice_id and is_tenant_member(si.tenant_id) and has_permission(si.tenant_id, 'sales', 'delete') and has_branch_access(si.tenant_id, si.branch_id)));
