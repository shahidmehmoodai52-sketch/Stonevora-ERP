import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { fetchPermissionSet, hasPermission } from "@/lib/auth/permissions";

export default async function ProductsPage() {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const [{ data: products }, { data: uoms }, permissionSet] = await Promise.all([
    // products_secure redacts cost_price/standard_margin_pct per-row based on the
    // caller's own view_cost/view_profit permissions — no app-layer gating needed.
    supabase
      .from("products_secure")
      .select("id, sku, name, inventory_tracking_mode, base_uom_id, cost_price, standard_margin_pct")
      .eq("tenant_id", tenant.tenantId)
      .order("name"),
    supabase.from("uom").select("id, code"),
    fetchPermissionSet(tenant.tenantId),
  ]);

  const uomCode = new Map((uoms ?? []).map((u) => [u.id, u.code]));
  const showFinancials =
    hasPermission(permissionSet, "product", "view_cost") ||
    hasPermission(permissionSet, "product", "view_profit");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Products</h1>
        <Link
          href="/products/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          New product
        </Link>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
            <th className="py-2">SKU</th>
            <th className="py-2">Name</th>
            <th className="py-2">Tracking</th>
            <th className="py-2">Stock UOM</th>
            {showFinancials && <th className="py-2">Cost</th>}
            {showFinancials && <th className="py-2">Margin %</th>}
          </tr>
        </thead>
        <tbody>
          {(products ?? []).map((p) => (
            <tr key={p.id} className="border-b border-zinc-100 dark:border-zinc-900">
              <td className="py-2">
                <Link href={`/products/${p.id}`} className="font-medium hover:underline">
                  {p.sku}
                </Link>
              </td>
              <td className="py-2">{p.name}</td>
              <td className="py-2">{p.inventory_tracking_mode}</td>
              <td className="py-2">{p.base_uom_id ? uomCode.get(p.base_uom_id) : null}</td>
              {showFinancials && (
                <td className="py-2">{p.cost_price !== null ? p.cost_price : "—"}</td>
              )}
              {showFinancials && (
                <td className="py-2">
                  {p.standard_margin_pct !== null ? p.standard_margin_pct : "—"}
                </td>
              )}
            </tr>
          ))}
          {(products ?? []).length === 0 && (
            <tr>
              <td colSpan={6} className="py-6 text-zinc-500">
                No products yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
