import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { BatchQcInspectionForm } from "./BatchQcInspectionForm";

export default async function BatchQcInspectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireActiveTenant();
  const supabase = await createClient();

  const { data: batch } = await supabase
    .from("inventory_batches")
    .select("id, batch_number, status, qty_on_hand, shade_code, caliber_code, products(sku, name), production_batches(batch_number)")
    .eq("id", id)
    .single();

  if (!batch) notFound();

  return (
    <div className="max-w-xl">
      <h1 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">{batch.batch_number}</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        {batch.products?.sku} — {batch.products?.name} · Production batch {batch.production_batches?.batch_number} ·{" "}
        <span className="font-medium">{batch.status}</span>
      </p>

      <dl className="mb-8 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div>
          <dt className="text-zinc-500">Quantity</dt>
          <dd>{batch.qty_on_hand}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Shade / caliber (from firing)</dt>
          <dd>{batch.shade_code ?? "—"} / {batch.caliber_code ?? "—"}</dd>
        </div>
      </dl>

      {["pending_qc", "needs_rework", "on_hold"].includes(batch.status) ? (
        <BatchQcInspectionForm inventoryBatchId={batch.id} />
      ) : (
        <p className="text-sm text-zinc-500">Already inspected — current status: {batch.status}.</p>
      )}
    </div>
  );
}
