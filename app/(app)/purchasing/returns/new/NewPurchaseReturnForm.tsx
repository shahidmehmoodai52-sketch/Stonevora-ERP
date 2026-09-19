"use client";

import { ActionForm, type SimpleActionResult } from "@/components/ActionForm";
import { PurchaseReturnLineItemsEditor } from "./PurchaseReturnLineItemsEditor";

type Option = { id: string; name: string };
type GrnLine = {
  id: string;
  productId: string;
  productLabel: string;
  uomId: string;
  returnable: number;
  unitCost: number;
  trackingMode: "simple" | "batch" | "unit";
};
type Location = { id: string; code: string; path: string | null };
type Batch = { id: string; product_id: string; batch_number: string; qty_on_hand: number };

export function NewPurchaseReturnForm({
  action,
  goodsReceiptId,
  supplierId,
  defaultBranchId,
  warehouses,
  grnLines,
  locations,
  batches,
}: {
  action: (formData: FormData) => Promise<SimpleActionResult>;
  goodsReceiptId: string;
  supplierId: string;
  defaultBranchId: string;
  warehouses: Option[];
  grnLines: GrnLine[];
  locations: Location[];
  batches: Batch[];
}) {
  return (
    <ActionForm
      action={action}
      submitLabel="Create return"
      className="flex flex-col gap-4"
      offlineActionKey="createPurchaseReturn"
    >
      <input type="hidden" name="__goodsReceiptId" value={goodsReceiptId} />
      <input type="hidden" name="supplierId" value={supplierId} />
      <input type="hidden" name="branchId" value={defaultBranchId} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Return number</label>
          <input name="returnNumber" required className="input" placeholder="PR-0001" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Shipping-from warehouse</label>
          <select name="warehouseId" required className="input">
            <option value="">—</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Reason</label>
        <input name="reason" className="input" />
      </div>
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Lines</h2>
      <PurchaseReturnLineItemsEditor grnLines={grnLines} locations={locations} batches={batches} />
    </ActionForm>
  );
}
