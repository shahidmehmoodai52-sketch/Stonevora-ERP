"use client";

import { ActionForm, type SimpleActionResult } from "@/components/ActionForm";

type Uom = { id: string; code: string; name: string };
type Category = { id: string; name: string };

export type ProductFormValues = {
  sku: string;
  name: string;
  inventoryTrackingMode: "simple" | "batch" | "unit";
  baseUomId: string;
  purchaseUomId: string;
  salesUomId: string;
  categoryId: string;
  costPrice: string;
  standardMarginPct: string;
};

const emptyValues: ProductFormValues = {
  sku: "",
  name: "",
  inventoryTrackingMode: "simple",
  baseUomId: "",
  purchaseUomId: "",
  salesUomId: "",
  categoryId: "",
  costPrice: "",
  standardMarginPct: "",
};

export function ProductForm({
  action,
  uoms,
  categories,
  initialValues,
  canEditFinancials,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<SimpleActionResult>;
  uoms: Uom[];
  categories: Category[];
  initialValues?: Partial<ProductFormValues>;
  canEditFinancials: boolean;
  submitLabel: string;
}) {
  const values = { ...emptyValues, ...initialValues };

  return (
    <ActionForm action={action} submitLabel={submitLabel} className="flex flex-col gap-4 max-w-lg">
      <Field label="SKU">
        <input name="sku" required defaultValue={values.sku} className="input" />
      </Field>
      <Field label="Name">
        <input name="name" required defaultValue={values.name} className="input" />
      </Field>
      <Field label="Category">
        <select name="categoryId" defaultValue={values.categoryId} className="input">
          <option value="">—</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Inventory tracking mode">
        <select
          name="inventoryTrackingMode"
          defaultValue={values.inventoryTrackingMode}
          className="input"
        >
          <option value="simple">Simple (running quantity)</option>
          <option value="batch">Batch / lot / shade</option>
          <option value="unit">Individual unit (block / slab)</option>
        </select>
      </Field>
      <Field label="Stock UOM">
        <select name="baseUomId" required defaultValue={values.baseUomId} className="input">
          <option value="">—</option>
          {uoms.map((u) => (
            <option key={u.id} value={u.id}>{u.code} — {u.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Purchase UOM">
        <select name="purchaseUomId" defaultValue={values.purchaseUomId} className="input">
          <option value="">—</option>
          {uoms.map((u) => (
            <option key={u.id} value={u.id}>{u.code} — {u.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Sales UOM">
        <select name="salesUomId" defaultValue={values.salesUomId} className="input">
          <option value="">—</option>
          {uoms.map((u) => (
            <option key={u.id} value={u.id}>{u.code} — {u.name}</option>
          ))}
        </select>
      </Field>
      {canEditFinancials && (
        <>
          <Field label="Cost price">
            <input
              name="costPrice"
              type="number"
              step="0.0001"
              defaultValue={values.costPrice}
              className="input"
            />
          </Field>
          <Field label="Standard margin %">
            <input
              name="standardMarginPct"
              type="number"
              step="0.001"
              defaultValue={values.standardMarginPct}
              className="input"
            />
          </Field>
        </>
      )}
    </ActionForm>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</label>
      {children}
    </div>
  );
}
