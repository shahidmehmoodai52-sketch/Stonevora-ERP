import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  startStocktakeCountAction,
  postStocktakeAction,
  cancelStocktakeAction,
} from "@/actions/stocktakes";
import { PostButton } from "@/components/PostButton";
import { RecordCountForm } from "./RecordCountForm";

export default async function StocktakeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: stocktake }, { data: lines }, { data: uoms }] = await Promise.all([
    supabase
      .from("stocktakes")
      .select("*, warehouses(name), branches(name)")
      .eq("id", id)
      .single(),
    supabase
      .from("stocktake_lines")
      .select(
        "id, system_quantity, counted_quantity, uom_id, products(sku, name), storage_locations(code, path), inventory_batches(batch_number)"
      )
      .eq("stocktake_id", id),
    supabase.from("uom").select("id, code"),
  ]);

  if (!stocktake) notFound();

  const uomCodeById = new Map((uoms ?? []).map((u) => [u.id, u.code]));
  const allCounted = (lines ?? []).every((l) => l.counted_quantity !== null);

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">{stocktake.stocktake_number}</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        {stocktake.warehouses?.name} · {stocktake.branches?.name} ·{" "}
        <span className="font-medium">{stocktake.status}</span>
      </p>

      {stocktake.notes && <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">{stocktake.notes}</p>}

      <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Lines</h2>
      <div className="-mx-4 mb-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-2">Product</th>
              <th className="py-2 pr-2">Location / Batch</th>
              <th className="py-2 pr-2">System qty</th>
              <th className="py-2 pr-2">Counted qty</th>
              <th className="py-2 pr-2">Variance</th>
              {stocktake.status === "counting" && <th className="py-2">Count</th>}
            </tr>
          </thead>
          <tbody>
            {(lines ?? []).map((l) => {
              const variance =
                l.counted_quantity !== null && l.system_quantity !== null
                  ? Number(l.counted_quantity) - Number(l.system_quantity)
                  : null;
              return (
                <tr key={l.id} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-2">{l.products?.sku} — {l.products?.name}</td>
                  <td className="py-2 pr-2">
                    {l.inventory_batches?.batch_number ?? l.storage_locations?.path ?? l.storage_locations?.code ?? "—"}
                  </td>
                  <td className="py-2 pr-2">
                    {l.system_quantity !== null ? `${l.system_quantity} ${uomCodeById.get(l.uom_id) ?? ""}` : "—"}
                  </td>
                  <td className="py-2 pr-2">
                    {l.counted_quantity !== null ? `${l.counted_quantity} ${uomCodeById.get(l.uom_id) ?? ""}` : "—"}
                  </td>
                  <td className={`py-2 pr-2 ${variance === null ? "" : variance === 0 ? "text-zinc-500" : variance > 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {variance === null ? "—" : `${variance > 0 ? "+" : ""}${variance}`}
                  </td>
                  {stocktake.status === "counting" && (
                    <td className="py-2">
                      <RecordCountForm stocktakeLineId={l.id} currentCount={l.counted_quantity} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {stocktake.status === "draft" && (
          <PostButton id={id} action={startStocktakeCountAction} label="Start counting" pendingLabel="Starting…" />
        )}
        {stocktake.status === "counting" && (
          <PostButton
            id={id}
            action={postStocktakeAction}
            label={allCounted ? "Post stocktake" : "Post stocktake (all lines must be counted)"}
            pendingLabel="Posting…"
          />
        )}
        {(stocktake.status === "draft" || stocktake.status === "counting") && (
          <PostButton id={id} action={cancelStocktakeAction} label="Cancel" pendingLabel="Cancelling…" />
        )}
        {stocktake.status === "posted" && stocktake.stock_adjustment_id && (
          <Link
            href={`/inventory/adjustments/${stocktake.stock_adjustment_id}`}
            className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
          >
            View generated stock adjustment →
          </Link>
        )}
        {stocktake.status === "posted" && !stocktake.stock_adjustment_id && (
          <p className="text-sm text-zinc-500">Perfect count — no adjustment was needed.</p>
        )}
      </div>
    </div>
  );
}
