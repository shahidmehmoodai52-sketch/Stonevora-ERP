"use client";

import { ActionForm } from "@/components/ActionForm";
import { recordStocktakeCountAction } from "@/actions/stocktakes";

export function RecordCountForm({ stocktakeLineId, currentCount }: { stocktakeLineId: string; currentCount: number | null }) {
  return (
    <ActionForm
      action={recordStocktakeCountAction.bind(null, stocktakeLineId)}
      submitLabel={currentCount === null ? "Record" : "Update"}
      className="flex items-center gap-2"
    >
      <input
        name="countedQuantity"
        type="number"
        step="0.01"
        min="0"
        required
        defaultValue={currentCount ?? ""}
        className="input w-24"
      />
    </ActionForm>
  );
}
