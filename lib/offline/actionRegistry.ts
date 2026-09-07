import type { SimpleActionResult } from "@/components/ActionForm";
import { createSalesOrderAction } from "@/actions/sales";

// A queued outbox item stores an actionKey (a stable string), not the
// Server Action function itself -- functions aren't serializable, and a
// page reload while offline would lose any closure-captured reference
// anyway. Replaying a queued item looks the real action back up here by
// key, so the exact same Server Action (with its own requirePermission
// check and RLS-scoped writes) runs whether the call happens live or is
// replayed later -- offline queueing never bypasses or duplicates any of
// that logic.
export const offlineActionRegistry: Record<
  string,
  (formData: FormData) => Promise<SimpleActionResult>
> = {
  createSalesOrder: createSalesOrderAction,
};

export type OfflineActionKey = keyof typeof offlineActionRegistry;
