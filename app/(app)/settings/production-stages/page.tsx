import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { createProductionStageAction, setProductionStageActiveAction } from "@/actions/settings";
import { NewProductionStageForm } from "./NewProductionStageForm";
import { StageActiveToggleList } from "./StageActiveToggleList";

export default async function ProductionStagesPage() {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();
  const { data: stages } = await supabase
    .from("production_stages")
    .select("id, code, name, sort_order, is_active")
    .eq("tenant_id", tenant.tenantId)
    .order("sort_order");

  return (
    <div className="max-w-lg">
      <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Production stages
      </h1>
      <nav className="mb-6 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link href="/settings/company" className="text-zinc-600 hover:underline dark:text-zinc-400">Company</Link>
        <Link href="/settings/branches" className="text-zinc-600 hover:underline dark:text-zinc-400">Branches</Link>
        <Link href="/settings/warehouses" className="text-zinc-600 hover:underline dark:text-zinc-400">Warehouses</Link>
        <Link href="/settings/roles" className="text-zinc-600 hover:underline dark:text-zinc-400">Roles</Link>
        <Link href="/settings/users" className="text-zinc-600 hover:underline dark:text-zinc-400">Users</Link>
        <Link href="/settings/capabilities" className="text-zinc-600 hover:underline dark:text-zinc-400">Business capabilities</Link>
      </nav>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        The processing stages a factory job can be created against (Factory &rarr; Processing
        Jobs). Deactivating a stage hides it from the new-job form but keeps it on any existing
        job that already used it; a stage still referenced by a job cannot be deleted.
      </p>

      <StageActiveToggleList stages={stages ?? []} action={setProductionStageActiveAction} />

      <h2 className="mb-4 mt-8 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        Add stage
      </h2>
      <NewProductionStageForm action={createProductionStageAction} />
    </div>
  );
}
