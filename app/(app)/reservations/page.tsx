import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { parsePage, pageRange } from "@/lib/pagination";
import { Pagination } from "@/components/Pagination";

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();
  const page = parsePage(await searchParams);
  const [from, to] = pageRange(page);

  const { data: reservations, count } = await supabase
    .from("stock_reservations")
    .select("id, reservation_number, status, expires_at, customers(name)", { count: "exact" })
    .eq("tenant_id", tenant.tenantId)
    .order("created_at", { ascending: false })
    .range(from, to);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Reservations</h1>
        <Link href="/reservations/new" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
          New reservation
        </Link>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-2">Number</th>
              <th className="py-2 pr-2">Customer</th>
              <th className="py-2 pr-2">Expires</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {(reservations ?? []).map((r) => (
              <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2 pr-2">
                  <Link href={`/reservations/${r.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
                    {r.reservation_number}
                  </Link>
                </td>
                <td className="py-2 pr-2">{r.customers?.name}</td>
                <td className="py-2 pr-2">{r.expires_at ?? "—"}</td>
                <td className="py-2">{r.status}</td>
              </tr>
            ))}
            {(reservations ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-zinc-500">No reservations yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination currentPage={page} totalCount={count ?? 0} basePath="/reservations" />
    </div>
  );
}
