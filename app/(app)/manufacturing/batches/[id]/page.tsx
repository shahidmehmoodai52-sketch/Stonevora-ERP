import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { startProductionBatchAction, cancelProductionBatchAction } from "@/actions/manufacturing";
import { PostButton } from "@/components/PostButton";
import { CompleteBatchForm } from "./CompleteBatchForm";

export default async function ProductionBatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireActiveTenant();
  const supabase = await createClient();

  const { data: pbatch } = await supabase
    .from("production_batches")
    .select("*, bill_of_materials(bom_number, output_uom_id, products(sku, name))")
    .eq("id", id)
    .single();

  if (!pbatch) notFound();

  const [{ data: consumptions }, { data: locations }, { data: uoms }] = await Promise.all([
    supabase
      .from("production_batch_consumptions")
      .select("id, quantity, uom_id, unit_cost, products(sku, name)")
      .eq("production_batch_id", id),
    supabase.from("storage_locations").select("id, code, path").eq("warehouse_id", pbatch.warehouse_id).order("path"),
    supabase.from("uom").select("id, code"),
  ]);

  const uomCodeById = new Map((uoms ?? []).map((u) => [u.id, u.code]));

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">{pbatch.batch_number}</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        {pbatch.bill_of_materials?.bom_number} — {pbatch.bill_of_materials?.products?.sku} {pbatch.bill_of_materials?.products?.name} ·{" "}
        <span className="font-medium">{pbatch.status}</span>
      </p>

      <dl className="mb-8 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-zinc-500">Planned output</dt>
          <dd>{pbatch.planned_output_quantity} {uomCodeById.get(pbatch.bill_of_materials?.output_uom_id)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Actual output</dt>
          <dd>{pbatch.actual_output_quantity ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Shade / caliber</dt>
          <dd>{pbatch.shade_code ?? "—"} / {pbatch.caliber_code ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Raw material cost</dt>
          <dd>{pbatch.raw_material_cost ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Labor / overhead</dt>
          <dd>{pbatch.labor_cost ?? "—"} / {pbatch.overhead_cost ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Total cost</dt>
          <dd>{pbatch.total_cost ?? "—"}</dd>
        </div>
      </dl>

      {pbatch.status === "draft" && (
        <div className="mb-8 flex gap-3">
          <PostButton id={pbatch.id} action={startProductionBatchAction} label="Start batch" pendingLabel="Starting…" />
          <PostButton id={pbatch.id} action={cancelProductionBatchAction} label="Cancel" pendingLabel="Cancelling…" />
        </div>
      )}

      {(pbatch.status === "in_progress" || pbatch.status === "completed" || pbatch.status === "cancelled") && (
        <>
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Raw materials consumed</h2>
          <div className="-mx-4 mb-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                  <th className="py-2 pr-2">Product</th>
                  <th className="py-2 pr-2">Quantity</th>
                  <th className="py-2">Unit cost</th>
                </tr>
              </thead>
              <tbody>
                {(consumptions ?? []).map((c) => (
                  <tr key={c.id} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="py-2 pr-2">{c.products?.sku} — {c.products?.name}</td>
                    <td className="py-2 pr-2">{c.quantity} {uomCodeById.get(c.uom_id)}</td>
                    <td className="py-2">{c.unit_cost ?? "—"}</td>
                  </tr>
                ))}
                {(consumptions ?? []).length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 text-zinc-500">No consumptions recorded.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {pbatch.status === "in_progress" && (
        <>
          <div className="mb-4">
            <PostButton id={pbatch.id} action={cancelProductionBatchAction} label="Cancel batch" pendingLabel="Cancelling…" />
          </div>
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Complete batch</h2>
          <CompleteBatchForm productionBatchId={pbatch.id} locations={locations ?? []} />
        </>
      )}
    </div>
  );
}
