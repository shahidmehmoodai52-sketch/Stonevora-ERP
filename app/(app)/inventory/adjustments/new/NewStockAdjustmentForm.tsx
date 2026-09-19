"use client";

import { ActionForm, type SimpleActionResult } from "@/components/ActionForm";
import { AdjustmentLineItemsEditor } from "./AdjustmentLineItemsEditor";

type Option = { id: string; name: string };
type Product = {
  id: string;
  sku: string;
  name: string;
  base_uom_id: string | null;
  inventory_tracking_mode: "simple" | "batch" | "unit";
};
type Uom = { id: string; code: string };
type Location = { id: string; code: string; path: string | null };
type Batch = { id: string; product_id: string; batch_number: string; qty_on_hand: number };

const REASONS = [
  { value: "damage", label: "Damage" },
  { value: "shrinkage", label: "Shrinkage" },
  { value: "theft", label: "Theft" },
  { value: "found", label: "Found" },
  { value: "count_correction", label: "Count correction" },
  { value: "other", label: "Other" },
];

export function NewStockAdjustmentForm({
  action,
  branches,
  warehouses,
  products,
  uoms,
  locations,
  batches,
}: {
  action: (formData: FormData) => Promise<SimpleActionResult>;
  branches: Option[];
  warehouses: Option[];
  products: Product[];
  uoms: Uom[];
  locations: Location[];
  batches: Batch[];
}) {
  return (
    <ActionForm
      action={action}
      submitLabel="Create adjustment"
      className="flex flex-col gap-4 max-w-3xl"
      offlineActionKey="createStockAdjustment"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Adjustment number</label>
          <input name="adjustmentNumber" required className="input" placeholder="ADJ-0001" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Reason</label>
          <select name="reasonCode" required className="input">
            <option value="">—</option>
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
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
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Warehouse</label>
          <select name="warehouseId" required className="input">
            <option value="">—</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Notes</label>
        <input name="notes" className="input" />
      </div>
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Line items</h2>
      <AdjustmentLineItemsEditor products={products} uoms={uoms} locations={locations} batches={batches} />
    </ActionForm>
  );
}
