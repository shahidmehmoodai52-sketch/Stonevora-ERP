import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";

function firstOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

type Tile = { label: string; value: string };

function Tiles({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">{t.label}</p>
          <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t.value}</p>
        </div>
      ))}
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; startDate?: string; endDate?: string }>;
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
  const startDate = params.startDate || firstOfMonth();
  const endDate = params.endDate || today();

  let summary: {
    total_revenue: number;
    total_cogs: number;
    gross_profit: number;
    open_sales_orders: number;
    open_purchase_orders: number;
    outstanding_receivables: number;
    outstanding_payables: number;
    low_stock_count: number;
  } | null = null;
  let fetchError: string | null = null;

  if (branchId) {
    const { data, error } = await supabase.rpc("get_dashboard_summary", {
      p_tenant_id: tenant.tenantId,
      p_branch_id: branchId,
      p_start_date: startDate,
      p_end_date: endDate,
    });
    if (error) fetchError = error.message;
    else summary = data?.[0] ?? null;
  }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Dashboard</h1>

      <form method="get" className="mb-8 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Branch
          <select name="branchId" defaultValue={branchId} className="input">
            {(branches ?? []).map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Start date
          <input type="date" name="startDate" defaultValue={startDate} className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          End date
          <input type="date" name="endDate" defaultValue={endDate} className="input" />
        </label>
        <button type="submit" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
          Run
        </button>
      </form>

      {fetchError && <p className="text-sm text-red-600">{fetchError}</p>}

      {summary && (
        <Tiles
          tiles={[
            { label: "Revenue", value: Number(summary.total_revenue).toFixed(2) },
            { label: "COGS", value: Number(summary.total_cogs).toFixed(2) },
            { label: "Gross profit", value: Number(summary.gross_profit).toFixed(2) },
            { label: "Open sales orders", value: String(summary.open_sales_orders) },
            { label: "Open purchase orders", value: String(summary.open_purchase_orders) },
            { label: "Outstanding receivables", value: Number(summary.outstanding_receivables).toFixed(2) },
            { label: "Outstanding payables", value: Number(summary.outstanding_payables).toFixed(2) },
            { label: "Low stock items", value: String(summary.low_stock_count) },
          ]}
        />
      )}
    </div>
  );
}
