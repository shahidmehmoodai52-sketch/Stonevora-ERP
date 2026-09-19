import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";

export default async function FactoryBlocksPage() {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const [{ data: blocks }, { data: uoms }] = await Promise.all([
    supabase
      .from("inventory_units")
      .select(
        "id, unit_code, status, actual_length, actual_width, actual_thickness, dimension_uom_id, volume, volume_uom_id, cost, quarry_source, quality_grade, products(sku, name)"
      )
      .eq("tenant_id", tenant.tenantId)
      .eq("unit_type", "block")
      .order("created_at", { ascending: false }),
    supabase.from("uom").select("id, code"),
  ]);

  const uomCodeById = new Map((uoms ?? []).map((u) => [u.id, u.code]));

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Blocks</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        Every block is received through a Goods Receipt for a unit-tracked product — see a
        purchase order&apos;s own GRN to receive one.
      </p>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-2">Code</th>
              <th className="py-2 pr-2">Product</th>
              <th className="py-2 pr-2">Dimensions</th>
              <th className="py-2 pr-2">Volume</th>
              <th className="py-2 pr-2">Quarry</th>
              <th className="py-2 pr-2">Grade</th>
              <th className="py-2 pr-2">Cost</th>
              <th className="py-2">Status</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(blocks ?? []).map((b) => (
              <tr key={b.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2 pr-2 font-medium text-zinc-900 dark:text-zinc-50">{b.unit_code}</td>
                <td className="py-2 pr-2">{b.products?.sku} — {b.products?.name}</td>
                <td className="py-2 pr-2">
                  {b.actual_length} × {b.actual_width} × {b.actual_thickness}{" "}
                  {b.dimension_uom_id ? uomCodeById.get(b.dimension_uom_id) : ""}
                </td>
                <td className="py-2 pr-2">
                  {b.volume} {b.volume_uom_id ? uomCodeById.get(b.volume_uom_id) : ""}
                </td>
                <td className="py-2 pr-2">{b.quarry_source ?? "—"}</td>
                <td className="py-2 pr-2">{b.quality_grade ?? "—"}</td>
                <td className="py-2 pr-2">{b.cost ?? "—"}</td>
                <td className="py-2">{b.status}</td>
                <td className="py-2">
                  {b.status === "in_stock" && (
                    <Link
                      href={`/factory/jobs/new?blockId=${b.id}`}
                      className="text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                    >
                      Start job
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {(blocks ?? []).length === 0 && (
              <tr>
                <td colSpan={9} className="py-4 text-zinc-500">No blocks received yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
