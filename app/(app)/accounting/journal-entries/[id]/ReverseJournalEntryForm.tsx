"use client";

import { ActionForm } from "@/components/ActionForm";
import { reverseJournalEntryAction } from "@/actions/accounting";

export function ReverseJournalEntryForm({ journalEntryId }: { journalEntryId: string }) {
  return (
    <ActionForm
      action={reverseJournalEntryAction.bind(null, journalEntryId)}
      submitLabel="Reverse entry"
    >
      <label className="flex flex-col gap-1 text-sm">
        Reason
        <input name="reason" className="input" />
      </label>
    </ActionForm>
  );
}
