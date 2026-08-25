"use client";

import { useMemo, useState } from "react";
import { ActionForm, type SimpleActionResult } from "@/components/ActionForm";
import { LineItemsEditor } from "@/components/LineItemsEditor";

type Customer = { id: string; name: string; price_list_id: string | null };
type Option = { id: string; name: string };
type Product = { id: string; sku: string; name: string; base_uom_id: string | null };
type Uom = { id: string; code: string };
type PriceListItem = { price_list_id: string; product_id: string; price: number };

export function NewSalesOrderForm({
  action,
  customers,
  branches,
  warehouses,
  products,
  uoms,
  priceLists,
  priceListItems,
}: {
  action: (formData: FormData) => Promise<SimpleActionResult>;
  customers: Customer[];
  branches: Option[];
  warehouses: Option[];
  products: Product[];
  uoms: Uom[];
  priceLists: Option[];
  priceListItems: PriceListItem[];
}) {
  const [customerId, setCustomerId] = useState("");
  const [priceListId, setPriceListId] = useState("");

  const priceByProduct = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of priceListItems) {
      if (item.price_list_id === priceListId) map[item.product_id] = item.price;
    }
    return map;
  }, [priceListItems, priceListId]);

  function onCustomerChange(id: string) {
    setCustomerId(id);
    const customer = customers.find((c) => c.id === id);
    if (customer?.price_list_id) setPriceListId(customer.price_list_id);
  }

  return (
    <ActionForm action={action} submitLabel="Create sales order" className="flex flex-col gap-4 max-w-3xl">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">SO number</label>
          <input name="soNumber" required className="input" placeholder="SO-0001" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Customer</label>
          <select
            name="customerId"
            required
            value={customerId}
            onChange={(e) => onCustomerChange(e.target.value)}
            className="input"
          >
            <option value="">—</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Branch</label>
          <select name="branchId" required className="input">
            <option value="">—</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Fulfilling warehouse
          </label>
          <select name="warehouseId" required className="input">
            <option value="">—</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Price list</label>
          <select
            name="priceListId"
            value={priceListId}
            onChange={(e) => setPriceListId(e.target.value)}
            className="input"
          >
            <option value="">—</option>
            {priceLists.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Line items</h2>
      <LineItemsEditor products={products} uoms={uoms} priceByProduct={priceByProduct} />
    </ActionForm>
  );
}
