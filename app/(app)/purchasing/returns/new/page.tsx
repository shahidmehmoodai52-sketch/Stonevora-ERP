import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { createPurchaseReturnAction } from "@/actions/purchasing";
import { NewPurchaseReturnForm } from "./NewPurchaseReturnForm";

export default async function NewPurchaseReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ grnId?: string }>;
}) {
  const { grnId } = await searchParams;
  if (!grnId) notFound();

  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const [{ data: grn }, { data: lines }, { data: warehouses }, { data: locations }, { data: batches }] =
    await Promise.all([
      supabase
        .from("goods_receipts")
        .select("id, grn_number, branch_id, purchase_orders(supplier_id)")
        .eq("id", grnId)
        .single(),
      supabase
        .from("goods_receipt_lines")
        .select("id, product_id, quantity, returned_quantity, uom_id, total_unit_cost, unit_cost, products(sku, name, inventory_tracking_mode)")
        .eq("goods_receipt_id", grnId),
      supabase.from("warehouses").select("id, name").eq("tenant_id", tenant.tenantId).order("name"),
      supabase.from("storage_locations").select("id, code, path").eq("tenant_id", tenant.tenantId).order("path"),
      supabase.from("inventory_batches").select("id, product_id, batch_number, qty_on_hand").eq("tenant_id", tenant.tenantId),
    ]);

  if (!grn || !grn.purchase_orders) notFound();

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">New purchase return</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">Against receipt {grn.grn_number}</p>
      <NewPurchaseReturnForm
        action={createPurchaseReturnAction.bind(null, grn.id)}
        goodsReceiptId={grn.id}
        supplierId={grn.purchase_orders.supplier_id}
        defaultBranchId={grn.branch_id}
        warehouses={warehouses ?? []}
        grnLines={(lines ?? []).map((l) => ({
          id: l.id,
          productId: l.product_id,
          productLabel: `${l.products?.sku} — ${l.products?.name}`,
          uomId: l.uom_id,
          returnable: l.quantity - l.returned_quantity,
          unitCost: l.total_unit_cost ?? l.unit_cost,
          trackingMode: (l.products?.inventory_tracking_mode ?? "simple") as "simple" | "batch" | "unit",
        }))}
        locations={(locations ?? []).map((l) => ({ id: l.id, code: l.code, path: l.path }))}
        batches={batches ?? []}
      />
    </div>
  );
}
