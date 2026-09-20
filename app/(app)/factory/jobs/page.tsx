import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { parsePage, pageRange } from "@/lib/pagination";
import { Pagination } from "@/components/Pagination";

export default async function ProcessingJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();
  const page = parsePage(await searchParams);
  const [from, to] = pageRange(page);

  const { data: jobs, count } = await supabase
    .from("processing_jobs")
    .select("id, job_number, stage, status, machine, yield_percentage, actual_slab_count, actual_remnant_count, inventory_units(unit_code)", { count: "exact" })
    .eq("tenant_id", tenant.tenantId)
    .order("created_at", { ascending: false })
    .range(from, to);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Processing jobs</h1>
        <Link href="/factory/jobs/new" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
          New job
        </Link>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-2">Job #</th>
              <th className="py-2 pr-2">Block</th>
              <th className="py-2 pr-2">Stage</th>
              <th className="py-2 pr-2">Machine</th>
              <th className="py-2 pr-2">Output</th>
              <th className="py-2 pr-2">Yield</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {(jobs ?? []).map((j) => (
              <tr key={j.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2 pr-2">
                  <Link href={`/factory/jobs/${j.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
                    {j.job_number}
                  </Link>
                </td>
                <td className="py-2 pr-2">{j.inventory_units?.unit_code}</td>
                <td className="py-2 pr-2">{j.stage}</td>
                <td className="py-2 pr-2">{j.machine ?? "—"}</td>
                <td className="py-2 pr-2">
                  {j.actual_slab_count != null ? `${j.actual_slab_count} slabs, ${j.actual_remnant_count ?? 0} remnants` : "—"}
                </td>
                <td className="py-2 pr-2">{j.yield_percentage != null ? `${j.yield_percentage}%` : "—"}</td>
                <td className="py-2">{j.status}</td>
              </tr>
            ))}
            {(jobs ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="py-4 text-zinc-500">No processing jobs yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination currentPage={page} totalCount={count ?? 0} basePath="/factory/jobs" />
    </div>
  );
}
