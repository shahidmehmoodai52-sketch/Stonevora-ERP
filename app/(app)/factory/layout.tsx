import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";

// Every Factory RPC already rejects with a clear error when the
// block_slab_factory capability isn't enabled (has_capability checks baked
// into start/complete/record_processing_costs/record_qc_inspection) -- this
// layout-level check is purely UX: show a way out to Settings instead of a
// working-looking form that would fail at submit time.
export default async function FactoryLayout({ children }: { children: React.ReactNode }) {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const { data: capabilityRow } = await supabase
    .from("business_capabilities")
    .select("id")
    .eq("code", "block_slab_factory")
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
        <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Factory</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          The Block/Slab Factory capability isn&apos;t enabled for this business yet. Turn it on in{" "}
          <Link href="/settings/capabilities" className="underline">
            Business capabilities
          </Link>{" "}
          to raw-block intake, processing jobs, slab output and QC.
        </p>
      </div>
    );
  }

  return (
    <div>
      <nav className="mb-6 flex flex-wrap gap-4 border-b border-zinc-200 text-sm dark:border-zinc-800">
        <Link href="/factory/dashboard" className="flex min-h-11 items-center border-b-2 border-transparent px-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
          Dashboard
        </Link>
        <Link href="/factory/blocks" className="flex min-h-11 items-center border-b-2 border-transparent px-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
          Blocks
        </Link>
        <Link href="/factory/jobs" className="flex min-h-11 items-center border-b-2 border-transparent px-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
          Processing Jobs
        </Link>
        <Link href="/factory/qc" className="flex min-h-11 items-center border-b-2 border-transparent px-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
          QC
        </Link>
        <Link href="/factory/reports" className="flex min-h-11 items-center border-b-2 border-transparent px-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
          Production Reports
        </Link>
      </nav>
      {children}
    </div>
  );
}
