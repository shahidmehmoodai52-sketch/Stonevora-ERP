import "fake-indexeddb/auto";
import { describe, test, expect, vi, beforeEach } from "vitest";

// The registry normally resolves an actionKey to a real Server Action
// (createSalesOrderAction, which imports next/headers-dependent Supabase
// server clients) -- unusable outside a request context, so it's replaced
// here with a plain mutable object the tests populate directly. Because
// both this mock and lib/offline/sync.ts resolve the same underlying
// module, mutating this object is visible to drainOutbox without needing
// to re-mock per test.
vi.mock("@/lib/offline/actionRegistry", () => ({
  offlineActionRegistry: {} as Record<string, (formData: FormData) => Promise<{ error: string } | { success: true }>>,
}));

const { offlineActionRegistry } = await import("@/lib/offline/actionRegistry");
const { offlineDb } = await import("@/lib/offline/db");
const { enqueueOfflineAction, pendingOutboxCount, drainOutbox, formDataToEntries, isNetworkError } = await import(
  "@/lib/offline/sync"
);

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

beforeEach(async () => {
  await offlineDb.outbox.clear();
  for (const key of Object.keys(offlineActionRegistry)) delete offlineActionRegistry[key];
});

function formDataWith(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

describe("offline outbox", () => {
  test("enqueueOfflineAction stores a pending item scoped to its tenant", async () => {
    await enqueueOfflineAction({
      tenantId: TENANT_A,
      actionKey: "createSalesOrder",
      description: "Create sales order",
      formData: formDataWith({ soNumber: "SO-001" }),
    });

    const items = await offlineDb.outbox.toArray();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      tenantId: TENANT_A,
      actionKey: "createSalesOrder",
      status: "pending",
      attempts: 0,
    });
    expect(items[0].formEntries).toEqual([["soNumber", "SO-001"]]);

    expect(await pendingOutboxCount(TENANT_A)).toBe(1);
    expect(await pendingOutboxCount(TENANT_B)).toBe(0);
  });

  test("formDataToEntries rejects a File field rather than silently corrupting it", () => {
    const fd = new FormData();
    fd.append("attachment", new File(["x"], "x.txt"));
    expect(() => formDataToEntries(fd)).toThrow(/file field/i);
  });

  test("isNetworkError recognizes offline navigator state and fetch's TypeError, not arbitrary errors", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkError(new Error("SO number is required"))).toBe(false);
  });

  test("drainOutbox replays a queued item through the real action key, marks it synced, then prunes it", async () => {
    const calls: FormData[] = [];
    offlineActionRegistry.createSalesOrder = async (fd) => {
      calls.push(fd);
      return { success: true };
    };

    await enqueueOfflineAction({
      tenantId: TENANT_A,
      actionKey: "createSalesOrder",
      description: "Create sales order",
      formData: formDataWith({ soNumber: "SO-001" }),
    });

    await drainOutbox(TENANT_A);

    expect(calls).toHaveLength(1);
    expect(calls[0].get("soNumber")).toBe("SO-001");
    // A synced item is pruned by the same drain that synced it -- nothing
    // left over to re-sync or clutter the outbox view.
    expect(await offlineDb.outbox.count()).toBe(0);
  });

  test("drainOutbox marks a server-rejected item failed, with its real error, and does not delete it", async () => {
    offlineActionRegistry.createSalesOrder = async () => ({ error: "At least one line item is required" });

    await enqueueOfflineAction({
      tenantId: TENANT_A,
      actionKey: "createSalesOrder",
      description: "Create sales order",
      formData: formDataWith({ soNumber: "SO-002" }),
    });

    await drainOutbox(TENANT_A);

    const items = await offlineDb.outbox.toArray();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      status: "failed",
      error: "At least one line item is required",
      attempts: 1,
    });
  });

  test("drainOutbox marks an unknown action key failed instead of throwing", async () => {
    await enqueueOfflineAction({
      tenantId: TENANT_A,
      actionKey: "notARealAction",
      description: "Mystery action",
      formData: formDataWith({}),
    });

    await drainOutbox(TENANT_A);

    const items = await offlineDb.outbox.toArray();
    expect(items[0].status).toBe("failed");
    expect(items[0].error).toMatch(/unknown offline action/i);
  });

  test("drainOutbox only processes items for the requested tenant", async () => {
    offlineActionRegistry.createSalesOrder = async () => ({ success: true });

    await enqueueOfflineAction({
      tenantId: TENANT_A,
      actionKey: "createSalesOrder",
      description: "A's order",
      formData: formDataWith({ soNumber: "A-1" }),
    });
    await enqueueOfflineAction({
      tenantId: TENANT_B,
      actionKey: "createSalesOrder",
      description: "B's order",
      formData: formDataWith({ soNumber: "B-1" }),
    });

    await drainOutbox(TENANT_A);

    expect(await pendingOutboxCount(TENANT_A)).toBe(0);
    expect(await pendingOutboxCount(TENANT_B)).toBe(1);
  });

  test("drainOutbox replays queued items oldest-first", async () => {
    const order: string[] = [];
    offlineActionRegistry.createSalesOrder = async (fd) => {
      order.push(String(fd.get("soNumber")));
      return { success: true };
    };

    await enqueueOfflineAction({
      tenantId: TENANT_A,
      actionKey: "createSalesOrder",
      description: "first",
      formData: formDataWith({ soNumber: "SO-EARLY" }),
    });
    await new Promise((r) => setTimeout(r, 5));
    await enqueueOfflineAction({
      tenantId: TENANT_A,
      actionKey: "createSalesOrder",
      description: "second",
      formData: formDataWith({ soNumber: "SO-LATE" }),
    });

    await drainOutbox(TENANT_A);

    expect(order).toEqual(["SO-EARLY", "SO-LATE"]);
  });

  test("a previously failed item is retried (and its attempts incremented) on the next drain", async () => {
    let attempt = 0;
    offlineActionRegistry.createSalesOrder = async () => {
      attempt += 1;
      return attempt === 1 ? { error: "stock not yet available" } : { success: true };
    };

    await enqueueOfflineAction({
      tenantId: TENANT_A,
      actionKey: "createSalesOrder",
      description: "retry me",
      formData: formDataWith({ soNumber: "SO-003" }),
    });

    await drainOutbox(TENANT_A);
    let items = await offlineDb.outbox.toArray();
    expect(items[0]).toMatchObject({ status: "failed", attempts: 1 });

    await drainOutbox(TENANT_A);
    items = await offlineDb.outbox.toArray();
    expect(items).toHaveLength(0); // synced and pruned
    expect(attempt).toBe(2);
  });
});
