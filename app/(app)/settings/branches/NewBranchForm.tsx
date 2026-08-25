"use client";

import { ActionForm, type SimpleActionResult } from "@/components/ActionForm";

export function NewBranchForm({
  action,
}: {
  action: (formData: FormData) => Promise<SimpleActionResult>;
}) {
  return (
    <ActionForm action={action} submitLabel="Add branch" className="flex flex-col gap-4 max-w-sm">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Code</label>
        <input name="code" required className="input" placeholder="HO" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Name</label>
        <input name="name" required className="input" placeholder="Head Office" />
      </div>
      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input type="checkbox" name="isHeadOffice" />
        Head office
      </label>
    </ActionForm>
  );
}
