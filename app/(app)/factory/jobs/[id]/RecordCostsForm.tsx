"use client";

import { ActionForm } from "@/components/ActionForm";
import { recordProcessingCostsAction } from "@/actions/factory";

export function RecordCostsForm({ processingJobId }: { processingJobId: string }) {
  return (
    <ActionForm
      action={(formData) => recordProcessingCostsAction(processingJobId, formData)}
      submitLabel="Record costs"
      pendingLabel="Recording…"
      offlineActionKey="recordProcessingCosts"
    >
      <input type="hidden" name="__processingJobId" value={processingJobId} />
      <label className="flex flex-col gap-1 text-sm">
        Processing cost (labor + machine time)
        <input name="processingCost" type="number" step="0.0001" min="0" required className="input" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Overhead cost
        <input name="overheadCost" type="number" step="0.0001" min="0" className="input" />
      </label>
    </ActionForm>
  );
}
