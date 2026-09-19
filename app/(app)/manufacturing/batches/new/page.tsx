import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { NewProductionBatchForm } from "./NewProductionBatchForm";

export default async function NewProductionBatchPage() {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const [{ data: boms }, { data: branches }, { data: warehouses }] = await Promise.all([
    supabase
      .from("bill_of_materials")
      .select("id, bom_number, output_quantity, products(sku, name)")
      .eq("tenant_id", tenant.tenantId)
      .eq("is_active", true)
      .order("bom_number"),
    supabase.from("branches").select("id, name").eq("tenant_id", tenant.tenantId).order("name"),
    supabase.from("warehouses").select("id, name").eq("tenant_id", tenant.tenantId).order("name"),
  ]);

  return (
    <div className="max-w-xl">
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">New production batch</h1>
      <NewProductionBatchForm
        boms={(boms ?? []).map((b) => ({
          id: b.id,
          label: `${b.bom_number} — ${b.products?.sku ?? ""} ${b.products?.name ?? ""} (output ${b.output_quantity})`,
        }))}
        branches={branches ?? []}
        warehouses={warehouses ?? []}
      />
    </div>
  );
}
