import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { createSalesOrderAction } from "@/actions/sales";
import { NewSalesOrderForm } from "./NewSalesOrderForm";

export default async function NewSalesOrderPage() {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const [
    { data: customers },
    { data: branches },
    { data: warehouses },
    { data: products },
    { data: uoms },
    { data: priceLists },
    { data: priceListItems },
  ] = await Promise.all([
    supabase.from("customers").select("id, name, price_list_id").eq("tenant_id", tenant.tenantId).order("name"),
    supabase.from("branches").select("id, name").eq("tenant_id", tenant.tenantId).order("name"),
    supabase.from("warehouses").select("id, name").eq("tenant_id", tenant.tenantId).order("name"),
    supabase.from("products").select("id, sku, name, base_uom_id").eq("tenant_id", tenant.tenantId).order("name"),
    supabase.from("uom").select("id, code"),
    supabase.from("price_lists").select("id, name").eq("tenant_id", tenant.tenantId).order("name"),
    supabase.from("price_list_items").select("price_list_id, product_id, price"),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">New sales order</h1>
      <NewSalesOrderForm
        action={createSalesOrderAction}
        customers={customers ?? []}
        branches={branches ?? []}
        warehouses={warehouses ?? []}
        products={products ?? []}
        uoms={uoms ?? []}
        priceLists={priceLists ?? []}
        priceListItems={priceListItems ?? []}
      />
    </div>
  );
}
