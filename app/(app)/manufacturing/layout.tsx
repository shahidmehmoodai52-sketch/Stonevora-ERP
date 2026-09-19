import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";

// Same purely-UX capability gate as /factory and /projects -- every
// underlying RPC (start/complete/cancel_production_batch,
// record_batch_qc_inspection) already enforces has_capability(...,
// 'tile_manufacturing') independently.
export default async function ManufacturingLayout({ children }: { children: React.ReactNode }) {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const { data: capabilityRow } = await supabase
    .from("business_capabilities")
    .select("id")
    .eq("code", "tile_manufacturing")
    .single();
  const { data: enabled } = capabilityRow
    ? await supabase
        .from("tenant_capabilities")
        .select("id")
        .eq("tenant_id", tenant.tenantId)
        .eq("capability_id", capabilityRow.id)
        .maybeSingle()
    : { data: null };

  if (!enabled) {
    return (
      <div className="max-w-xl">
        <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Tile Manufacturing</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          The Tile Manufacturing capability isn&apos;t enabled for this business yet. Turn it on in{" "}
          <Link href="/settings/capabilities" className="underline">
            Business capabilities
          </Link>{" "}
          to define recipes, run production batches and QC finished tile batches.
        </p>
      </div>
    );
  }

  return (
    <div>
      <nav className="mb-6 flex gap-4 border-b border-zinc-200 text-sm dark:border-zinc-800">
        <Link href="/manufacturing/boms" className="flex min-h-11 items-center border-b-2 border-transparent px-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
          Bills of Materials
        </Link>
        <Link href="/manufacturing/batches" className="flex min-h-11 items-center border-b-2 border-transparent px-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
          Production Batches
        </Link>
        <Link href="/manufacturing/qc" className="flex min-h-11 items-center border-b-2 border-transparent px-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
          QC
        </Link>
      </nav>
      {children}
    </div>
  );
}
