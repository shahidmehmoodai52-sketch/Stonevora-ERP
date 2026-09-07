import type { SimpleActionResult } from "@/components/ActionForm";
import { createSalesOrderAction, createDeliveryAction, generateInvoiceAction } from "@/actions/sales";
import { createPurchaseOrderAction, createGoodsReceiptAction } from "@/actions/purchasing";

// A queued outbox item stores an actionKey (a stable string), not the
// Server Action function itself -- functions aren't serializable, and a
// page reload while offline would lose any closure-captured reference
// anyway. Replaying a queued item looks the real action back up here by
// key, so the exact same Server Action (with its own requirePermission
// check and RLS-scoped writes) runs whether the call happens live or is
// replayed later -- offline queueing never bypasses or duplicates any of
// that logic.
//
// A few of these actions take an extra id bound ahead of formData (e.g.
// createDeliveryAction(salesOrderId, formData)) -- the online path binds it
// via .bind(null, id) on a function reference, but that bound closure can't
// survive being serialized into the outbox and read back after a reload.
// Their forms instead carry that id as a hidden field (see
// NewDeliveryForm.tsx/ReceiveForm.tsx/GenerateInvoiceForm.tsx), and the
// wrapper below reads it back out of the FormData before calling the real
// action -- the id travels with the queued submission itself instead of a
// closure.
export const offlineActionRegistry: Record<
  string,
  (formData: FormData) => Promise<SimpleActionResult>
> = {
  createSalesOrder: createSalesOrderAction,
  createPurchaseOrder: createPurchaseOrderAction,
  createGoodsReceipt: (formData) =>
    createGoodsReceiptAction(String(formData.get("__purchaseOrderId") ?? ""), formData),
  createDelivery: (formData) => createDeliveryAction(String(formData.get("__salesOrderId") ?? ""), formData),
  generateInvoice: (formData) =>
    generateInvoiceAction(
      String(formData.get("__deliveryId") ?? ""),
      String(formData.get("__salesOrderId") ?? ""),
      formData
    ),
};

export type OfflineActionKey = keyof typeof offlineActionRegistry;
