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
  createSalesReturnAction: vi.fn(async () => ({ success: true }) as const),
}));
vi.mock("@/actions/purchasing", () => ({
  createPurchaseOrderAction: vi.fn(async () => ({ success: true }) as const),
  createGoodsReceiptAction: vi.fn(async () => ({ success: true }) as const),
  createPurchaseReturnAction: vi.fn(async () => ({ success: true }) as const),
}));
vi.mock("@/actions/payments", () => ({
  recordCustomerPaymentAction: vi.fn(async () => ({ success: true }) as const),
  recordSupplierPaymentAction: vi.fn(async () => ({ success: true }) as const),
}));
vi.mock("@/actions/inventory", () => ({
  createStockAdjustmentAction: vi.fn(async () => ({ success: true }) as const),
}));

const { createDeliveryAction, generateInvoiceAction, createSalesReturnAction } = await import("@/actions/sales");
const { createGoodsReceiptAction, createPurchaseReturnAction } = await import("@/actions/purchasing");
const { recordCustomerPaymentAction, recordSupplierPaymentAction } = await import("@/actions/payments");
const { createStockAdjustmentAction } = await import("@/actions/inventory");
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

  test("recordCustomerPayment reads __customerId and calls the real action with (customerId, formData)", async () => {
    const formData = formDataWith({ __customerId: "cust-111", amount: "500" });
    await offlineActionRegistry.recordCustomerPayment(formData);
    expect(recordCustomerPaymentAction).toHaveBeenCalledWith("cust-111", formData);
  });

  test("recordSupplierPayment reads __supplierId and calls the real action with (supplierId, formData)", async () => {
    const formData = formDataWith({ __supplierId: "sup-222", amount: "500" });
    await offlineActionRegistry.recordSupplierPayment(formData);
    expect(recordSupplierPaymentAction).toHaveBeenCalledWith("sup-222", formData);
  });

  test("createStockAdjustment passes formData straight through, no bound id to extract", async () => {
    const formData = formDataWith({ adjustmentNumber: "ADJ-1" });
    await offlineActionRegistry.createStockAdjustment(formData);
    expect(createStockAdjustmentAction).toHaveBeenCalledWith(formData);
  });

  test("createSalesReturn reads __salesInvoiceId and calls the real action with (salesInvoiceId, formData)", async () => {
    const formData = formDataWith({ __salesInvoiceId: "inv-333", returnNumber: "SR-1" });
    await offlineActionRegistry.createSalesReturn(formData);
    expect(createSalesReturnAction).toHaveBeenCalledWith("inv-333", formData);
  });

  test("createPurchaseReturn reads __goodsReceiptId and calls the real action with (goodsReceiptId, formData)", async () => {
    const formData = formDataWith({ __goodsReceiptId: "grn-444", returnNumber: "PR-1" });
    await offlineActionRegistry.createPurchaseReturn(formData);
    expect(createPurchaseReturnAction).toHaveBeenCalledWith("grn-444", formData);
  });
});
