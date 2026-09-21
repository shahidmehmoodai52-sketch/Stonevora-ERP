"use client";

import { ActionForm } from "@/components/ActionForm";
import { createProcessingJobAction } from "@/actions/factory";

type Option = { id: string; label: string };
type NamedOption = { id: string; name: string };

export function NewProcessingJobForm({
  defaultBlockId,
  blocks,
  branches,
  warehouses,
  operators,
  stages,
}: {
  defaultBlockId: string;
  blocks: Option[];
  branches: NamedOption[];
  warehouses: NamedOption[];
  operators: Option[];
  stages: NamedOption[];
}) {
  return (
    <ActionForm action={createProcessingJobAction} submitLabel="Create job" offlineActionKey="createProcessingJob">
      <label className="flex flex-col gap-1 text-sm">
        Job number
        <input name="jobNumber" required className="input" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Input block
        <select name="inputUnitId" defaultValue={defaultBlockId} required className="input">
          <option value="">—</option>
          {blocks.map((b) => (
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
        Stage
        <select name="stageId" required className="input">
          <option value="">—</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Machine
        <input name="machine" className="input" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Operator
        <select name="operatorId" className="input">
          <option value="">—</option>
          {operators.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Expected slab count
        <input name="expectedSlabCount" type="number" step="1" min="0" className="input" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Notes
        <textarea name="notes" className="input" rows={2} />
      </label>
    </ActionForm>
  );
}
