"use client";

import { ActionForm } from "@/components/ActionForm";
import { completeProductionBatchAction } from "@/actions/manufacturing";

type Location = { id: string; code: string; path: string | null };

export function CompleteBatchForm({
  productionBatchId,
  locations,
}: {
  productionBatchId: string;
  locations: Location[];
}) {
  return (
    <ActionForm
      action={(formData) => completeProductionBatchAction(productionBatchId, formData)}
      submitLabel="Complete batch"
      pendingLabel="Completing…"
      offlineActionKey="completeProductionBatch"
    >
      <input type="hidden" name="__productionBatchId" value={productionBatchId} />
      <label className="flex flex-col gap-1 text-sm">
        Actual output quantity
        <input name="actualOutputQuantity" type="number" step="0.0001" min="0" required className="input" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Output location
        <select name="outputLocationId" required className="input">
          <option value="">—</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>{loc.path ?? loc.code}</option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Shade code
          <input name="shadeCode" className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Caliber code
          <input name="caliberCode" className="input" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Labor cost
          <input name="laborCost" type="number" step="0.0001" min="0" className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Overhead cost
          <input name="overheadCost" type="number" step="0.0001" min="0" className="input" />
        </label>
      </div>
    </ActionForm>
  );
}
