import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { createStockAdjustmentAction } from "@/actions/inventory";
import { NewStockAdjustmentForm } from "./NewStockAdjustmentForm";

export default async function NewStockAdjustmentPage() {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const [
    { data: branches },
    { data: warehouses },
    { data: products },
    { data: uoms },
    { data: locations },
    { data: batches },
  ] = await Promise.all([
    supabase.from("branches").select("id, name").eq("tenant_id", tenant.tenantId).order("name"),
    supabase.from("warehouses").select("id, name").eq("tenant_id", tenant.tenantId).order("name"),
    supabase
      .from("products")
      .select("id, sku, name, base_uom_id, inventory_tracking_mode")
      .eq("tenant_id", tenant.tenantId)
      .order("name"),
    supabase.from("uom").select("id, code"),
    supabase.from("storage_locations").select("id, code, path").eq("tenant_id", tenant.tenantId).order("path"),
    supabase.from("inventory_batches").select("id, product_id, batch_number, qty_on_hand").eq("tenant_id", tenant.tenantId),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">New stock adjustment</h1>
      <NewStockAdjustmentForm
        action={createStockAdjustmentAction}
        branches={branches ?? []}
        warehouses={warehouses ?? []}
        products={products ?? []}
        uoms={uoms ?? []}
        locations={(locations ?? []).map((l) => ({ id: l.id, code: l.code, path: l.path }))}
        batches={batches ?? []}
      />
    </div>
  );
}
