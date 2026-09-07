"use client";

import { ActionForm, type SimpleActionResult } from "@/components/ActionForm";

type Line = { id: string; productId: string; label: string; remaining: number };

export function NewDeliveryForm({
  action,
  salesOrderId,
  defaultBranchId,
  defaultWarehouseId,
  lines,
}: {
  action: (formData: FormData) => Promise<SimpleActionResult>;
  salesOrderId: string;
  defaultBranchId: string;
  defaultWarehouseId: string;
  lines: Line[];
}) {
  return (
    <ActionForm
      action={action}
      submitLabel="Dispatch delivery"
      className="flex flex-col gap-4"
      offlineActionKey="createDelivery"
    >
      <input type="hidden" name="__salesOrderId" value={salesOrderId} />
      <input type="hidden" name="branchId" value={defaultBranchId} />
      <input type="hidden" name="warehouseId" value={defaultWarehouseId} />
      <div className="flex flex-col gap-1 max-w-xs">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Delivery number</label>
        <input name="deliveryNumber" required className="input" placeholder="DEL-0001" />
      </div>
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-2">Product</th>
              <th className="py-2 pr-2">Remaining</th>
              <th className="py-2">Qty to dispatch</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2 pr-2">
                  {l.label}
                  <input type="hidden" name="lineId" value={l.id} />
                  <input type="hidden" name="lineProductId" value={l.productId} />
                </td>
                <td className="py-2 pr-2">{l.remaining}</td>
                <td className="py-2">
                  <input
                    name="lineQuantity"
                    type="number"
                    step="0.01"
                    max={l.remaining}
                    defaultValue={l.remaining}
                    className="input w-24"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ActionForm>
  );
}
