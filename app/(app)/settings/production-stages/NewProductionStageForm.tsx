"use client";

import { ActionForm, type SimpleActionResult } from "@/components/ActionForm";

export function NewProductionStageForm({
  action,
}: {
  action: (formData: FormData) => Promise<SimpleActionResult>;
}) {
  return (
    <ActionForm action={action} submitLabel="Add stage" className="flex flex-col gap-4 max-w-sm">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Code</label>
        <input name="code" required className="input" placeholder="edge_profiling" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Name</label>
        <input name="name" required className="input" placeholder="Edge Profiling" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Sort order</label>
        <input name="sortOrder" type="number" step="1" defaultValue={0} className="input" />
      </div>
    </ActionForm>
  );
}
