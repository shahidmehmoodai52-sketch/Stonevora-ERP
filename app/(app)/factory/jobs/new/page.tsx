import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { NewProcessingJobForm } from "./NewProcessingJobForm";

export default async function NewProcessingJobPage({
  searchParams,
}: {
  searchParams: Promise<{ blockId?: string }>;
}) {
  const { blockId } = await searchParams;
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const [{ data: blocks }, { data: branches }, { data: warehouses }, { data: members }] = await Promise.all([
    supabase
      .from("inventory_units")
      .select("id, unit_code, products(sku, name)")
      .eq("tenant_id", tenant.tenantId)
      .eq("unit_type", "block")
      .eq("status", "in_stock")
      .order("unit_code"),
    supabase.from("branches").select("id, name").eq("tenant_id", tenant.tenantId).order("name"),
    supabase.from("warehouses").select("id, name").eq("tenant_id", tenant.tenantId).order("name"),
    supabase
      .from("user_tenants")
      .select("user_id, profiles!user_tenants_user_id_fkey(full_name, email)")
      .eq("tenant_id", tenant.tenantId),
  ]);

  return (
    <div className="max-w-xl">
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">New processing job</h1>
      <NewProcessingJobForm
        defaultBlockId={blockId ?? ""}
        blocks={(blocks ?? []).map((b) => ({
          id: b.id,
          label: `${b.unit_code} — ${b.products?.sku ?? ""} ${b.products?.name ?? ""}`,
        }))}
        branches={branches ?? []}
        warehouses={warehouses ?? []}
        operators={(members ?? []).map((m) => ({
          id: m.user_id,
          label: m.profiles?.full_name || m.profiles?.email || m.user_id,
        }))}
      />
    </div>
  );
}
