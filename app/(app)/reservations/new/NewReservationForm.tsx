"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { createReservationAction } from "@/actions/reservations";

type Product = { id: string; sku: string; name: string; base_uom_id: string | null };
type Uom = { id: string; code: string };
type NamedOption = { id: string; name: string };

type Row = { productId: string; quantity: string; uomId: string; unitPrice: string };
const emptyRow: Row = { productId: "", quantity: "", uomId: "", unitPrice: "" };

// Unit-tracked products (blocks/slabs) are already filtered out of the
// `products` prop by the parent page -- they are not reservable through
// this workflow, matching activate_stock_reservation's own rejection rule.
export function NewReservationForm({
  customers,
  branches,
  warehouses,
  products,
  uoms,
}: {
  customers: NamedOption[];
  branches: NamedOption[];
  warehouses: NamedOption[];
  products: Product[];
  uoms: Uom[];
}) {
  const [rows, setRows] = useState<Row[]>([{ ...emptyRow }]);

  function update(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function onProductChange(i: number, productId: string) {
    const product = products.find((p) => p.id === productId);
    update(i, { productId, uomId: product?.base_uom_id ?? "" });
  }

  return (
    <ActionForm action={createReservationAction} submitLabel="Create reservation" offlineActionKey="createReservation">
      <label className="flex flex-col gap-1 text-sm">
        Reservation number
        <input name="reservationNumber" required className="input" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Customer
        <select name="customerId" required className="input">
          <option value="">—</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Branch
        <select name="branchId" required className="input">
          <option value="">—</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Warehouse
        <select name="warehouseId" required className="input">
          <option value="">—</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Notes
        <textarea name="notes" rows={2} className="input" />
      </label>

      <div className="flex flex-col gap-3">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                <th className="py-2 pr-2">Product</th>
                <th className="py-2 pr-2">Qty</th>
                <th className="py-2 pr-2">UOM</th>
                <th className="py-2 pr-2">Indicative price</th>
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
                      className="input min-w-48"
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
                  <td className="py-2 pr-2">
                    <input
                      name={`lines[${i}][unitPrice]`}
                      type="number"
                      step="0.0001"
                      min="0"
                      value={row.unitPrice}
                      onChange={(e) => update(i, { unitPrice: e.target.value })}
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
    </ActionForm>
  );
}
