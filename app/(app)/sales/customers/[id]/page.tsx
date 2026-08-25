import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { recordCustomerPaymentAction } from "@/actions/payments";
import { ActionForm } from "@/components/ActionForm";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const [{ data: customer }, { data: ledger }, { data: branches }, { data: openInvoices }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).single(),
    supabase
      .from("customer_ledger")
      .select("entry_date, entry_type, reference, amount, running_balance")
      .eq("customer_id", id)
      .order("entry_date")
      .order("entry_type"),
    supabase.from("branches").select("id, name").eq("tenant_id", tenant.tenantId).order("name"),
    supabase
      .from("sales_invoices")
      .select("id, invoice_number, total_amount, amount_paid")
      .eq("customer_id", id)
      .in("status", ["posted", "partially_paid"]),
  ]);

  if (!customer) notFound();

  const balance = ledger && ledger.length > 0 ? ledger[ledger.length - 1].running_balance : 0;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">{customer.name}</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        Balance due: <span className="font-medium text-zinc-900 dark:text-zinc-50">{balance}</span>
      </p>

      <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Ledger</h2>
      <div className="-mx-4 mb-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-2">Date</th>
              <th className="py-2">Type</th>
              <th className="py-2">Reference</th>
              <th className="py-2">Amount</th>
              <th className="py-2">Balance</th>
            </tr>
          </thead>
          <tbody>
            {(ledger ?? []).map((row, i) => (
              <tr key={i} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="whitespace-nowrap py-2">{row.entry_date}</td>
                <td className="py-2">{row.entry_type}</td>
                <td className="py-2">{row.reference}</td>
                <td className="py-2">{row.amount}</td>
                <td className="py-2">{row.running_balance}</td>
              </tr>
            ))}
            {(ledger ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-zinc-500">No transactions yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Record payment</h2>
      <ActionForm
        action={recordCustomerPaymentAction.bind(null, id)}
        submitLabel="Record payment"
        className="flex flex-col gap-4 max-w-sm"
      >
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Branch</label>
          <select name="branchId" required className="input">
            <option value="">—</option>
            {(branches ?? []).map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Apply to invoice (optional)
          </label>
          <select name="salesInvoiceId" className="input">
            <option value="">On account</option>
            {(openInvoices ?? []).map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.invoice_number} — due {inv.total_amount - inv.amount_paid}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Amount</label>
          <input name="amount" type="number" step="0.01" required className="input" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Method</label>
          <input name="method" className="input" placeholder="bank transfer, cash, ..." />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Reference</label>
          <input name="reference" className="input" />
        </div>
      </ActionForm>
    </div>
  );
}
