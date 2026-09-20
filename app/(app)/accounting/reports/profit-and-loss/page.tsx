import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";

function firstOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function ProfitAndLossPage({
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

  let rows: { account_id: string; code: string; name: string; account_type: string; amount: number }[] = [];
  let fetchError: string | null = null;
  if (branchId) {
    const { data, error } = await supabase.rpc("get_profit_and_loss", {
      p_tenant_id: tenant.tenantId,
      p_branch_id: branchId,
      p_start_date: startDate,
      p_end_date: endDate,
    });
    if (error) fetchError = error.message;
    else rows = data ?? [];
  }

  const revenueRows = rows.filter((r) => r.account_type === "revenue");
  const expenseRows = rows.filter((r) => r.account_type === "expense");
  const totalRevenue = revenueRows.reduce((sum, r) => sum + Number(r.amount), 0);
  const totalExpense = expenseRows.reduce((sum, r) => sum + Number(r.amount), 0);
  const netIncome = totalRevenue - totalExpense;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Profit &amp; Loss</h1>

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
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                <th className="py-2 pr-2">Code</th>
                <th className="py-2 pr-2">Account</th>
                <th className="py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={3} className="pt-4 pb-1 font-semibold text-zinc-900 dark:text-zinc-50">Revenue</td>
              </tr>
              {revenueRows.map((r) => (
                <tr key={r.account_id} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-2">{r.code}</td>
                  <td className="py-2 pr-2">{r.name}</td>
                  <td className="py-2">{Number(r.amount).toFixed(2)}</td>
                </tr>
              ))}
              <tr className="border-b border-zinc-200 font-medium dark:border-zinc-800">
                <td colSpan={2} className="py-2">Total revenue</td>
                <td className="py-2">{totalRevenue.toFixed(2)}</td>
              </tr>

              <tr>
                <td colSpan={3} className="pt-4 pb-1 font-semibold text-zinc-900 dark:text-zinc-50">Expenses</td>
              </tr>
              {expenseRows.map((r) => (
                <tr key={r.account_id} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-2">{r.code}</td>
                  <td className="py-2 pr-2">{r.name}</td>
                  <td className="py-2">{Number(r.amount).toFixed(2)}</td>
                </tr>
              ))}
              <tr className="border-b border-zinc-200 font-medium dark:border-zinc-800">
                <td colSpan={2} className="py-2">Total expense</td>
                <td className="py-2">{totalExpense.toFixed(2)}</td>
              </tr>

              <tr className="font-semibold text-zinc-900 dark:text-zinc-50">
                <td colSpan={2} className="py-3">Net income</td>
                <td className="py-3">{netIncome.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
