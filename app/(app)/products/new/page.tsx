import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { fetchPermissionSet, hasPermission } from "@/lib/auth/permissions";
import { createProductAction } from "@/actions/products";
import { ProductForm } from "../ProductForm";

export default async function NewProductPage() {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const [{ data: uoms }, { data: categories }, permissionSet] = await Promise.all([
    supabase.from("uom").select("id, code, name").order("code"),
    supabase
      .from("product_categories")
      .select("id, name")
      .eq("tenant_id", tenant.tenantId)
      .order("name"),
    fetchPermissionSet(tenant.tenantId),
  ]);

  const canEditFinancials =
    hasPermission(permissionSet, "product", "view_cost") ||
    hasPermission(permissionSet, "product", "view_profit");

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        New product
      </h1>
      <ProductForm
        action={createProductAction}
        uoms={uoms ?? []}
        categories={categories ?? []}
        canEditFinancials={canEditFinancials}
        submitLabel="Create product"
      />
    </div>
  );
}
