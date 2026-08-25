"use client";

import { ActionForm, type SimpleActionResult } from "@/components/ActionForm";

export function NewWarehouseForm({
  action,
  branches,
}: {
  action: (formData: FormData) => Promise<SimpleActionResult>;
  branches: { id: string; name: string }[];
}) {
  return (
    <ActionForm action={action} submitLabel="Add warehouse" className="flex flex-col gap-4 max-w-sm">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Branch</label>
        <select name="branchId" required className="input">
          <option value="">—</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Code</label>
        <input name="code" required className="input" placeholder="WH-01" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Name</label>
        <input name="name" required className="input" placeholder="Main Warehouse" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Type</label>
        <select name="type" className="input" defaultValue="warehouse">
          <option value="warehouse">Warehouse</option>
          <option value="yard">Yard</option>
          <option value="showroom">Showroom</option>
        </select>
      </div>
    </ActionForm>
  );
}
