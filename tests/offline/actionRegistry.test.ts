import { describe, test, expect, vi } from "vitest";

// Unlike sync.test.ts (which replaces the whole registry to test the sync
// engine in isolation), this file tests the registry's own wrapper
// functions -- the ones that pull an id like purchaseOrderId back out of a
// hidden form field instead of a .bind()'d closure (see actionRegistry.ts's
// own header comment for why). The underlying Server Actions are mocked
// (they import next/headers-dependent Supabase clients, unusable outside a
// request context) so only the registry's own extraction logic is under
// test -- the real actions themselves are covered by this project's live
// Supabase verification, not here.
vi.mock("@/actions/sales", () => ({
  createSalesOrderAction: vi.fn(async () => ({ success: true }) as const),
  createDeliveryAction: vi.fn(async () => ({ success: true }) as const),
  generateInvoiceAction: vi.fn(async () => ({ success: true }) as const),
}));
vi.mock("@/actions/purchasing", () => ({
  createPurchaseOrderAction: vi.fn(async () => ({ success: true }) as const),
  createGoodsReceiptAction: vi.fn(async () => ({ success: true }) as const),
}));

const { createDeliveryAction, generateInvoiceAction } = await import("@/actions/sales");
const { createGoodsReceiptAction } = await import("@/actions/purchasing");
const { offlineActionRegistry } = await import("@/lib/offline/actionRegistry");

function formDataWith(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

describe("offline action registry: extracting a bound id from a hidden field", () => {
  test("createGoodsReceipt reads __purchaseOrderId and calls the real action with (purchaseOrderId, formData)", async () => {
    const formData = formDataWith({ __purchaseOrderId: "po-123", grnNumber: "GRN-1" });
    await offlineActionRegistry.createGoodsReceipt(formData);
    expect(createGoodsReceiptAction).toHaveBeenCalledWith("po-123", formData);
  });

  test("createDelivery reads __salesOrderId and calls the real action with (salesOrderId, formData)", async () => {
    const formData = formDataWith({ __salesOrderId: "so-456", deliveryNumber: "DEL-1" });
    await offlineActionRegistry.createDelivery(formData);
    expect(createDeliveryAction).toHaveBeenCalledWith("so-456", formData);
  });

  test("generateInvoice reads __deliveryId and __salesOrderId and calls the real action with (deliveryId, salesOrderId, formData)", async () => {
    const formData = formDataWith({ __deliveryId: "del-789", __salesOrderId: "so-456", invoiceNumber: "INV-1" });
    await offlineActionRegistry.generateInvoice(formData);
    expect(generateInvoiceAction).toHaveBeenCalledWith("del-789", "so-456", formData);
  });

  test("createSalesOrder and createPurchaseOrder pass formData straight through, no bound id to extract", async () => {
    const formData = formDataWith({ soNumber: "SO-1" });
    await offlineActionRegistry.createSalesOrder(formData);
    const { createSalesOrderAction } = await import("@/actions/sales");
    expect(createSalesOrderAction).toHaveBeenCalledWith(formData);
  });
});
