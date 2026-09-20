import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { parsePage, pageRange } from "@/lib/pagination";
import { Pagination } from "@/components/Pagination";

export default async function StockAdjustmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();
  const page = parsePage(await searchParams);
  const [from, to] = pageRange(page);

  const { data: adjustments, count } = await supabase
    .from("stock_adjustments")
    .select("id, adjustment_number, adjustment_date, reason_code, status, warehouses(name)", { count: "exact" })
    .eq("tenant_id", tenant.tenantId)
    .order("adjustment_date", { ascending: false })
    .range(from, to);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Stock adjustments</h1>
        <Link
          href="/inventory/adjustments/new"
          className="flex min-h-11 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          New adjustment
        </Link>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-2">Number</th>
              <th className="py-2 pr-2">Date</th>
              <th className="py-2 pr-2">Warehouse</th>
              <th className="py-2 pr-2">Reason</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {(adjustments ?? []).map((a) => (
              <tr key={a.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2 pr-2">
                  <Link href={`/inventory/adjustments/${a.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
                    {a.adjustment_number}
                  </Link>
                </td>
                <td className="py-2 pr-2">{a.adjustment_date}</td>
                <td className="py-2 pr-2">{a.warehouses?.name}</td>
                <td className="py-2 pr-2">{a.reason_code}</td>
                <td className="py-2">{a.status}</td>
              </tr>
            ))}
            {(adjustments ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-zinc-500">No stock adjustments yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination currentPage={page} totalCount={count ?? 0} basePath="/inventory/adjustments" />
    </div>
  );
}
