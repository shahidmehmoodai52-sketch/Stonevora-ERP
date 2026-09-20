import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";

export default async function LowStockPage() {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_low_stock_report", {
    p_tenant_id: tenant.tenantId,
  });

  const rows = data ?? [];

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Low Stock</h1>

      {error && <p className="text-sm text-red-600">{error.message}</p>}

      {!error && (
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                <th className="py-2 pr-2">Product</th>
                <th className="py-2 pr-2">On hand</th>
                <th className="py-2 pr-2">Reorder point</th>
                <th className="py-2">Shortfall</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.product_id} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-2">{r.sku} — {r.name}</td>
                  <td className="py-2 pr-2">{r.qty_on_hand}</td>
                  <td className="py-2 pr-2">{r.reorder_point}</td>
                  <td className="py-2 text-red-600">{Number(r.shortfall).toFixed(2)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-zinc-500">Nothing below its reorder point.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
