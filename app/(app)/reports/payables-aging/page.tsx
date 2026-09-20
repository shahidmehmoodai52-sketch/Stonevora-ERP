import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";

export default async function PayablesAgingPage() {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_payables_aging", {
    p_tenant_id: tenant.tenantId,
  });

  const rows = data ?? [];
  const totals = rows.reduce(
    (acc, r) => ({
      current: acc.current + Number(r.current_amount),
      d30: acc.d30 + Number(r.days_1_30),
      d60: acc.d60 + Number(r.days_31_60),
      d90: acc.d90 + Number(r.days_61_90),
      dOver: acc.dOver + Number(r.days_over_90),
      total: acc.total + Number(r.total_outstanding),
    }),
    { current: 0, d30: 0, d60: 0, d90: 0, dOver: 0, total: 0 }
  );

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Payables Aging</h1>

      {error && <p className="text-sm text-red-600">{error.message}</p>}

      {!error && (
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                <th className="py-2 pr-2">Supplier</th>
                <th className="py-2 pr-2">Current</th>
                <th className="py-2 pr-2">1-30</th>
                <th className="py-2 pr-2">31-60</th>
                <th className="py-2 pr-2">61-90</th>
                <th className="py-2 pr-2">90+</th>
                <th className="py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.supplier_id} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-2">{r.supplier_name}</td>
                  <td className="py-2 pr-2">{Number(r.current_amount).toFixed(2)}</td>
                  <td className="py-2 pr-2">{Number(r.days_1_30).toFixed(2)}</td>
                  <td className="py-2 pr-2">{Number(r.days_31_60).toFixed(2)}</td>
                  <td className="py-2 pr-2">{Number(r.days_61_90).toFixed(2)}</td>
                  <td className="py-2 pr-2">{Number(r.days_over_90).toFixed(2)}</td>
                  <td className="py-2 font-medium">{Number(r.total_outstanding).toFixed(2)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="py-4 text-zinc-500">Nothing outstanding.</td></tr>
              )}
              {rows.length > 0 && (
                <tr className="font-semibold text-zinc-900 dark:text-zinc-50">
                  <td className="py-3">Total</td>
                  <td className="py-3">{totals.current.toFixed(2)}</td>
                  <td className="py-3">{totals.d30.toFixed(2)}</td>
                  <td className="py-3">{totals.d60.toFixed(2)}</td>
                  <td className="py-3">{totals.d90.toFixed(2)}</td>
                  <td className="py-3">{totals.dOver.toFixed(2)}</td>
                  <td className="py-3">{totals.total.toFixed(2)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
