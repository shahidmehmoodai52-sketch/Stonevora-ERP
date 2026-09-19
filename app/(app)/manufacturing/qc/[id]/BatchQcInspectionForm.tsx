"use client";

import { ActionForm } from "@/components/ActionForm";
import { recordBatchQcInspectionAction } from "@/actions/manufacturing";

export function BatchQcInspectionForm({ inventoryBatchId }: { inventoryBatchId: string }) {
  return (
    <ActionForm
      action={(formData) => recordBatchQcInspectionAction(inventoryBatchId, formData)}
      submitLabel="Record inspection"
      pendingLabel="Recording…"
      offlineActionKey="recordBatchQcInspection"
    >
      <input type="hidden" name="__inventoryBatchId" value={inventoryBatchId} />
      <label className="flex flex-col gap-1 text-sm">
        Outcome
        <select name="outcome" defaultValue="passed" required className="input">
          <option value="passed">Passed</option>
          <option value="rejected">Rejected</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Confirmed grade (overrides the firing-time grade if set)
        <input name="confirmedGrade" className="input" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Defects
        <textarea name="defects" rows={2} className="input" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Notes
        <textarea name="notes" rows={2} className="input" />
      </label>
    </ActionForm>
  );
}
