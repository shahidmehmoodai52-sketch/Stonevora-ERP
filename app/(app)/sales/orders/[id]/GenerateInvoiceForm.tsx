"use client";

import { ActionForm, type SimpleActionResult } from "@/components/ActionForm";

export function GenerateInvoiceForm({
  deliveryId,
  salesOrderId,
  action,
}: {
  deliveryId: string;
  salesOrderId: string;
  action: (deliveryId: string, salesOrderId: string, formData: FormData) => Promise<SimpleActionResult>;
}) {
  return (
    <ActionForm
      action={action.bind(null, deliveryId, salesOrderId)}
      submitLabel="Generate invoice"
      className="flex items-end gap-2"
    >
      <div className="flex flex-col gap-1">
        <input name="invoiceNumber" required className="input w-32" placeholder="INV-0001" />
      </div>
    </ActionForm>
  );
}
