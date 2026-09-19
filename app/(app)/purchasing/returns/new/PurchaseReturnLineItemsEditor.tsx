"use client";

import { useState } from "react";

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

// No restock toggle here (unlike sales returns) -- a purchase return always
// decrements stock back out to the supplier; post_purchase_return has no
// "kept but written off" branch the way post_sales_return does.
export function PurchaseReturnLineItemsEditor({
  grnLines,
  locations,
  batches,
}: {
  grnLines: GrnLine[];
  locations: Location[];
  batches: Batch[];
}) {
  const returnable = grnLines.filter((l) => l.returnable > 0 && l.trackingMode !== "unit");
  const [rows, setRows] = useState(
    returnable.map(() => ({ selected: false, quantity: "", locationId: "", batchId: "" }))
  );

  function update(i: number, patch: Partial<(typeof rows)[number]>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
            <th className="py-2 pr-2"></th>
            <th className="py-2 pr-2">Product</th>
            <th className="py-2 pr-2">Returnable</th>
            <th className="py-2 pr-2">Qty to return</th>
            <th className="py-2 pr-2">Unit cost</th>
            <th className="py-2">From location / batch</th>
          </tr>
        </thead>
        <tbody>
          {returnable.map((l, i) => {
            const row = rows[i];
            const productBatches = batches.filter((b) => b.product_id === l.productId);
            return (
              <tr key={l.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2 pr-2">
                  <input
                    type="checkbox"
                    checked={row.selected}
                    onChange={(e) => update(i, { selected: e.target.checked })}
                  />
                </td>
                <td className="py-2 pr-2">
                  {l.productLabel}
                  {/* Always rendered -- see SalesReturnLineItemsEditor.tsx's identical note on
                      why the identifying fields can't be gated on row.selected. */}
                  <input type="hidden" name={`lines[${i}][goodsReceiptLineId]`} value={l.id} />
                  <input type="hidden" name={`lines[${i}][productId]`} value={l.productId} />
                  <input type="hidden" name={`lines[${i}][uomId]`} value={l.uomId} />
                  <input type="hidden" name={`lines[${i}][unitCost]`} value={l.unitCost} />
                </td>
                <td className="py-2 pr-2">{l.returnable}</td>
                <td className="py-2 pr-2">
                  <input
                    name={row.selected ? `lines[${i}][quantity]` : undefined}
                    type="number"
                    step="0.01"
                    min="0"
                    max={l.returnable}
                    value={row.quantity}
                    disabled={!row.selected}
                    onChange={(e) => update(i, { quantity: e.target.value })}
                    className="input w-24 disabled:opacity-40"
                  />
                </td>
                <td className="py-2 pr-2">{l.unitCost}</td>
                <td className="py-2">
                  {row.selected ? (
                    l.trackingMode === "batch" ? (
                      <select
                        name={`lines[${i}][batchId]`}
                        value={row.batchId}
                        onChange={(e) => update(i, { batchId: e.target.value })}
                        className="input min-w-32"
                      >
                        <option value="">—</option>
                        {productBatches.map((b) => (
                          <option key={b.id} value={b.id}>{b.batch_number} ({b.qty_on_hand})</option>
                        ))}
                      </select>
                    ) : (
                      <select
                        name={`lines[${i}][locationId]`}
                        value={row.locationId}
                        onChange={(e) => update(i, { locationId: e.target.value })}
                        className="input min-w-32"
                      >
                        <option value="">—</option>
                        {locations.map((loc) => (
                          <option key={loc.id} value={loc.id}>{loc.path ?? loc.code}</option>
                        ))}
                      </select>
                    )
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
          {returnable.length === 0 && (
            <tr>
              <td colSpan={6} className="py-4 text-zinc-500">Nothing left to return on this receipt.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
