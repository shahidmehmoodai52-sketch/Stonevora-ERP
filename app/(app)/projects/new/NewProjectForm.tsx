"use client";

import { ActionForm } from "@/components/ActionForm";
import { createProjectAction } from "@/actions/projects";

type NamedOption = { id: string; name: string };

export function NewProjectForm({
  customers,
  branches,
  warehouses,
}: {
  customers: NamedOption[];
  branches: NamedOption[];
  warehouses: NamedOption[];
}) {
  return (
    <ActionForm action={createProjectAction} submitLabel="Create project" offlineActionKey="createProject">
      <label className="flex flex-col gap-1 text-sm">
        Project number
        <input name="projectNumber" required className="input" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Customer
        <select name="customerId" required className="input">
          <option value="">—</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
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
        <select name="warehouseId" className="input">
          <option value="">—</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Description
        <textarea name="description" rows={2} className="input" />
      </label>
    </ActionForm>
  );
}
