"use client";

import { ActionForm } from "@/components/ActionForm";
import { createChartOfAccountAction } from "@/actions/accounting";

type Option = { id: string; label: string };

export function NewAccountForm({ parentOptions }: { parentOptions: Option[] }) {
  return (
    <ActionForm action={createChartOfAccountAction} submitLabel="Add account" offlineActionKey="createChartOfAccount">
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Code
          <input name="code" required className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input name="name" required className="input" />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        Type
        <select name="accountType" required className="input">
          <option value="">—</option>
          <option value="asset">Asset</option>
          <option value="liability">Liability</option>
          <option value="equity">Equity</option>
          <option value="revenue">Revenue</option>
          <option value="expense">Expense</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Parent account
        <select name="parentAccountId" className="input">
          <option value="">—</option>
          {parentOptions.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </label>
    </ActionForm>
  );
}
