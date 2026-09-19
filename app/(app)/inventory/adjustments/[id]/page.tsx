import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { postStockAdjustmentAction } from "@/actions/inventory";
import { PostButton } from "@/components/PostButton";

export default async function StockAdjustmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: adjustment }, { data: lines }, { data: uoms }] = await Promise.all([
    supabase
      .from("stock_adjustments")
      .select("*, warehouses(name), branches(name)")
      .eq("id", id)
      .single(),
    supabase
      .from("stock_adjustment_lines")
      .select(
        "id, quantity_change, unit_cost, uom_id, products(sku, name), storage_locations(code, path), inventory_batches(batch_number)"
      )
      .eq("stock_adjustment_id", id),
    supabase.from("uom").select("id, code"),
  ]);

  if (!adjustment) notFound();

  const uomCodeById = new Map((uoms ?? []).map((u) => [u.id, u.code]));

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">{adjustment.adjustment_number}</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        {adjustment.warehouses?.name} · {adjustment.branches?.name} · {adjustment.reason_code} ·{" "}
        <span className="font-medium">{adjustment.status}</span>
      </p>

      {adjustment.notes && <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">{adjustment.notes}</p>}

      <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Lines</h2>
      <div className="-mx-4 mb-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-2">Product</th>
              <th className="py-2 pr-2">Change</th>
              <th className="py-2 pr-2">Unit cost</th>
              <th className="py-2">Location / Batch</th>
            </tr>
          </thead>
          <tbody>
            {(lines ?? []).map((l) => (
              <tr key={l.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2 pr-2">{l.products?.sku} — {l.products?.name}</td>
                <td className={`py-2 pr-2 ${Number(l.quantity_change) > 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {Number(l.quantity_change) > 0 ? "+" : ""}
                  {l.quantity_change} {uomCodeById.get(l.uom_id)}
                </td>
                <td className="py-2 pr-2">{l.unit_cost ?? "—"}</td>
                <td className="py-2">
                  {l.inventory_batches?.batch_number ?? l.storage_locations?.path ?? l.storage_locations?.code ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adjustment.status === "draft" && (
        <PostButton id={id} action={postStockAdjustmentAction} label="Post adjustment" pendingLabel="Posting…" />
      )}
    </div>
  );
}
