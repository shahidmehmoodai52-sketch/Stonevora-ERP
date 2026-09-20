import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { ReverseJournalEntryForm } from "./ReverseJournalEntryForm";

export default async function JournalEntryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const { data: entry } = await supabase
    .from("journal_entries")
    .select("id, entry_date, reference_type, reference_id, description, reverses_entry_id, branch_id")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", id)
    .maybeSingle();
  if (!entry) notFound();

  const [{ data: lines }, { data: reversedBy }] = await Promise.all([
    supabase
      .from("journal_entry_lines")
      .select("id, account_id, debit, credit, description, chart_of_accounts(code, name)")
      .eq("tenant_id", tenant.tenantId)
      .eq("journal_entry_id", id)
      .order("created_at" as never, { ascending: true }),
    supabase
      .from("journal_entries")
      .select("id")
      .eq("tenant_id", tenant.tenantId)
      .eq("reverses_entry_id", id)
      .maybeSingle(),
  ]);

  const totalDebit = (lines ?? []).reduce((sum, l) => sum + Number(l.debit), 0);
  const totalCredit = (lines ?? []).reduce((sum, l) => sum + Number(l.credit), 0);

  const alreadyReversed = Boolean(reversedBy);
  const isReversal = Boolean(entry.reverses_entry_id);

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Journal entry — {entry.entry_date}
      </h1>
      <p className="mb-6 text-sm text-zinc-500">
        {entry.reference_type}
        {isReversal && " (reversal)"}
        {entry.description ? ` — ${entry.description}` : ""}
      </p>

      <div className="-mx-4 mb-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-2">Account</th>
              <th className="py-2 pr-2">Debit</th>
              <th className="py-2 pr-2">Credit</th>
              <th className="py-2">Description</th>
            </tr>
          </thead>
          <tbody>
            {(lines ?? []).map((l) => {
              const account = l.chart_of_accounts as unknown as { code: string; name: string } | null;
              return (
                <tr key={l.id} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-2 font-medium text-zinc-900 dark:text-zinc-50">
                    {account ? `${account.code} — ${account.name}` : "—"}
                  </td>
                  <td className="py-2 pr-2">{Number(l.debit) > 0 ? Number(l.debit).toFixed(4) : ""}</td>
                  <td className="py-2 pr-2">{Number(l.credit) > 0 ? Number(l.credit).toFixed(4) : ""}</td>
                  <td className="py-2">{l.description ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-medium text-zinc-900 dark:text-zinc-50">
              <td className="py-2 pr-2">Total</td>
              <td className="py-2 pr-2">{totalDebit.toFixed(4)}</td>
              <td className="py-2 pr-2">{totalCredit.toFixed(4)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {alreadyReversed ? (
        <p className="text-sm text-zinc-500">This entry has already been reversed.</p>
      ) : (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Reverse this entry</h2>
          <ReverseJournalEntryForm journalEntryId={entry.id} />
        </div>
      )}

      <Link href="/accounting/journal-entries" className="mt-6 inline-block text-sm text-zinc-500 hover:underline">
        ← Back to journal entries
      </Link>
    </div>
  );
}
