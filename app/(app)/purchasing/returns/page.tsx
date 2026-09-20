import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { parsePage, pageRange } from "@/lib/pagination";
import { Pagination } from "@/components/Pagination";

export default async function PurchaseReturnsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();
  const page = parsePage(await searchParams);
  const [from, to] = pageRange(page);

  const { data: returns, count } = await supabase
    .from("purchase_returns")
    .select("id, return_number, return_date, status, total_amount, suppliers(name)", { count: "exact" })
    .eq("tenant_id", tenant.tenantId)
    .order("return_date", { ascending: false })
    .range(from, to);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Purchase returns</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        Create a return from a purchase order&apos;s own goods receipts.
      </p>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-2">Number</th>
              <th className="py-2 pr-2">Date</th>
              <th className="py-2 pr-2">Supplier</th>
              <th className="py-2 pr-2">Total</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {(returns ?? []).map((r) => (
              <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2 pr-2">
                  <Link href={`/purchasing/returns/${r.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
                    {r.return_number}
                  </Link>
                </td>
                <td className="py-2 pr-2">{r.return_date}</td>
                <td className="py-2 pr-2">{r.suppliers?.name}</td>
                <td className="py-2 pr-2">{r.total_amount}</td>
                <td className="py-2">{r.status}</td>
              </tr>
            ))}
            {(returns ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-zinc-500">No purchase returns yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination currentPage={page} totalCount={count ?? 0} basePath="/purchasing/returns" />
    </div>
  );
}
