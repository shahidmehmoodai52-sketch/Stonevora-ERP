import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { parsePage, pageRange } from "@/lib/pagination";
import { Pagination } from "@/components/Pagination";

export default async function BatchQcQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();
  const page = parsePage(await searchParams);
  const [from, to] = pageRange(page);

  const { data: batches, count } = await supabase
    .from("inventory_batches")
    .select("id, batch_number, qty_on_hand, shade_code, caliber_code, products(sku, name), production_batches(batch_number)", { count: "exact" })
    .eq("tenant_id", tenant.tenantId)
    .eq("status", "pending_qc")
    .order("created_at", { ascending: false })
    .range(from, to);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">QC queue</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        Every finished tile batch produced by a production batch lands here before it can become sellable stock.
      </p>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-2">Batch</th>
              <th className="py-2 pr-2">Product</th>
              <th className="py-2 pr-2">Production batch</th>
              <th className="py-2 pr-2">Qty</th>
              <th className="py-2 pr-2">Shade / caliber</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(batches ?? []).map((b) => (
              <tr key={b.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2 pr-2 font-medium text-zinc-900 dark:text-zinc-50">{b.batch_number}</td>
                <td className="py-2 pr-2">{b.products?.sku} — {b.products?.name}</td>
                <td className="py-2 pr-2">{b.production_batches?.batch_number}</td>
                <td className="py-2 pr-2">{b.qty_on_hand}</td>
                <td className="py-2 pr-2">{b.shade_code ?? "—"} / {b.caliber_code ?? "—"}</td>
                <td className="py-2">
                  <Link href={`/manufacturing/qc/${b.id}`} className="text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
                    Inspect
                  </Link>
                </td>
              </tr>
            ))}
            {(batches ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-zinc-500">Nothing pending QC.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination currentPage={page} totalCount={count ?? 0} basePath="/manufacturing/qc" />
    </div>
  );
}
