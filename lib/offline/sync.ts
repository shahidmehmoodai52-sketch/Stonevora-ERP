import { offlineDb, type OutboxItem } from "./db";
import { offlineActionRegistry } from "./actionRegistry";

// A Server Action invoked from client code goes over fetch under the hood;
// offline (or a connection that drops mid-request) makes that fetch reject
// rather than resolve with the action's own {error}/{success} result --
// this is how ActionForm tells "the network is the problem" apart from
// "the action ran and rejected the input," which must never be queued for
// a later retry that can only fail identically.
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  return err instanceof TypeError; // fetch's own failure mode (browsers report "Failed to fetch"/"Load failed" etc. as TypeError)
}

export function formDataToEntries(formData: FormData): [string, string][] {
  const entries: [string, string][] = [];
  for (const [key, value] of formData.entries()) {
    // Offline-capable forms are text/number/select only (see db.ts) -- a File
    // would stringify to "[object File]", which is a silent corruption, not
    // a queueable submission, so it's rejected outright rather than queued.
    if (typeof value !== "string") {
      throw new Error(`Cannot queue a file field ("${key}") for offline sync`);
    }
    entries.push([key, value]);
  }
  return entries;
}

function entriesToFormData(entries: [string, string][]): FormData {
  const formData = new FormData();
  for (const [key, value] of entries) formData.append(key, value);
  return formData;
}

export async function enqueueOfflineAction(params: {
  tenantId: string;
  actionKey: string;
  description: string;
  formData: FormData;
}): Promise<void> {
  await offlineDb.outbox.add({
    tenantId: params.tenantId,
    actionKey: params.actionKey,
    description: params.description,
    formEntries: formDataToEntries(params.formData),
    status: "pending",
    attempts: 0,
    createdAt: Date.now(),
  });
}

export async function pendingOutboxCount(tenantId: string): Promise<number> {
  return offlineDb.outbox.where({ tenantId }).filter((item) => item.status !== "synced").count();
}

// Drains every pending/failed item for one tenant, oldest first, so queued
// documents land in the order the user actually created them (e.g. two
// dependent sales orders numbered sequentially). A failed item is left in
// the outbox with its error rather than dropped -- exactly the same
// never-silently-drop discipline this codebase applies to every rejected
// business transaction, just applied to the sync queue itself.
export async function drainOutbox(tenantId: string): Promise<void> {
  const items = await offlineDb.outbox
    .where({ tenantId })
    .filter((item) => item.status === "pending" || item.status === "failed")
    .sortBy("createdAt");

  for (const item of items) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return; // went back offline mid-drain
    await runOutboxItem(item);
  }

  await offlineDb.outbox.where({ tenantId, status: "synced" }).delete();
}

async function runOutboxItem(item: OutboxItem): Promise<void> {
  await offlineDb.outbox.update(item.id!, { status: "syncing" });

  const action = offlineActionRegistry[item.actionKey];
  if (!action) {
    await offlineDb.outbox.update(item.id!, {
      status: "failed",
      error: `Unknown offline action "${item.actionKey}"`,
      attempts: item.attempts + 1,
    });
    return;
  }

  try {
    const result = await action(entriesToFormData(item.formEntries));
    if ("error" in result) {
      // The server ran the request and rejected it on its own merits (e.g.
      // stock no longer available) -- retrying it unchanged would just fail
      // the same way, so it's surfaced to the user as a failed item, not
      // silently retried forever.
      await offlineDb.outbox.update(item.id!, {
        status: "failed",
        error: result.error,
        attempts: item.attempts + 1,
      });
    } else {
      await offlineDb.outbox.update(item.id!, { status: "synced" });
    }
  } catch (err) {
    await offlineDb.outbox.update(item.id!, {
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
      attempts: item.attempts + 1,
    });
  }
}
