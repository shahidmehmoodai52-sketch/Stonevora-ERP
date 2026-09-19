"use client";

import { useState } from "react";

type InvoiceLine = {
  id: string;
  productId: string;
  productLabel: string;
  uomId: string;
  returnable: number;
  unitPrice: number;
  unitCost: number | null;
  trackingMode: "simple" | "batch" | "unit";
};
type Location = { id: string; code: string; path: string | null };
type Batch = { id: string; product_id: string; batch_number: string; qty_on_hand: number };

export function SalesReturnLineItemsEditor({
  invoiceLines,
  locations,
  batches,
  showCost,
}: {
  invoiceLines: InvoiceLine[];
  locations: Location[];
  batches: Batch[];
  showCost: boolean;
}) {
  const returnable = invoiceLines.filter((l) => l.returnable > 0 && l.trackingMode !== "unit");
  const [rows, setRows] = useState(
    returnable.map((l) => ({
      selected: false,
      quantity: String(l.returnable),
      restock: true,
      restockLocationId: "",
      restockBatchId: "",
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
            <th className="py-2 pr-2"></th>
            <th className="py-2 pr-2">Product</th>
            <th className="py-2 pr-2">Returnable</th>
            <th className="py-2 pr-2">Qty to return</th>
            <th className="py-2 pr-2">Restock?</th>
            <th className="py-2">Restock into</th>
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
                  {/* Always rendered (not gated on row.selected) -- the server parser scans
                      sequential indices via this field's presence, so every returnable
                      line needs a stable slot; only quantity/restock (gated below) actually
                      determine whether the line is included in the submitted return. */}
                  <input type="hidden" name={`lines[${i}][salesInvoiceLineId]`} value={l.id} />
                  <input type="hidden" name={`lines[${i}][productId]`} value={l.productId} />
                  <input type="hidden" name={`lines[${i}][uomId]`} value={l.uomId} />
                  <input type="hidden" name={`lines[${i}][unitPrice]`} value={l.unitPrice} />
                  <input type="hidden" name={`lines[${i}][unitCost]`} value={l.unitCost ?? ""} />
                  {showCost && l.unitCost !== null && (
                    <div className="text-xs text-zinc-500">cost {l.unitCost}</div>
                  )}
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
                <td className="py-2 pr-2">
                  <input
                    type="checkbox"
                    name={row.selected ? `lines[${i}][restock]` : undefined}
                    value="true"
                    checked={row.restock}
                    disabled={!row.selected}
                    onChange={(e) => update(i, { restock: e.target.checked })}
                  />
                  {row.selected && !row.restock && <input type="hidden" name={`lines[${i}][restock]`} value="false" />}
                </td>
                <td className="py-2">
                  {row.selected && row.restock ? (
                    l.trackingMode === "batch" ? (
                      <select
                        name={`lines[${i}][restockBatchId]`}
                        value={row.restockBatchId}
                        onChange={(e) => update(i, { restockBatchId: e.target.value })}
                        className="input min-w-32"
                      >
                        <option value="">—</option>
                        {productBatches.map((b) => (
                          <option key={b.id} value={b.id}>{b.batch_number} ({b.qty_on_hand})</option>
                        ))}
                      </select>
                    ) : (
                      <select
                        name={`lines[${i}][restockLocationId]`}
                        value={row.restockLocationId}
                        onChange={(e) => update(i, { restockLocationId: e.target.value })}
                        className="input min-w-32"
                      >
                        <option value="">—</option>
                        {locations.map((loc) => (
                          <option key={loc.id} value={loc.id}>{loc.path ?? loc.code}</option>
                        ))}
                      </select>
                    )
                  ) : (
                    <span className="text-zinc-400">n/a</span>
                  )}
                </td>
              </tr>
            );
          })}
          {returnable.length === 0 && (
            <tr>
              <td colSpan={6} className="py-4 text-zinc-500">Nothing left to return on this invoice.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
