import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { createBranchAction } from "@/actions/settings";
import { NewBranchForm } from "./NewBranchForm";

export default async function BranchesPage() {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();
  const { data: branches } = await supabase
    .from("branches")
    .select("id, code, name, is_head_office, is_active")
    .eq("tenant_id", tenant.tenantId)
    .order("code");

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Branches</h1>
      <div className="-mx-4 mb-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-3">Code</th>
              <th className="py-3">Name</th>
              <th className="py-3">Head office</th>
            </tr>
          </thead>
          <tbody>
            {(branches ?? []).map((b) => (
              <tr key={b.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="whitespace-nowrap py-3">{b.code}</td>
                <td className="py-3">{b.name}</td>
                <td className="py-3">{b.is_head_office ? "Yes" : ""}</td>
              </tr>
            ))}
            {(branches ?? []).length === 0 && (
              <tr>
                <td colSpan={3} className="py-4 text-zinc-500">
                  No branches yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        Add branch
      </h2>
      <NewBranchForm action={createBranchAction} />
    </div>
  );
}
