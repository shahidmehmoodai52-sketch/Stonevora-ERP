"use client";

import { ActionForm } from "@/components/ActionForm";
import { convertReservationToSalesOrderAction } from "@/actions/reservations";

export function ConvertReservationForm({ stockReservationId }: { stockReservationId: string }) {
  return (
    <ActionForm
      action={(formData) => convertReservationToSalesOrderAction(stockReservationId, formData)}
      submitLabel="Convert to sales order"
      pendingLabel="Converting…"
      offlineActionKey="convertReservationToSalesOrder"
    >
      <input type="hidden" name="__stockReservationId" value={stockReservationId} />
      <label className="flex flex-col gap-1 text-sm">
        Sales order number
        <input name="soNumber" required className="input" />
      </label>
    </ActionForm>
  );
}
