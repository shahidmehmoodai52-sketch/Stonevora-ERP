import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { QcInspectionForm } from "./QcInspectionForm";

export default async function QcInspectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireActiveTenant();
  const supabase = await createClient();

  const { data: unit } = await supabase
    .from("inventory_units")
    .select("id, unit_code, unit_type, status, actual_length, actual_width, actual_thickness, actual_area, usable_area, quality_grade, products(sku, name), processing_jobs(job_number)")
    .eq("id", id)
    .single();

  if (!unit) notFound();

  return (
    <div className="max-w-xl">
      <h1 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">{unit.unit_code}</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        {unit.unit_type} · {unit.products?.sku} — {unit.products?.name} · Job {unit.processing_jobs?.job_number} ·{" "}
        <span className="font-medium">{unit.status}</span>
      </p>

      <dl className="mb-8 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div>
          <dt className="text-zinc-500">Dimensions</dt>
          <dd>{unit.actual_length} × {unit.actual_width} × {unit.actual_thickness}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Area / usable</dt>
          <dd>{unit.actual_area} / {unit.usable_area}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Grade at cutting</dt>
          <dd>{unit.quality_grade ?? "—"}</dd>
        </div>
      </dl>

      {unit.status === "pending_qc" ? (
        <QcInspectionForm inventoryUnitId={unit.id} />
      ) : (
        <p className="text-sm text-zinc-500">Already inspected — current status: {unit.status}.</p>
      )}
    </div>
  );
}
