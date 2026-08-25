import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { fetchPermissionSet, hasPermission } from "@/lib/auth/permissions";
import { recordCustomerPaymentAction } from "@/actions/payments";
import { ActionForm } from "@/components/ActionForm";

export default async function SalesInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const [{ data: invoice }, { data: lines }, { data: payments }, permissionSet] = await Promise.all([
    supabase.from("sales_invoices").select("*, customers(id, name), branches(name)").eq("id", id).single(),
    supabase
      .from("sales_invoice_lines_secure")
      .select("id, quantity, unit_price, line_total, unit_cost, margin, products(sku, name)")
      .eq("sales_invoice_id", id),
    supabase
      .from("customer_payments")
      .select("payment_date, amount, method, reference")
      .eq("sales_invoice_id", id)
      .order("payment_date", { ascending: false }),
    fetchPermissionSet(tenant.tenantId),
  ]);

  if (!invoice) notFound();

  const showCost =
    hasPermission(permissionSet, "sales", "view_cost") || hasPermission(permissionSet, "sales", "view_profit");
  const showMargin = hasPermission(permissionSet, "sales", "view_profit");
  const balanceDue = invoice.total_amount - invoice.amount_paid;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">{invoice.invoice_number}</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        {invoice.customers?.name} · {invoice.branches?.name} · <span className="font-medium">{invoice.status}</span>
      </p>

      <div className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-2">Product</th>
              <th className="py-2">Qty</th>
              <th className="py-2">Price</th>
              <th className="py-2">Total</th>
              {showCost && <th className="hidden py-2 sm:table-cell">Cost</th>}
              {showMargin && <th className="hidden py-2 sm:table-cell">Margin</th>}
            </tr>
          </thead>
          <tbody>
            {(lines ?? []).map((l) => (
              <tr key={l.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2">{l.products?.sku} — {l.products?.name}</td>
                <td className="py-2">{l.quantity}</td>
                <td className="py-2">{l.unit_price}</td>
                <td className="py-2">{l.line_total}</td>
                {showCost && <td className="hidden py-2 sm:table-cell">{l.unit_cost ?? "—"}</td>}
                {showMargin && <td className="hidden py-2 sm:table-cell">{l.margin ?? "—"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mb-6 text-sm text-zinc-700 dark:text-zinc-300">
        Total: <span className="font-medium">{invoice.total_amount}</span> · Paid:{" "}
        <span className="font-medium">{invoice.amount_paid}</span> · Balance due:{" "}
        <span className="font-medium">{balanceDue}</span>
      </p>

      <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Payments</h2>
      <div className="-mx-4 mb-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-2">Date</th>
              <th className="py-2">Amount</th>
              <th className="py-2">Method</th>
              <th className="py-2">Reference</th>
            </tr>
          </thead>
          <tbody>
            {(payments ?? []).map((p, i) => (
              <tr key={i} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2">{p.payment_date}</td>
                <td className="py-2">{p.amount}</td>
                <td className="py-2">{p.method}</td>
                <td className="py-2">{p.reference}</td>
              </tr>
            ))}
            {(payments ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-zinc-500">No payments recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {balanceDue > 0 && invoice.customers && (
        <>
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Record payment</h2>
          <ActionForm
            action={recordCustomerPaymentAction.bind(null, invoice.customers.id)}
            submitLabel="Record payment"
            className="flex flex-col gap-4 max-w-sm"
          >
            <input type="hidden" name="salesInvoiceId" value={invoice.id} />
            <input type="hidden" name="branchId" value={invoice.branch_id} />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Amount</label>
              <input name="amount" type="number" step="0.01" defaultValue={balanceDue} required className="input" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Method</label>
              <input name="method" className="input" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Reference</label>
              <input name="reference" className="input" />
            </div>
          </ActionForm>
        </>
      )}
    </div>
  );
}
