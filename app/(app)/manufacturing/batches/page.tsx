import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";

export default async function ProductionBatchesPage() {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const { data: batches } = await supabase
    .from("production_batches")
    .select("id, batch_number, status, kiln_number, planned_output_quantity, actual_output_quantity, bill_of_materials(bom_number, products(sku, name))")
    .eq("tenant_id", tenant.tenantId)
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Production batches</h1>
        <Link href="/manufacturing/batches/new" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
          New batch
        </Link>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-2">Batch #</th>
              <th className="py-2 pr-2">Product</th>
              <th className="py-2 pr-2">Kiln</th>
              <th className="py-2 pr-2">Planned / actual</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {(batches ?? []).map((b) => (
              <tr key={b.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2 pr-2">
                  <Link href={`/manufacturing/batches/${b.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
                    {b.batch_number}
                  </Link>
                </td>
                <td className="py-2 pr-2">{b.bill_of_materials?.products?.sku} — {b.bill_of_materials?.products?.name}</td>
                <td className="py-2 pr-2">{b.kiln_number ?? "—"}</td>
                <td className="py-2 pr-2">{b.planned_output_quantity} / {b.actual_output_quantity ?? "—"}</td>
                <td className="py-2">{b.status}</td>
              </tr>
            ))}
            {(batches ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-zinc-500">No production batches yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
