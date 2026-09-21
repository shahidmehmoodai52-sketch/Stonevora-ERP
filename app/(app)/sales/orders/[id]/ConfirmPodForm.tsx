"use client";

import { ActionForm, type SimpleActionResult } from "@/components/ActionForm";

export function ConfirmPodForm({
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
      submitLabel="Confirm delivery"
      className="flex flex-wrap items-end gap-2"
      offlineActionKey="confirmDeliveryPod"
    >
      <input type="hidden" name="__deliveryId" value={deliveryId} />
      <input type="hidden" name="__salesOrderId" value={salesOrderId} />
      <div className="flex flex-col gap-1">
        <input name="podReceivedBy" className="input w-32" placeholder="Received by" />
      </div>
      <div className="flex flex-col gap-1">
        <input name="podNotes" className="input w-40" placeholder="POD notes" />
      </div>
    </ActionForm>
  );
}
