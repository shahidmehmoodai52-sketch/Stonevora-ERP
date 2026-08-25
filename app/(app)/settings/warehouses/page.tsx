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
      <table className="mb-8 w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
            <th className="py-2">Code</th>
            <th className="py-2">Name</th>
            <th className="py-2">Branch</th>
            <th className="py-2">Type</th>
          </tr>
        </thead>
        <tbody>
          {(warehouses ?? []).map((w) => (
            <tr key={w.id} className="border-b border-zinc-100 dark:border-zinc-900">
              <td className="py-2">{w.code}</td>
              <td className="py-2">{w.name}</td>
              <td className="py-2">{w.branches?.name}</td>
              <td className="py-2">{w.type}</td>
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
      <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        Add warehouse
      </h2>
      <NewWarehouseForm action={createWarehouseAction} branches={branches ?? []} />
    </div>
  );
}
