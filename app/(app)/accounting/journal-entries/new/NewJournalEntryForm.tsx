"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { postJournalEntryAction } from "@/actions/accounting";

type NamedOption = { id: string; name: string };
type Account = { id: string; code: string; name: string };

type Row = { accountId: string; debit: string; credit: string; description: string };
const emptyRow: Row = { accountId: "", debit: "", credit: "", description: "" };

export function NewJournalEntryForm({
  branches,
  accounts,
}: {
  branches: NamedOption[];
  accounts: Account[];
}) {
  const [rows, setRows] = useState<Row[]>([{ ...emptyRow }, { ...emptyRow }]);

  function update(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  const totalDebit = rows.reduce((sum, r) => sum + (Number(r.debit) || 0), 0);
  const totalCredit = rows.reduce((sum, r) => sum + (Number(r.credit) || 0), 0);
  const balanced = totalDebit === totalCredit && totalDebit > 0;

  return (
    <ActionForm action={postJournalEntryAction} submitLabel="Post entry" offlineActionKey="postJournalEntry">
      <label className="flex flex-col gap-1 text-sm">
        Branch
        <select name="branchId" required className="input">
          <option value="">—</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Entry date
        <input name="entryDate" type="date" className="input" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Description
        <input name="description" className="input" />
      </label>

      <div className="flex flex-col gap-3">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                <th className="py-2 pr-2">Account</th>
                <th className="py-2 pr-2">Debit</th>
                <th className="py-2 pr-2">Credit</th>
                <th className="py-2 pr-2">Line description</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-2">
                    <select
                      name={`lines[${i}][accountId]`}
                      value={row.accountId}
                      onChange={(e) => update(i, { accountId: e.target.value })}
                      className="input min-w-48"
                    >
                      <option value="">—</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      name={`lines[${i}][debit]`}
                      type="number"
                      step="0.0001"
                      min="0"
                      value={row.debit}
                      onChange={(e) => update(i, { debit: e.target.value, credit: e.target.value ? "" : row.credit })}
                      className="input w-28"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      name={`lines[${i}][credit]`}
                      type="number"
                      step="0.0001"
                      min="0"
                      value={row.credit}
                      onChange={(e) => update(i, { credit: e.target.value, debit: e.target.value ? "" : row.debit })}
                      className="input w-28"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      name={`lines[${i}][description]`}
                      value={row.description}
                      onChange={(e) => update(i, { description: e.target.value })}
                      className="input min-w-32"
                    />
                  </td>
                  <td className="py-2">
                    {rows.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-zinc-400 hover:text-red-600"
                        aria-label="Remove line"
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, { ...emptyRow }])}
          className="self-start text-sm font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
        >
          + Add line
        </button>
        <p className={`text-sm ${balanced ? "text-emerald-600" : "text-amber-600"}`}>
          Total debit {totalDebit.toFixed(4)} · Total credit {totalCredit.toFixed(4)}
          {!balanced && " — must balance before posting"}
        </p>
      </div>
    </ActionForm>
  );
}
