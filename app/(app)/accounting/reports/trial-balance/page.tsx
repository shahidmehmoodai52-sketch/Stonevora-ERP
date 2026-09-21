import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

type TrialBalanceRow = { account_id: string; code: string; name: string; account_type: string; debit: number; credit: number };

export default async function TrialBalancePage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; asOfDate?: string }>;
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
  const asOfDate = params.asOfDate || today();

  let rows: TrialBalanceRow[] = [];
  let fetchError: string | null = null;
  if (branchId) {
    const { data, error } = await supabase.rpc("get_trial_balance", {
      p_tenant_id: tenant.tenantId,
      p_branch_id: branchId,
      p_as_of_date: asOfDate,
    });
    if (error) fetchError = error.message;
    else rows = data ?? [];
  }

  const totalDebit = rows.reduce((sum, r) => sum + Number(r.debit), 0);
  const totalCredit = rows.reduce((sum, r) => sum + Number(r.credit), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Trial Balance</h1>

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
          As of date
          <input type="date" name="asOfDate" defaultValue={asOfDate} className="input" />
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
                <th className="py-2 pr-2">Debit</th>
                <th className="py-2">Credit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.account_id} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-2">{r.code}</td>
                  <td className="py-2 pr-2">{r.name}</td>
                  <td className="py-2 pr-2">{Number(r.debit) > 0 ? Number(r.debit).toFixed(2) : ""}</td>
                  <td className="py-2">{Number(r.credit) > 0 ? Number(r.credit).toFixed(2) : ""}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-zinc-500">No accounts found.</td>
                </tr>
              )}
              <tr className="font-semibold text-zinc-900 dark:text-zinc-50">
                <td colSpan={2} className="py-3">Total</td>
                <td className="py-3">{totalDebit.toFixed(2)}</td>
                <td className="py-3">{totalCredit.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          <p className={`mt-4 text-sm ${balanced ? "text-emerald-600" : "text-amber-600"}`}>
            {balanced ? "Balanced — total debits equal total credits" : "Out of balance"}
          </p>
        </div>
      )}
    </div>
  );
}
