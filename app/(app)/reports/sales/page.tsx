import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";

function firstOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function SalesReportPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; startDate?: string; endDate?: string }>;
}) {
  const params = await searchParams;
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .eq("tenant_id", tenant.tenantId)
    .order("name");

  const branchId = params.branchId || branches?.[0]?.id || "";
  const startDate = params.startDate || firstOfMonth();
  const endDate = params.endDate || today();

  let summary: { order_count: number; invoice_count: number; total_revenue: number; avg_invoice_value: number } | null = null;
  let topCustomers: { customer_id: string; customer_name: string; invoice_count: number; total_revenue: number }[] = [];
  let topProducts: { product_id: string; sku: string; name: string; qty_sold: number; total_revenue: number }[] = [];
  let fetchError: string | null = null;

  if (branchId) {
    const [summaryRes, customersRes, productsRes] = await Promise.all([
      supabase.rpc("get_sales_summary", {
        p_tenant_id: tenant.tenantId,
        p_branch_id: branchId,
        p_start_date: startDate,
        p_end_date: endDate,
      }),
      supabase.rpc("get_top_customers", {
        p_tenant_id: tenant.tenantId,
        p_branch_id: branchId,
        p_start_date: startDate,
        p_end_date: endDate,
        p_limit: 10,
      }),
      supabase.rpc("get_top_products", {
        p_tenant_id: tenant.tenantId,
        p_branch_id: branchId,
        p_start_date: startDate,
        p_end_date: endDate,
        p_limit: 10,
      }),
    ]);
    fetchError = summaryRes.error?.message ?? customersRes.error?.message ?? productsRes.error?.message ?? null;
    summary = summaryRes.data?.[0] ?? null;
    topCustomers = customersRes.data ?? [];
    topProducts = productsRes.data ?? [];
  }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Sales</h1>

      <form method="get" className="mb-8 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Branch
          <select name="branchId" defaultValue={branchId} className="input">
            {(branches ?? []).map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Start date
          <input type="date" name="startDate" defaultValue={startDate} className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          End date
          <input type="date" name="endDate" defaultValue={endDate} className="input" />
        </label>
        <button type="submit" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
          Run
        </button>
      </form>

      {fetchError && <p className="text-sm text-red-600">{fetchError}</p>}

      {summary && (
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Orders", value: String(summary.order_count) },
            { label: "Invoices", value: String(summary.invoice_count) },
            { label: "Revenue", value: Number(summary.total_revenue).toFixed(2) },
            { label: "Avg invoice value", value: Number(summary.avg_invoice_value).toFixed(2) },
          ].map((t) => (
            <div key={t.label} className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-xs text-zinc-500">{t.label}</p>
              <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t.value}</p>
            </div>
          ))}
        </div>
      )}

      {!fetchError && (
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div>
            <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Top customers</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                  <th className="py-2 pr-2">Customer</th>
                  <th className="py-2 pr-2">Invoices</th>
                  <th className="py-2">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((c) => (
                  <tr key={c.customer_id} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="py-2 pr-2">{c.customer_name}</td>
                    <td className="py-2 pr-2">{c.invoice_count}</td>
                    <td className="py-2">{Number(c.total_revenue).toFixed(2)}</td>
                  </tr>
                ))}
                {topCustomers.length === 0 && (
                  <tr><td colSpan={3} className="py-4 text-zinc-500">No data.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div>
            <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Top products</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                  <th className="py-2 pr-2">Product</th>
                  <th className="py-2 pr-2">Qty sold</th>
                  <th className="py-2">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p) => (
                  <tr key={p.product_id} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="py-2 pr-2">{p.sku} — {p.name}</td>
                    <td className="py-2 pr-2">{p.qty_sold}</td>
                    <td className="py-2">{Number(p.total_revenue).toFixed(2)}</td>
                  </tr>
                ))}
                {topProducts.length === 0 && (
                  <tr><td colSpan={3} className="py-4 text-zinc-500">No data.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
