import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";

export default async function SalesOrdersPage() {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("sales_orders")
    .select("id, so_number, status, order_date, customers(name)")
    .eq("tenant_id", tenant.tenantId)
    .order("order_date", { ascending: false });

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Sales Orders</h1>
        <Link
          href="/sales/orders/new"
          className="rounded-md bg-zinc-900 px-4 py-2.5 text-center text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          New sales order
        </Link>
      </div>
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-3">SO #</th>
              <th className="py-3">Customer</th>
              <th className="hidden py-3 sm:table-cell">Date</th>
              <th className="py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(orders ?? []).map((o) => (
              <tr key={o.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="whitespace-nowrap py-3">
                  <Link href={`/sales/orders/${o.id}`} className="font-medium hover:underline">
                    {o.so_number}
                  </Link>
                </td>
                <td className="py-3">{o.customers?.name}</td>
                <td className="hidden py-3 sm:table-cell">{o.order_date}</td>
                <td className="py-3">{o.status}</td>
              </tr>
            ))}
            {(orders ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-zinc-500">No sales orders yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
