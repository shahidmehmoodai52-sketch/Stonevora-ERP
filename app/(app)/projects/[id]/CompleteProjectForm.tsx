"use client";

import { ActionForm } from "@/components/ActionForm";
import { completeProjectAction } from "@/actions/projects";

export function CompleteProjectForm({ projectId }: { projectId: string }) {
  return (
    <ActionForm
      action={(formData) => completeProjectAction(projectId, formData)}
      submitLabel="Complete project"
      pendingLabel="Completing…"
      offlineActionKey="completeProject"
    >
      <input type="hidden" name="__projectId" value={projectId} />
      <label className="flex flex-col gap-1 text-sm">
        Labor cost
        <input name="laborCost" type="number" step="0.0001" min="0" required className="input" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Overhead cost
        <input name="overheadCost" type="number" step="0.0001" min="0" className="input" />
      </label>
    </ActionForm>
  );
}
