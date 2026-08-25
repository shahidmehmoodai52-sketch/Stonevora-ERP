import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";

export default async function SalesInvoicesPage() {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();
  const { data: invoices } = await supabase
    .from("sales_invoices")
    .select("id, invoice_number, invoice_date, status, total_amount, amount_paid, customers(name)")
    .eq("tenant_id", tenant.tenantId)
    .order("invoice_date", { ascending: false });

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Sales Invoices</h1>
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-3">Invoice #</th>
              <th className="py-3">Customer</th>
              <th className="hidden py-3 sm:table-cell">Date</th>
              <th className="py-3">Total</th>
              <th className="hidden py-3 md:table-cell">Paid</th>
              <th className="py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(invoices ?? []).map((inv) => (
              <tr key={inv.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="whitespace-nowrap py-3">
                  <Link href={`/sales/invoices/${inv.id}`} className="font-medium hover:underline">
                    {inv.invoice_number}
                  </Link>
                </td>
                <td className="py-3">{inv.customers?.name}</td>
                <td className="hidden py-3 sm:table-cell">{inv.invoice_date}</td>
                <td className="py-3">{inv.total_amount}</td>
                <td className="hidden py-3 md:table-cell">{inv.amount_paid}</td>
                <td className="py-3">{inv.status}</td>
              </tr>
            ))}
            {(invoices ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-zinc-500">No invoices yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
