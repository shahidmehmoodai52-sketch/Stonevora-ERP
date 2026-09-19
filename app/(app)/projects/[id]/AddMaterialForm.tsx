"use client";

import { ActionForm } from "@/components/ActionForm";
import { addProjectMaterialAction } from "@/actions/projects";

type MaterialOption = { id: string; label: string };

export function AddMaterialForm({
  projectId,
  availableUnits,
}: {
  projectId: string;
  availableUnits: MaterialOption[];
}) {
  return (
    <ActionForm
      action={(formData) => addProjectMaterialAction(projectId, formData)}
      submitLabel="Add material"
      pendingLabel="Adding…"
      offlineActionKey="addProjectMaterial"
      className="flex flex-wrap items-end gap-3"
    >
      <input type="hidden" name="__projectId" value={projectId} />
      <label className="flex flex-col gap-1 text-sm">
        Slab / remnant
        <select name="inventoryUnitId" required className="input min-w-64">
          <option value="">—</option>
          {availableUnits.map((u) => (
            <option key={u.id} value={u.id}>{u.label}</option>
          ))}
        </select>
      </label>
    </ActionForm>
  );
}
