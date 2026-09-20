"use client";

import { ActionForm } from "@/components/ActionForm";
import { createStocktakeAction } from "@/actions/stocktakes";
import { StocktakeLineItemsEditor } from "./StocktakeLineItemsEditor";

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

export function NewStocktakeForm({
  branches,
  warehouses,
  products,
  uoms,
  locations,
  batches,
}: {
  branches: Option[];
  warehouses: Option[];
  products: Product[];
  uoms: Uom[];
  locations: Location[];
  batches: Batch[];
}) {
  return (
    <ActionForm
      action={createStocktakeAction}
      submitLabel="Create stocktake"
      className="flex flex-col gap-4 max-w-3xl"
      offlineActionKey="createStocktake"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Stocktake number</label>
          <input name="stocktakeNumber" required className="input" placeholder="STK-0001" />
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
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Lines to count</h2>
      <StocktakeLineItemsEditor products={products} uoms={uoms} locations={locations} batches={batches} />
    </ActionForm>
  );
}
