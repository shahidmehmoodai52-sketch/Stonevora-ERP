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
      <details className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
        <summary className="cursor-pointer text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Logistics details (optional)
        </summary>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-zinc-600 dark:text-zinc-400">Vehicle</label>
            <input name="vehicleInfo" className="input" placeholder="Truck reg. no." />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-zinc-600 dark:text-zinc-400">Driver name</label>
            <input name="driverName" className="input" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-zinc-600 dark:text-zinc-400">Transporter</label>
            <input name="transporterName" className="input" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-zinc-600 dark:text-zinc-400">Incoterm</label>
            <select name="incoterm" defaultValue="" className="input">
              <option value="">—</option>
              {["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"].map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-zinc-600 dark:text-zinc-400">Container number</label>
            <input name="containerNumber" className="input" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-zinc-600 dark:text-zinc-400">Shipment reference</label>
            <input name="shipmentReference" className="input" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-zinc-600 dark:text-zinc-400">Port of loading</label>
            <input name="portOfLoading" className="input" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-zinc-600 dark:text-zinc-400">Port of discharge</label>
            <input name="portOfDischarge" className="input" />
          </div>
        </div>
      </details>
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
