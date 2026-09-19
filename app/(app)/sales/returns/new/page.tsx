import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { fetchPermissionSet, hasPermission } from "@/lib/auth/permissions";
import { createSalesReturnAction } from "@/actions/sales";
import { NewSalesReturnForm } from "./NewSalesReturnForm";

export default async function NewSalesReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ invoiceId?: string }>;
}) {
  const { invoiceId } = await searchParams;
  if (!invoiceId) notFound();

  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const [{ data: invoice }, { data: lines }, { data: warehouses }, { data: locations }, { data: batches }, permissionSet] =
    await Promise.all([
      supabase.from("sales_invoices").select("id, customer_id, branch_id, invoice_number").eq("id", invoiceId).single(),
      supabase
        .from("sales_invoice_lines")
        .select("id, product_id, quantity, returned_quantity, unit_price, unit_cost, uom_id, products(sku, name, inventory_tracking_mode)")
        .eq("sales_invoice_id", invoiceId),
      supabase.from("warehouses").select("id, name").eq("tenant_id", tenant.tenantId).order("name"),
      supabase.from("storage_locations").select("id, code, path").eq("tenant_id", tenant.tenantId).order("path"),
      supabase.from("inventory_batches").select("id, product_id, batch_number, qty_on_hand").eq("tenant_id", tenant.tenantId),
      fetchPermissionSet(tenant.tenantId),
    ]);

  if (!invoice) notFound();

  const showCost =
    hasPermission(permissionSet, "sales", "view_cost") || hasPermission(permissionSet, "sales", "view_profit");

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">New sales return</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">Against invoice {invoice.invoice_number}</p>
      <NewSalesReturnForm
        action={createSalesReturnAction.bind(null, invoice.id)}
        salesInvoiceId={invoice.id}
        customerId={invoice.customer_id}
        defaultBranchId={invoice.branch_id}
        warehouses={warehouses ?? []}
        invoiceLines={(lines ?? []).map((l) => ({
          id: l.id,
          productId: l.product_id,
          productLabel: `${l.products?.sku} — ${l.products?.name}`,
          uomId: l.uom_id,
          returnable: l.quantity - l.returned_quantity,
          unitPrice: l.unit_price,
          unitCost: l.unit_cost,
          trackingMode: (l.products?.inventory_tracking_mode ?? "simple") as "simple" | "batch" | "unit",
        }))}
        locations={(locations ?? []).map((l) => ({ id: l.id, code: l.code, path: l.path }))}
        batches={batches ?? []}
        showCost={showCost}
      />
    </div>
  );
}
