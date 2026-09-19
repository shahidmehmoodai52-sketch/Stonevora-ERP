"use client";

import { useState } from "react";

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

type Row = {
  productId: string;
  direction: "increase" | "decrease";
  quantity: string;
  uomId: string;
  unitCost: string;
  locationId: string;
  batchId: string;
};

const emptyRow: Row = {
  productId: "",
  direction: "increase",
  quantity: "",
  uomId: "",
  unitCost: "",
  locationId: "",
  batchId: "",
};

// Adjustable products are simple- or batch-tracked only -- unit-tracked
// (block/slab) products are rejected outright by post_stock_adjustment, so
// they're filtered out of the picker rather than offered and then failing
// at post time.
export function AdjustmentLineItemsEditor({
  products,
  uoms,
  locations,
  batches,
}: {
  products: Product[];
  uoms: Uom[];
  locations: Location[];
  batches: Batch[];
}) {
  const [rows, setRows] = useState<Row[]>([{ ...emptyRow }]);
  const adjustableProducts = products.filter((p) => p.inventory_tracking_mode !== "unit");

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function onProductChange(index: number, productId: string) {
    const product = adjustableProducts.find((p) => p.id === productId);
    updateRow(index, { productId, uomId: product?.base_uom_id ?? "", locationId: "", batchId: "" });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-2">Product</th>
              <th className="py-2 pr-2">Direction</th>
              <th className="py-2 pr-2">Qty</th>
              <th className="py-2 pr-2">UOM</th>
              <th className="py-2 pr-2">Unit cost</th>
              <th className="py-2 pr-2">Location / Batch</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const product = adjustableProducts.find((p) => p.id === row.productId);
              const isBatchTracked = product?.inventory_tracking_mode === "batch";
              const productBatches = batches.filter((b) => b.product_id === row.productId);
              return (
                <tr key={i} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-2">
                    <select
                      name={`lines[${i}][productId]`}
                      value={row.productId}
                      onChange={(e) => onProductChange(i, e.target.value)}
                      className="input min-w-40"
                    >
                      <option value="">—</option>
                      {adjustableProducts.map((p) => (
                        <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <select
                      name={`lines[${i}][direction]`}
                      value={row.direction}
                      onChange={(e) => updateRow(i, { direction: e.target.value as Row["direction"] })}
                      className="input w-28"
                    >
                      <option value="increase">Increase</option>
                      <option value="decrease">Decrease</option>
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      name={`lines[${i}][quantity]`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.quantity}
                      onChange={(e) => updateRow(i, { quantity: e.target.value })}
                      className="input w-24"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <select
                      name={`lines[${i}][uomId]`}
                      value={row.uomId}
                      onChange={(e) => updateRow(i, { uomId: e.target.value })}
                      className="input w-24"
                    >
                      <option value="">—</option>
                      {uoms.map((u) => (
                        <option key={u.id} value={u.id}>{u.code}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      name={`lines[${i}][unitCost]`}
                      type="number"
                      step="0.0001"
                      value={row.unitCost}
                      onChange={(e) => updateRow(i, { unitCost: e.target.value })}
                      disabled={row.direction !== "increase"}
                      placeholder={row.direction === "increase" ? "required" : "n/a"}
                      className="input w-28 disabled:opacity-40"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    {isBatchTracked ? (
                      <select
                        name={`lines[${i}][batchId]`}
                        value={row.batchId}
                        onChange={(e) => updateRow(i, { batchId: e.target.value })}
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
                        onChange={(e) => updateRow(i, { locationId: e.target.value })}
                        className="input min-w-32"
                      >
                        <option value="">—</option>
                        {locations.map((loc) => (
                          <option key={loc.id} value={loc.id}>{loc.path ?? loc.code}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="py-2">
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-zinc-400 hover:text-red-600"
                        aria-label="Remove line"
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={() => setRows((prev) => [...prev, { ...emptyRow }])}
        className="self-start text-sm font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
      >
        + Add line
      </button>
    </div>
  );
}
