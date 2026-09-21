import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";

function firstOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

type ByMachine = { machine: string; job_count: number; total_slabs: number; total_remnants: number; avg_yield_pct: number | null; total_cost: number };
type ByOperator = { operator_id: string | null; operator_name: string; job_count: number; total_slabs: number; total_remnants: number; avg_yield_pct: number | null; total_cost: number };

export default async function FactoryProductionReportPage({
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

  let byMachine: ByMachine[] = [];
  let byOperator: ByOperator[] = [];
  let fetchError: string | null = null;

  if (branchId) {
    const [machineRes, operatorRes] = await Promise.all([
      supabase.rpc("get_production_by_machine", {
        p_tenant_id: tenant.tenantId,
        p_branch_id: branchId,
        p_start_date: startDate,
        p_end_date: endDate,
      }),
      supabase.rpc("get_production_by_operator", {
        p_tenant_id: tenant.tenantId,
        p_branch_id: branchId,
        p_start_date: startDate,
        p_end_date: endDate,
      }),
    ]);
    fetchError = machineRes.error?.message ?? operatorRes.error?.message ?? null;
    byMachine = machineRes.data ?? [];
    byOperator = operatorRes.data ?? [];
  }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Production reports</h1>

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

      {!fetchError && (
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div>
            <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">By machine</h2>
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                    <th className="py-2 pr-2">Machine</th>
                    <th className="py-2 pr-2">Jobs</th>
                    <th className="py-2 pr-2">Slabs</th>
                    <th className="py-2 pr-2">Yield %</th>
                    <th className="py-2">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {byMachine.map((m) => (
                    <tr key={m.machine} className="border-b border-zinc-100 dark:border-zinc-900">
                      <td className="py-2 pr-2">{m.machine}</td>
                      <td className="py-2 pr-2">{m.job_count}</td>
                      <td className="py-2 pr-2">{m.total_slabs}</td>
                      <td className="py-2 pr-2">{m.avg_yield_pct != null ? Number(m.avg_yield_pct).toFixed(1) : "—"}</td>
                      <td className="py-2">{Number(m.total_cost).toFixed(2)}</td>
                    </tr>
                  ))}
                  {byMachine.length === 0 && (
                    <tr><td colSpan={5} className="py-4 text-zinc-500">No completed jobs in this range.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">By operator</h2>
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                    <th className="py-2 pr-2">Operator</th>
                    <th className="py-2 pr-2">Jobs</th>
                    <th className="py-2 pr-2">Slabs</th>
                    <th className="py-2 pr-2">Yield %</th>
                    <th className="py-2">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {byOperator.map((o) => (
                    <tr key={o.operator_id ?? "unassigned"} className="border-b border-zinc-100 dark:border-zinc-900">
                      <td className="py-2 pr-2">{o.operator_name}</td>
                      <td className="py-2 pr-2">{o.job_count}</td>
                      <td className="py-2 pr-2">{o.total_slabs}</td>
                      <td className="py-2 pr-2">{o.avg_yield_pct != null ? Number(o.avg_yield_pct).toFixed(1) : "—"}</td>
                      <td className="py-2">{Number(o.total_cost).toFixed(2)}</td>
                    </tr>
                  ))}
                  {byOperator.length === 0 && (
                    <tr><td colSpan={5} className="py-4 text-zinc-500">No completed jobs in this range.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
