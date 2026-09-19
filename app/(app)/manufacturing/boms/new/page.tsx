import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { NewBomForm } from "./NewBomForm";

export default async function NewBomPage() {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const [{ data: products }, { data: uoms }] = await Promise.all([
    supabase
      .from("products")
      .select("id, sku, name, base_uom_id, inventory_tracking_mode")
      .eq("tenant_id", tenant.tenantId)
      .order("name"),
    supabase.from("uom").select("id, code"),
  ]);

  const finishedProducts = (products ?? []).filter((p) => p.inventory_tracking_mode === "batch");
  const rawMaterialProducts = (products ?? []).filter((p) => p.inventory_tracking_mode !== "unit");

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">New bill of materials</h1>
      <NewBomForm
        finishedProducts={finishedProducts}
        rawMaterialProducts={rawMaterialProducts}
        uoms={uoms ?? []}
      />
    </div>
  );
}
