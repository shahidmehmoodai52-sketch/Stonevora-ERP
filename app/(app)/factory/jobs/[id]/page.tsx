import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { startProcessingJobAction, cancelProcessingJobAction } from "@/actions/factory";
import { PostButton } from "@/components/PostButton";
import { CompleteJobForm } from "./CompleteJobForm";
import { RecordCostsForm } from "./RecordCostsForm";

export default async function ProcessingJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireActiveTenant();
  const supabase = await createClient();

  const [{ data: job }, { data: dimensionUoms }, { data: areaUoms }] = await Promise.all([
    supabase
      .from("processing_jobs")
      .select("*, inventory_units(unit_code, volume, volume_uom_id, cost, products(sku, name)), production_stages(name)")
      .eq("id", id)
      .single(),
    supabase.from("uom").select("id, code").in("code", ["CM", "INCH", "MM"]),
    supabase.from("uom").select("id, code").in("code", ["SQFT", "SQM"]),
  ]);

  if (!job) notFound();

  const { data: outputUnits } = await supabase
    .from("inventory_units")
    .select("id, unit_code, unit_type, status, actual_length, actual_width, actual_thickness, actual_area, area_uom_id, usable_area, quality_grade, cost")
    .eq("output_processing_job_id", id)
    .order("sequence_number");

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">{job.job_number}</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        Block {job.inventory_units?.unit_code} ({job.inventory_units?.products?.sku} — {job.inventory_units?.products?.name}) ·{" "}
        {job.production_stages?.name} · <span className="font-medium">{job.status}</span>
      </p>

      <dl className="mb-8 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-zinc-500">Machine</dt>
          <dd>{job.machine ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Expected slabs</dt>
          <dd>{job.expected_slab_count ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Actual output</dt>
          <dd>{job.actual_slab_count != null ? `${job.actual_slab_count} slabs, ${job.actual_remnant_count ?? 0} remnants` : "—"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Yield</dt>
          <dd>{job.yield_percentage != null ? `${job.yield_percentage}%` : "—"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Waste volume</dt>
          <dd>{job.waste_volume ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Total cost</dt>
          <dd>{job.total_cost ?? "—"}</dd>
        </div>
      </dl>

      {job.status === "draft" && (
        <div className="mb-8 flex gap-3">
          <PostButton id={job.id} action={startProcessingJobAction} label="Start job" pendingLabel="Starting…" />
          <PostButton id={job.id} action={cancelProcessingJobAction} label="Cancel" pendingLabel="Cancelling…" />
        </div>
      )}

      {job.status === "in_progress" && (
        <>
          <div className="mb-4">
            <PostButton id={job.id} action={cancelProcessingJobAction} label="Cancel job" pendingLabel="Cancelling…" />
          </div>
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Complete job — record output</h2>
          <CompleteJobForm
            processingJobId={job.id}
            dimensionUoms={dimensionUoms ?? []}
            areaUoms={areaUoms ?? []}
          />
        </>
      )}

      {(job.status === "completed" || job.status === "cancelled") && outputUnits && outputUnits.length > 0 && (
        <>
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Output</h2>
          <div className="-mx-4 mb-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                  <th className="py-2 pr-2">Code</th>
                  <th className="py-2 pr-2">Type</th>
                  <th className="py-2 pr-2">Dimensions</th>
                  <th className="py-2 pr-2">Area</th>
                  <th className="py-2 pr-2">Grade</th>
                  <th className="py-2 pr-2">Cost</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {outputUnits.map((u) => (
                  <tr key={u.id} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="py-2 pr-2 font-medium text-zinc-900 dark:text-zinc-50">{u.unit_code}</td>
                    <td className="py-2 pr-2">{u.unit_type}</td>
                    <td className="py-2 pr-2">{u.actual_length} × {u.actual_width} × {u.actual_thickness}</td>
                    <td className="py-2 pr-2">{u.actual_area}</td>
                    <td className="py-2 pr-2">{u.quality_grade ?? "—"}</td>
                    <td className="py-2 pr-2">{u.cost ?? "—"}</td>
                    <td className="py-2">{u.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {job.status === "completed" && !job.costs_recorded_at && (
        <>
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Record processing costs</h2>
          <RecordCostsForm processingJobId={job.id} />
        </>
      )}
    </div>
  );
}
