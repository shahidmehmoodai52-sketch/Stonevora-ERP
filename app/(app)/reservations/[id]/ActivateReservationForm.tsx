"use client";

import { ActionForm } from "@/components/ActionForm";
import { activateStockReservationAction } from "@/actions/reservations";

export function ActivateReservationForm({ stockReservationId }: { stockReservationId: string }) {
  return (
    <ActionForm
      action={(formData) => activateStockReservationAction(stockReservationId, formData)}
      submitLabel="Activate hold"
      pendingLabel="Activating…"
      offlineActionKey="activateStockReservation"
    >
      <input type="hidden" name="__stockReservationId" value={stockReservationId} />
      <label className="flex flex-col gap-1 text-sm">
        Hold for (hours)
        <input name="holdHours" type="number" step="1" min="1" required className="input w-32" />
      </label>
    </ActionForm>
  );
}
