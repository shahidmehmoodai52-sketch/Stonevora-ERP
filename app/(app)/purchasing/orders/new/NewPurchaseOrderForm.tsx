"use client";

import { ActionForm, type SimpleActionResult } from "@/components/ActionForm";
import { LineItemsEditor } from "@/components/LineItemsEditor";

type Option = { id: string; name?: string; iso_code?: string | null };
type Product = { id: string; sku: string; name: string; base_uom_id: string | null };
type Uom = { id: string; code: string };

export function NewPurchaseOrderForm({
  action,
  suppliers,
  branches,
  products,
  uoms,
  currencies,
}: {
  action: (formData: FormData) => Promise<SimpleActionResult>;
  suppliers: Option[];
  branches: Option[];
  products: Product[];
  uoms: Uom[];
  currencies: Option[];
}) {
  return (
    <ActionForm
      action={action}
      submitLabel="Create purchase order"
      className="flex flex-col gap-4 max-w-3xl"
      offlineActionKey="createPurchaseOrder"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">PO number</label>
          <input name="poNumber" required className="input" placeholder="PO-0001" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Supplier</label>
          <select name="supplierId" required className="input">
            <option value="">—</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
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
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Currency</label>
          <select name="currencyId" className="input">
            <option value="">—</option>
            {currencies.map((c) => (
              <option key={c.id} value={c.id}>{c.iso_code}</option>
            ))}
          </select>
        </div>
      </div>
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Line items</h2>
      <LineItemsEditor products={products} uoms={uoms} />
    </ActionForm>
  );
}
