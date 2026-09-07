import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { confirmSalesOrderAction, createDeliveryAction, generateInvoiceAction } from "@/actions/sales";
import { ConfirmOrderButton } from "./ConfirmOrderButton";
import { NewDeliveryForm } from "./NewDeliveryForm";
import { GenerateInvoiceForm } from "./GenerateInvoiceForm";

export default async function SalesOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireActiveTenant();
  const supabase = await createClient();

  const [{ data: so }, { data: lines }, { data: deliveries }, { data: invoices }] = await Promise.all([
    supabase
      .from("sales_orders")
      .select("*, customers(name), branches(name), warehouses(name)")
      .eq("id", id)
      .single(),
    supabase
      .from("sales_order_lines")
      .select("id, product_id, quantity, uom_id, unit_price, reserved_quantity, delivered_quantity, products(sku, name)")
      .eq("sales_order_id", id),
    supabase
      .from("deliveries")
      .select("id, delivery_number, delivery_date, status")
      .eq("sales_order_id", id)
      .order("delivery_date", { ascending: false }),
    supabase.from("sales_invoices").select("id, invoice_number, sales_order_id").eq("sales_order_id", id),
  ]);

  if (!so) notFound();

  const deliverableLines = (lines ?? []).filter((l) => l.reserved_quantity > l.delivered_quantity);

  return (
    <div className="max-w-3xl">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{so.so_number}</h1>
        {so.status === "draft" && <ConfirmOrderButton salesOrderId={id} action={confirmSalesOrderAction} />}
      </div>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        {so.customers?.name} · {so.branches?.name} · {so.warehouses?.name ?? "no warehouse set"} ·{" "}
        <span className="font-medium">{so.status}</span>
      </p>

      <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Lines</h2>
      <div className="-mx-4 mb-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-2">Product</th>
              <th className="py-2">Qty</th>
              <th className="py-2">Price</th>
              <th className="hidden py-2 sm:table-cell">Reserved</th>
              <th className="hidden py-2 sm:table-cell">Delivered</th>
            </tr>
          </thead>
          <tbody>
            {(lines ?? []).map((l) => (
              <tr key={l.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2">{l.products?.sku} — {l.products?.name}</td>
                <td className="py-2">{l.quantity}</td>
                <td className="py-2">{l.unit_price}</td>
                <td className="hidden py-2 sm:table-cell">{l.reserved_quantity}</td>
                <td className="hidden py-2 sm:table-cell">{l.delivered_quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Deliveries</h2>
      <div className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-2">Delivery #</th>
              <th className="py-2">Date</th>
              <th className="py-2">Status</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(deliveries ?? []).map((d) => {
              const invoice = (invoices ?? []).find((inv) => inv.sales_order_id === so.id);
              return (
                <tr key={d.id} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2">{d.delivery_number}</td>
                  <td className="py-2">{d.delivery_date}</td>
                  <td className="py-2">{d.status}</td>
                  <td className="py-2">
                    {d.status === "dispatched" && !invoice && (
                      <GenerateInvoiceForm
                        deliveryId={d.id}
                        salesOrderId={so.id}
                        action={generateInvoiceAction}
                      />
                    )}
                    {invoice && (
                      <Link href={`/sales/invoices/${invoice.id}`} className="text-sm hover:underline">
                        {invoice.invoice_number}
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
            {(deliveries ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-zinc-500">No deliveries yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {deliverableLines.length > 0 && (
        <>
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Create &amp; dispatch delivery
          </h2>
          <NewDeliveryForm
            action={createDeliveryAction.bind(null, id)}
            salesOrderId={id}
            defaultBranchId={so.branch_id}
            defaultWarehouseId={so.warehouse_id ?? ""}
            lines={deliverableLines.map((l) => ({
              id: l.id,
              productId: l.product_id,
              label: `${l.products?.sku} — ${l.products?.name}`,
              remaining: l.reserved_quantity - l.delivered_quantity,
            }))}
          />
        </>
      )}
    </div>
  );
}
