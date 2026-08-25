import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { createPurchaseOrderAction } from "@/actions/purchasing";
import { NewPurchaseOrderForm } from "./NewPurchaseOrderForm";

export default async function NewPurchaseOrderPage() {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const [{ data: suppliers }, { data: branches }, { data: products }, { data: uoms }, { data: currencies }] =
    await Promise.all([
      supabase.from("suppliers").select("id, name").eq("tenant_id", tenant.tenantId).order("name"),
      supabase.from("branches").select("id, name").eq("tenant_id", tenant.tenantId).order("name"),
      supabase
        .from("products")
        .select("id, sku, name, base_uom_id")
        .eq("tenant_id", tenant.tenantId)
        .order("name"),
      supabase.from("uom").select("id, code"),
      supabase.from("currencies").select("id, iso_code").order("iso_code"),
    ]);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">New purchase order</h1>
      <NewPurchaseOrderForm
        action={createPurchaseOrderAction}
        suppliers={suppliers ?? []}
        branches={branches ?? []}
        products={products ?? []}
        uoms={uoms ?? []}
        currencies={currencies ?? []}
      />
    </div>
  );
}
