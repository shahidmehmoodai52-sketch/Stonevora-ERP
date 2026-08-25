"use client";

import { useState } from "react";

type Product = { id: string; sku: string; name: string; base_uom_id: string | null };
type Uom = { id: string; code: string };

type Row = { productId: string; quantity: string; uomId: string; unitPrice: string };

const emptyRow: Row = { productId: "", quantity: "", uomId: "", unitPrice: "" };

export function LineItemsEditor({
  products,
  uoms,
  priceByProduct,
}: {
  products: Product[];
  uoms: Uom[];
  priceByProduct?: Record<string, number>;
}) {
  const [rows, setRows] = useState<Row[]>([{ ...emptyRow }]);

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function onProductChange(index: number, productId: string) {
    const product = products.find((p) => p.id === productId);
    const price = priceByProduct?.[productId];
    updateRow(index, {
      productId,
      uomId: product?.base_uom_id ?? "",
      unitPrice: price !== undefined ? String(price) : rows[index].unitPrice,
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-2">Product</th>
              <th className="py-2 pr-2">Qty</th>
              <th className="py-2 pr-2">UOM</th>
              <th className="py-2 pr-2">Unit price</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2 pr-2">
                  <select
                    name={`lines[${i}][productId]`}
                    value={row.productId}
                    onChange={(e) => onProductChange(i, e.target.value)}
                    className="input min-w-40"
                  >
                    <option value="">—</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-2">
                  <input
                    name={`lines[${i}][quantity]`}
                    type="number"
                    step="0.01"
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
                    name={`lines[${i}][unitPrice]`}
                    type="number"
                    step="0.0001"
                    value={row.unitPrice}
                    onChange={(e) => updateRow(i, { unitPrice: e.target.value })}
                    className="input w-28"
                  />
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
            ))}
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
