import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { parsePage, pageRange } from "@/lib/pagination";
import { Pagination } from "@/components/Pagination";

export default async function QcQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();
  const page = parsePage(await searchParams);
  const [from, to] = pageRange(page);

  const { data: units, count } = await supabase
    .from("inventory_units")
    .select("id, unit_code, unit_type, status, actual_length, actual_width, actual_thickness, actual_area, quality_grade, products(sku, name), processing_jobs(job_number)", { count: "exact" })
    .eq("tenant_id", tenant.tenantId)
    .in("status", ["pending_qc", "needs_rework", "on_hold"])
    .order("created_at", { ascending: false })
    .range(from, to);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">QC queue</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        Every slab or remnant produced by a processing job lands here before it can become sellable stock.
      </p>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-2">Code</th>
              <th className="py-2 pr-2">Type</th>
              <th className="py-2 pr-2">Product</th>
              <th className="py-2 pr-2">Job</th>
              <th className="py-2 pr-2">Dimensions</th>
              <th className="py-2 pr-2">Grade (cutting)</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(units ?? []).map((u) => (
              <tr key={u.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2 pr-2 font-medium text-zinc-900 dark:text-zinc-50">{u.unit_code}</td>
                <td className="py-2 pr-2">{u.unit_type}</td>
                <td className="py-2 pr-2">{u.products?.sku} — {u.products?.name}</td>
                <td className="py-2 pr-2">{u.processing_jobs?.job_number}</td>
                <td className="py-2 pr-2">{u.actual_length} × {u.actual_width} × {u.actual_thickness} ({u.actual_area})</td>
                <td className="py-2 pr-2">{u.quality_grade ?? "—"}</td>
                <td className="py-2">
                  <Link href={`/factory/qc/${u.id}`} className="text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
                    Inspect
                  </Link>
                </td>
              </tr>
            ))}
            {(units ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="py-4 text-zinc-500">Nothing pending QC.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination currentPage={page} totalCount={count ?? 0} basePath="/factory/qc" />
    </div>
  );
}
