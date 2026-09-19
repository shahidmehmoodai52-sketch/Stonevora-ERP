"use client";

import { ActionForm } from "@/components/ActionForm";
import { generateProjectInvoiceAction } from "@/actions/projects";

type Material = { inventoryUnitId: string; label: string };

export function GenerateInvoiceForm({
  projectId,
  materials,
}: {
  projectId: string;
  materials: Material[];
}) {
  return (
    <ActionForm
      action={(formData) => generateProjectInvoiceAction(projectId, formData)}
      submitLabel="Generate invoice"
      pendingLabel="Generating…"
      offlineActionKey="generateProjectInvoice"
    >
      <input type="hidden" name="__projectId" value={projectId} />
      <label className="flex flex-col gap-1 text-sm">
        Invoice number
        <input name="invoiceNumber" required className="input" />
      </label>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Sell price per material</p>
        {materials.map((m, i) => (
          <div key={m.inventoryUnitId} className="flex items-center gap-3 text-sm">
            <input type="hidden" name={`prices[${i}][inventoryUnitId]`} value={m.inventoryUnitId} />
            <span className="w-64 truncate">{m.label}</span>
            <input
              name={`prices[${i}][unitPrice]`}
              type="number"
              step="0.0001"
              min="0"
              required
              className="input w-32"
              placeholder="price / area"
            />
          </div>
        ))}
      </div>
    </ActionForm>
  );
}
