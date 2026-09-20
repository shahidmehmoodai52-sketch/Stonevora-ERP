import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";

export default async function StocktakesPage() {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const { data: stocktakes } = await supabase
    .from("stocktakes")
    .select("id, stocktake_number, status, created_at, warehouses(name)")
    .eq("tenant_id", tenant.tenantId)
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Stocktakes</h1>
        <Link
          href="/inventory/stocktakes/new"
          className="flex min-h-11 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          New stocktake
        </Link>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-2">Number</th>
              <th className="py-2 pr-2">Warehouse</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {(stocktakes ?? []).map((s) => (
              <tr key={s.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2 pr-2">
                  <Link href={`/inventory/stocktakes/${s.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
                    {s.stocktake_number}
                  </Link>
                </td>
                <td className="py-2 pr-2">{s.warehouses?.name}</td>
                <td className="py-2">{s.status}</td>
              </tr>
            ))}
            {(stocktakes ?? []).length === 0 && (
              <tr>
                <td colSpan={3} className="py-4 text-zinc-500">No stocktakes yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
