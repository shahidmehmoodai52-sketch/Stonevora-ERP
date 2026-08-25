import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { fetchPermissionSet, hasPermission } from "@/lib/auth/permissions";
import { updateProductAction, deleteProductAction } from "@/actions/products";
import { ProductForm } from "../ProductForm";
import { DeleteProductButton } from "./DeleteProductButton";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const [{ data: product }, { data: uoms }, { data: categories }, permissionSet] =
    await Promise.all([
      supabase.from("products_secure").select("*").eq("id", id).single(),
      supabase.from("uom").select("id, code, name").order("code"),
      supabase
        .from("product_categories")
        .select("id, name")
        .eq("tenant_id", tenant.tenantId)
        .order("name"),
      fetchPermissionSet(tenant.tenantId),
    ]);

  if (!product) notFound();

  const canEditFinancials =
    hasPermission(permissionSet, "product", "view_cost") ||
    hasPermission(permissionSet, "product", "view_profit");
  const canDelete = hasPermission(permissionSet, "product", "delete");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          {product.name}
        </h1>
        {canDelete && (
          <DeleteProductButton productId={id} action={deleteProductAction} />
        )}
      </div>
      <ProductForm
        action={updateProductAction.bind(null, id)}
        uoms={uoms ?? []}
        categories={categories ?? []}
        canEditFinancials={canEditFinancials}
        submitLabel="Save changes"
        initialValues={{
          sku: product.sku ?? "",
          name: product.name ?? "",
          inventoryTrackingMode: product.inventory_tracking_mode ?? "simple",
          baseUomId: product.base_uom_id ?? "",
          purchaseUomId: product.purchase_uom_id ?? "",
          salesUomId: product.sales_uom_id ?? "",
          categoryId: product.category_id ?? "",
          costPrice: product.cost_price !== null ? String(product.cost_price) : "",
          standardMarginPct:
            product.standard_margin_pct !== null ? String(product.standard_margin_pct) : "",
        }}
      />
    </div>
  );
}
