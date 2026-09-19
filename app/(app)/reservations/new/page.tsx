import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { NewReservationForm } from "./NewReservationForm";

export default async function NewReservationPage() {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const [{ data: customers }, { data: branches }, { data: warehouses }, { data: products }, { data: uoms }] =
    await Promise.all([
      supabase.from("customers").select("id, name").eq("tenant_id", tenant.tenantId).order("name"),
      supabase.from("branches").select("id, name").eq("tenant_id", tenant.tenantId).order("name"),
      supabase.from("warehouses").select("id, name").eq("tenant_id", tenant.tenantId).order("name"),
      supabase
        .from("products")
        .select("id, sku, name, base_uom_id, inventory_tracking_mode")
        .eq("tenant_id", tenant.tenantId)
        .order("name"),
      supabase.from("uom").select("id, code"),
    ]);

  const reservableProducts = (products ?? []).filter((p) => p.inventory_tracking_mode !== "unit");

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">New reservation</h1>
      <NewReservationForm
        customers={customers ?? []}
        branches={branches ?? []}
        warehouses={warehouses ?? []}
        products={reservableProducts}
        uoms={uoms ?? []}
      />
    </div>
  );
}
