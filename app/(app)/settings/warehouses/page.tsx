import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { createWarehouseAction } from "@/actions/settings";
import { NewWarehouseForm } from "./NewWarehouseForm";

export default async function WarehousesPage() {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const [{ data: warehouses }, { data: branches }] = await Promise.all([
    supabase
      .from("warehouses")
      .select("id, code, name, type, branches(name)")
      .eq("tenant_id", tenant.tenantId)
      .order("code"),
    supabase
      .from("branches")
      .select("id, name")
      .eq("tenant_id", tenant.tenantId)
      .order("name"),
  ]);

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Warehouses</h1>
      <div className="-mx-4 mb-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-3">Code</th>
              <th className="py-3">Name</th>
              <th className="hidden py-3 sm:table-cell">Branch</th>
              <th className="py-3">Type</th>
            </tr>
          </thead>
          <tbody>
            {(warehouses ?? []).map((w) => (
              <tr key={w.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="whitespace-nowrap py-3">{w.code}</td>
                <td className="py-3">{w.name}</td>
                <td className="hidden py-3 sm:table-cell">{w.branches?.name}</td>
                <td className="py-3">{w.type}</td>
              </tr>
            ))}
            {(warehouses ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-zinc-500">
                  No warehouses yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        Add warehouse
      </h2>
      <NewWarehouseForm action={createWarehouseAction} branches={branches ?? []} />
    </div>
  );
}
