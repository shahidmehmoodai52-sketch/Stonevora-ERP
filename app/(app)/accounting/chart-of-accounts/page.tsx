import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { NewAccountForm } from "./NewAccountForm";

export default async function ChartOfAccountsPage() {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const { data: accounts } = await supabase
    .from("chart_of_accounts")
    .select("id, code, name, account_type, is_active, is_system")
    .eq("tenant_id", tenant.tenantId)
    .order("code");

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Chart of Accounts</h1>

      <div className="-mx-4 mb-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-2">Code</th>
              <th className="py-2 pr-2">Name</th>
              <th className="py-2 pr-2">Type</th>
              <th className="py-2 pr-2">System</th>
              <th className="py-2">Active</th>
            </tr>
          </thead>
          <tbody>
            {(accounts ?? []).map((a) => (
              <tr key={a.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2 pr-2 font-medium text-zinc-900 dark:text-zinc-50">{a.code}</td>
                <td className="py-2 pr-2">{a.name}</td>
                <td className="py-2 pr-2">{a.account_type}</td>
                <td className="py-2 pr-2">{a.is_system ? "Yes" : "No"}</td>
                <td className="py-2">{a.is_active ? "Yes" : "No"}</td>
              </tr>
            ))}
            {(accounts ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-zinc-500">No accounts yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Add account</h2>
      <NewAccountForm parentOptions={(accounts ?? []).map((a) => ({ id: a.id, label: `${a.code} — ${a.name}` }))} />
    </div>
  );
}
