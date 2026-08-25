"use client";

import { ActionForm, type SimpleActionResult } from "@/components/ActionForm";
import { GrnLineItemsEditor } from "./GrnLineItemsEditor";

type Warehouse = { id: string; name: string };
type Location = { id: string; code: string; path: string | null };
type PoLine = {
  id: string;
  productId: string;
  productLabel: string;
  uomId: string;
  outstanding: number;
  unitCost: number;
  trackingMode: "simple" | "batch" | "unit";
};

export function ReceiveForm({
  action,
  defaultBranchId,
  warehouses,
  locations,
  poLines,
}: {
  action: (formData: FormData) => Promise<SimpleActionResult>;
  defaultBranchId: string;
  warehouses: Warehouse[];
  locations: Location[];
  poLines: PoLine[];
}) {
  return (
    <ActionForm action={action} submitLabel="Post goods receipt" className="flex flex-col gap-4">
      <input type="hidden" name="branchId" value={defaultBranchId} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">GRN number</label>
          <input name="grnNumber" required className="input" placeholder="GRN-0001" />
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

      <GrnLineItemsEditor poLines={poLines} locations={locations} />

      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Landed cost</h3>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Freight</label>
          <input name="freightCost" type="number" step="0.01" defaultValue={0} className="input" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Duty</label>
          <input name="dutyCost" type="number" step="0.01" defaultValue={0} className="input" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Handling</label>
          <input name="handlingCost" type="number" step="0.01" defaultValue={0} className="input" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Other</label>
          <input name="otherCost" type="number" step="0.01" defaultValue={0} className="input" />
        </div>
      </div>
      <div className="flex flex-col gap-1 max-w-xs">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Allocate by</label>
        <select name="landedCostBasis" className="input" defaultValue="value">
          <option value="value">Line value</option>
          <option value="quantity">Quantity</option>
        </select>
      </div>
    </ActionForm>
  );
}
