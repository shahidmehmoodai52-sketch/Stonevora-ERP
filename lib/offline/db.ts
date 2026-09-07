import Dexie, { type EntityTable } from "dexie";

// A queued form submission, captured from an offline-capable ActionForm.
// Only plain string entries are supported (FormData.entries() values are
// coerced to string) -- every offline-capable form in this app is
// text/number/select inputs, never a file upload, so this is a complete,
// not a partial, serialization of what those forms actually submit.
export type OutboxItem = {
  id?: number;
  tenantId: string;
  actionKey: string;
  description: string;
  formEntries: [string, string][];
  status: "pending" | "syncing" | "synced" | "failed";
  error?: string;
  attempts: number;
  createdAt: number;
};

class OfflineDatabase extends Dexie {
  outbox!: EntityTable<OutboxItem, "id">;

  constructor() {
    super("stonevora-offline");
    this.version(1).stores({
      outbox: "++id, tenantId, status, createdAt",
    });
  }
}

// A single shared instance -- Dexie itself multiplexes concurrent access to
// the one IndexedDB database, so there's no reason for callers to construct
// their own.
export const offlineDb = new OfflineDatabase();
