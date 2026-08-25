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
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Products</h1>
        <Link
          href="/products/new"
          className="rounded-md bg-zinc-900 px-4 py-2.5 text-center text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          New product
        </Link>
      </div>
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-3">SKU</th>
              <th className="py-3">Name</th>
              <th className="hidden py-3 sm:table-cell">Tracking</th>
              <th className="hidden py-3 sm:table-cell">Stock UOM</th>
              {showFinancials && <th className="hidden py-3 md:table-cell">Cost</th>}
              {showFinancials && <th className="hidden py-3 md:table-cell">Margin %</th>}
            </tr>
          </thead>
          <tbody>
            {(products ?? []).map((p) => (
              <tr key={p.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="whitespace-nowrap py-3">
                  <Link href={`/products/${p.id}`} className="font-medium hover:underline">
                    {p.sku}
                  </Link>
                </td>
                <td className="py-3">{p.name}</td>
                <td className="hidden py-3 sm:table-cell">{p.inventory_tracking_mode}</td>
                <td className="hidden py-3 sm:table-cell">
                  {p.base_uom_id ? uomCode.get(p.base_uom_id) : null}
                </td>
                {showFinancials && (
                  <td className="hidden py-3 md:table-cell">
                    {p.cost_price !== null ? p.cost_price : "—"}
                  </td>
                )}
                {showFinancials && (
                  <td className="hidden py-3 md:table-cell">
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
    </div>
  );
}
