import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";

type Tile = { label: string; value: string };

function Tiles({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">{t.label}</p>
          <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t.value}</p>
        </div>
      ))}
    </div>
  );
}

export default async function FactoryDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string }>;
}) {
  const params = await searchParams;
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .eq("tenant_id", tenant.tenantId)
    .order("name");

  const branchId = params.branchId || branches?.[0]?.id || "";

  let summary: {
    wip_processing_jobs: number;
    wip_production_batches: number;
    qc_pending_units: number;
    qc_pending_batches: number;
    dispatch_pending_orders: number;
  } | null = null;
  let fetchError: string | null = null;

  if (branchId) {
    const { data, error } = await supabase.rpc("get_factory_dashboard", {
      p_tenant_id: tenant.tenantId,
      p_branch_id: branchId,
    });
    if (error) fetchError = error.message;
    else summary = data?.[0] ?? null;
  }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Factory dashboard</h1>

      <form method="get" className="mb-8 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Branch
          <select name="branchId" defaultValue={branchId} className="input">
            {(branches ?? []).map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
          Run
        </button>
      </form>

      {fetchError && <p className="text-sm text-red-600">{fetchError}</p>}

      {summary && (
        <Tiles
          tiles={[
            { label: "WIP processing jobs", value: String(summary.wip_processing_jobs) },
            { label: "WIP production batches", value: String(summary.wip_production_batches) },
            { label: "QC pending (units)", value: String(summary.qc_pending_units) },
            { label: "QC pending (batches)", value: String(summary.qc_pending_batches) },
            { label: "Dispatch pending orders", value: String(summary.dispatch_pending_orders) },
          ]}
        />
      )}
    </div>
  );
}
