-- Column-level redaction for financial fields. RLS is row-level only, so gating
-- cost_price/standard_margin_pct needs this view template — reused by every later
-- module (sales_orders_secure, invoices_secure, etc.) for view_cost/view_profit/
-- view_financial gating.

create view products_secure
with (security_invoker = true) as
select
  p.id, p.tenant_id, p.sku, p.barcode, p.qr_code_value, p.name, p.category_id,
  p.material_type_id, p.variety_id, p.brand_id, p.collection_id, p.color_id,
  p.pattern_id, p.origin_id, p.grade_id, p.finish_id, p.surface_id, p.application_id,
  p.inventory_tracking_mode, p.base_uom_id, p.purchase_uom_id, p.sales_uom_id,
  case when has_permission(p.tenant_id, 'product', 'view_cost') then p.cost_price else null end as cost_price,
  case when has_permission(p.tenant_id, 'product', 'view_profit') then p.standard_margin_pct else null end as standard_margin_pct,
  p.is_active, p.created_by, p.updated_by, p.created_at, p.updated_at
from products p;
