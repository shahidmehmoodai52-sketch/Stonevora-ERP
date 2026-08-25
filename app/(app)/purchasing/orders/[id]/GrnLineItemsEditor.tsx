"use client";

import { useState } from "react";

type PoLine = {
  id: string;
  productId: string;
  productLabel: string;
  uomId: string;
  outstanding: number;
  unitCost: number;
  trackingMode: "simple" | "batch" | "unit";
};

type Location = { id: string; path: string | null; code: string };

export function GrnLineItemsEditor({ poLines, locations }: { poLines: PoLine[]; locations: Location[] }) {
  const [rows, setRows] = useState(
    poLines.map((l) => ({
      poLineId: l.id,
      productId: l.productId,
      uomId: l.uomId,
      quantity: l.outstanding > 0 ? String(l.outstanding) : "",
      unitCost: String(l.unitCost),
      locationId: "",
      batchNumber: "",
      lotNumber: "",
      shadeCode: "",
      caliberCode: "",
      trackingMode: l.trackingMode,
    }))
  );

  function update(i: number, patch: Partial<(typeof rows)[number]>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
            <th className="py-2 pr-2">Product</th>
            <th className="py-2 pr-2">Qty received</th>
            <th className="py-2 pr-2">Unit cost</th>
            <th className="py-2 pr-2">Location</th>
            <th className="py-2 pr-2">Batch #</th>
            <th className="py-2 pr-2">Shade</th>
            <th className="py-2">Caliber</th>
          </tr>
        </thead>
        <tbody>
          {poLines.map((l, i) => (
            <tr key={l.id} className="border-b border-zinc-100 dark:border-zinc-900">
              <td className="py-2 pr-2">
                {l.productLabel}
                <input type="hidden" name={`lines[${i}][purchaseOrderLineId]`} value={l.id} />
                <input type="hidden" name={`lines[${i}][productId]`} value={l.productId} />
                <input type="hidden" name={`lines[${i}][uomId]`} value={l.uomId} />
              </td>
              <td className="py-2 pr-2">
                <input
                  name={`lines[${i}][quantity]`}
                  type="number"
                  step="0.01"
                  value={rows[i].quantity}
                  onChange={(e) => update(i, { quantity: e.target.value })}
                  className="input w-24"
                />
              </td>
              <td className="py-2 pr-2">
                <input
                  name={`lines[${i}][unitCost]`}
                  type="number"
                  step="0.0001"
                  value={rows[i].unitCost}
                  onChange={(e) => update(i, { unitCost: e.target.value })}
                  className="input w-28"
                />
              </td>
              <td className="py-2 pr-2">
                <select
                  name={`lines[${i}][locationId]`}
                  value={rows[i].locationId}
                  onChange={(e) => update(i, { locationId: e.target.value })}
                  className="input min-w-32"
                >
                  <option value="">—</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.path ?? loc.code}</option>
                  ))}
                </select>
              </td>
              <td className="py-2 pr-2">
                <input
                  name={`lines[${i}][batchNumber]`}
                  value={rows[i].batchNumber}
                  onChange={(e) => update(i, { batchNumber: e.target.value })}
                  disabled={l.trackingMode !== "batch"}
                  className="input w-28 disabled:opacity-40"
                  placeholder={l.trackingMode === "batch" ? "required" : "n/a"}
                />
              </td>
              <td className="py-2 pr-2">
                <input
                  name={`lines[${i}][shadeCode]`}
                  value={rows[i].shadeCode}
                  onChange={(e) => update(i, { shadeCode: e.target.value })}
                  disabled={l.trackingMode !== "batch"}
                  className="input w-20 disabled:opacity-40"
                />
              </td>
              <td className="py-2">
                <input
                  name={`lines[${i}][caliberCode]`}
                  value={rows[i].caliberCode}
                  onChange={(e) => update(i, { caliberCode: e.target.value })}
                  disabled={l.trackingMode !== "batch"}
                  className="input w-20 disabled:opacity-40"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
