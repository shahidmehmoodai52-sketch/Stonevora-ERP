import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";

export default async function BomsPage() {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const { data: boms } = await supabase
    .from("bill_of_materials")
    .select("id, bom_number, name, output_quantity, is_active, products(sku, name)")
    .eq("tenant_id", tenant.tenantId)
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Bills of Materials</h1>
        <Link href="/manufacturing/boms/new" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
          New BOM
        </Link>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-2">Number</th>
              <th className="py-2 pr-2">Name</th>
              <th className="py-2 pr-2">Finished product</th>
              <th className="py-2 pr-2">Output qty</th>
              <th className="py-2">Active</th>
            </tr>
          </thead>
          <tbody>
            {(boms ?? []).map((b) => (
              <tr key={b.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2 pr-2">
                  <Link href={`/manufacturing/boms/${b.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
                    {b.bom_number}
                  </Link>
                </td>
                <td className="py-2 pr-2">{b.name ?? "—"}</td>
                <td className="py-2 pr-2">{b.products?.sku} — {b.products?.name}</td>
                <td className="py-2 pr-2">{b.output_quantity}</td>
                <td className="py-2">{b.is_active ? "Yes" : "No"}</td>
              </tr>
            ))}
            {(boms ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-zinc-500">No bills of materials yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
