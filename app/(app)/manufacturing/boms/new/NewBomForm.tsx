"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { createBomAction } from "@/actions/manufacturing";

type Product = { id: string; sku: string; name: string; base_uom_id: string | null };
type Uom = { id: string; code: string };

type Row = { rawMaterialProductId: string; quantity: string; uomId: string };
const emptyRow: Row = { rawMaterialProductId: "", quantity: "", uomId: "" };

export function NewBomForm({
  finishedProducts,
  rawMaterialProducts,
  uoms,
}: {
  finishedProducts: Product[];
  rawMaterialProducts: Product[];
  uoms: Uom[];
}) {
  const [rows, setRows] = useState<Row[]>([{ ...emptyRow }]);

  function update(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function onRawMaterialChange(i: number, productId: string) {
    const product = rawMaterialProducts.find((p) => p.id === productId);
    update(i, { rawMaterialProductId: productId, uomId: product?.base_uom_id ?? "" });
  }

  return (
    <ActionForm action={createBomAction} submitLabel="Create BOM" offlineActionKey="createBom">
      <label className="flex flex-col gap-1 text-sm">
        BOM number
        <input name="bomNumber" required className="input" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Name
        <input name="name" className="input" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Finished product (batch-tracked)
        <select name="productId" required className="input">
          <option value="">—</option>
          {finishedProducts.map((p) => (
            <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Output quantity (per this recipe)
          <input name="outputQuantity" type="number" step="0.0001" min="0" required className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Output UOM
          <select name="outputUomId" required className="input">
            <option value="">—</option>
            {uoms.map((u) => (
              <option key={u.id} value={u.id}>{u.code}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        Notes
        <textarea name="notes" rows={2} className="input" />
      </label>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Raw materials</p>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                <th className="py-2 pr-2">Raw material</th>
                <th className="py-2 pr-2">Qty (per output above)</th>
                <th className="py-2 pr-2">UOM</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-2">
                    <select
                      name={`lines[${i}][rawMaterialProductId]`}
                      value={row.rawMaterialProductId}
                      onChange={(e) => onRawMaterialChange(i, e.target.value)}
                      className="input min-w-48"
                    >
                      <option value="">—</option>
                      {rawMaterialProducts.map((p) => (
                        <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      name={`lines[${i}][quantity]`}
                      type="number"
                      step="0.0001"
                      min="0"
                      value={row.quantity}
                      onChange={(e) => update(i, { quantity: e.target.value })}
                      className="input w-24"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <select
                      name={`lines[${i}][uomId]`}
                      value={row.uomId}
                      onChange={(e) => update(i, { uomId: e.target.value })}
                      className="input w-24"
                    >
                      <option value="">—</option>
                      {uoms.map((u) => (
                        <option key={u.id} value={u.id}>{u.code}</option>
                      ))}
                    </select>
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
          + Add raw material
        </button>
      </div>
    </ActionForm>
  );
}
