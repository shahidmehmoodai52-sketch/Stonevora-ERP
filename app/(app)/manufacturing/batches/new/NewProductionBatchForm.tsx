"use client";

import { ActionForm } from "@/components/ActionForm";
import { createProductionBatchAction } from "@/actions/manufacturing";

type Option = { id: string; label: string };
type NamedOption = { id: string; name: string };

export function NewProductionBatchForm({
  boms,
  branches,
  warehouses,
}: {
  boms: Option[];
  branches: NamedOption[];
  warehouses: NamedOption[];
}) {
  return (
    <ActionForm action={createProductionBatchAction} submitLabel="Create batch" offlineActionKey="createProductionBatch">
      <label className="flex flex-col gap-1 text-sm">
        Batch number
        <input name="batchNumber" required className="input" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Bill of materials
        <select name="bomId" required className="input">
          <option value="">—</option>
          {boms.map((b) => (
            <option key={b.id} value={b.id}>{b.label}</option>
          ))}
        </select>
      </label>
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
        Warehouse
        <select name="warehouseId" required className="input">
          <option value="">—</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Kiln
        <input name="kilnNumber" className="input" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Planned output quantity (in the BOM&apos;s own output UOM)
        <input name="plannedOutputQuantity" type="number" step="0.0001" min="0" required className="input" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Notes
        <textarea name="notes" rows={2} className="input" />
      </label>
    </ActionForm>
  );
}
