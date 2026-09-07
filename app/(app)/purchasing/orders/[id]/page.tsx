import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { createGoodsReceiptAction } from "@/actions/purchasing";
import { ReceiveForm } from "./ReceiveForm";

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const [{ data: po }, { data: lines }, { data: warehouses }, { data: locations }, { data: receipts }] =
    await Promise.all([
      supabase.from("purchase_orders").select("*, suppliers(name), branches(name)").eq("id", id).single(),
      supabase
        .from("purchase_order_lines")
        .select("id, product_id, quantity, uom_id, unit_price, received_quantity, products(sku, name, inventory_tracking_mode)")
        .eq("purchase_order_id", id),
      supabase.from("warehouses").select("id, name").eq("tenant_id", tenant.tenantId).order("name"),
      supabase.from("storage_locations").select("id, code, path").eq("tenant_id", tenant.tenantId).order("path"),
      supabase
        .from("goods_receipts")
        .select("id, grn_number, receipt_date, status, freight_cost, duty_cost, handling_cost, other_cost")
        .eq("purchase_order_id", id)
        .order("receipt_date", { ascending: false }),
    ]);

  if (!po) notFound();

  const outstandingLines = (lines ?? []).filter((l) => l.received_quantity < l.quantity);

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">{po.po_number}</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        {po.suppliers?.name} · {po.branches?.name} · <span className="font-medium">{po.status}</span>
      </p>

      <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Lines</h2>
      <div className="-mx-4 mb-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-2">Product</th>
              <th className="py-2">Ordered</th>
              <th className="py-2">Received</th>
              <th className="py-2">Unit price</th>
            </tr>
          </thead>
          <tbody>
            {(lines ?? []).map((l) => (
              <tr key={l.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2">{l.products?.sku} — {l.products?.name}</td>
                <td className="py-2">{l.quantity}</td>
                <td className="py-2">{l.received_quantity}</td>
                <td className="py-2">{l.unit_price}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Goods receipts</h2>
      <div className="-mx-4 mb-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-2">GRN #</th>
              <th className="py-2">Date</th>
              <th className="py-2">Status</th>
              <th className="py-2">Landed cost</th>
            </tr>
          </thead>
          <tbody>
            {(receipts ?? []).map((r) => (
              <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2">{r.grn_number}</td>
                <td className="py-2">{r.receipt_date}</td>
                <td className="py-2">{r.status}</td>
                <td className="py-2">{r.freight_cost + r.duty_cost + r.handling_cost + r.other_cost}</td>
              </tr>
            ))}
            {(receipts ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-zinc-500">No receipts yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {outstandingLines.length > 0 ? (
        <>
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Receive goods (GRN)</h2>
          <ReceiveForm
            action={createGoodsReceiptAction.bind(null, id)}
            purchaseOrderId={id}
            defaultBranchId={po.branch_id}
            warehouses={warehouses ?? []}
            locations={(locations ?? []).map((l) => ({ id: l.id, code: l.code, path: l.path }))}
            poLines={outstandingLines.map((l) => ({
              id: l.id,
              productId: l.product_id,
              productLabel: `${l.products?.sku} — ${l.products?.name}`,
              uomId: l.uom_id,
              outstanding: l.quantity - l.received_quantity,
              unitCost: l.unit_price,
              trackingMode: (l.products?.inventory_tracking_mode ?? "simple") as "simple" | "batch" | "unit",
            }))}
          />
        </>
      ) : (
        <p className="text-sm text-zinc-500">All lines fully received.</p>
      )}
    </div>
  );
}
