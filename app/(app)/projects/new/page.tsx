import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { NewProjectForm } from "./NewProjectForm";

export default async function NewProjectPage() {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const [{ data: customers }, { data: branches }, { data: warehouses }] = await Promise.all([
    supabase.from("customers").select("id, name").eq("tenant_id", tenant.tenantId).order("name"),
    supabase.from("branches").select("id, name").eq("tenant_id", tenant.tenantId).order("name"),
    supabase.from("warehouses").select("id, name").eq("tenant_id", tenant.tenantId).order("name"),
  ]);

  return (
    <div className="max-w-xl">
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">New project</h1>
      <NewProjectForm customers={customers ?? []} branches={branches ?? []} warehouses={warehouses ?? []} />
    </div>
  );
}
