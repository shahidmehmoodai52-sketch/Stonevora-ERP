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
  confirmDeliveryPodAction: vi.fn(async () => ({ success: true }) as const),
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
vi.mock("@/actions/stocktakes", () => ({
  createStocktakeAction: vi.fn(async () => ({ success: true }) as const),
}));
vi.mock("@/actions/factory", () => ({
  createProcessingJobAction: vi.fn(async () => ({ success: true }) as const),
  completeProcessingJobAction: vi.fn(async () => ({ success: true }) as const),
  recordProcessingCostsAction: vi.fn(async () => ({ success: true }) as const),
  recordQcInspectionAction: vi.fn(async () => ({ success: true }) as const),
}));
vi.mock("@/actions/projects", () => ({
  createProjectAction: vi.fn(async () => ({ success: true }) as const),
  addProjectMaterialAction: vi.fn(async () => ({ success: true }) as const),
  completeProjectAction: vi.fn(async () => ({ success: true }) as const),
  generateProjectInvoiceAction: vi.fn(async () => ({ success: true }) as const),
}));
vi.mock("@/actions/manufacturing", () => ({
  createBomAction: vi.fn(async () => ({ success: true }) as const),
  createProductionBatchAction: vi.fn(async () => ({ success: true }) as const),
  completeProductionBatchAction: vi.fn(async () => ({ success: true }) as const),
  recordBatchQcInspectionAction: vi.fn(async () => ({ success: true }) as const),
}));
vi.mock("@/actions/reservations", () => ({
  createReservationAction: vi.fn(async () => ({ success: true }) as const),
  activateStockReservationAction: vi.fn(async () => ({ success: true }) as const),
  convertReservationToSalesOrderAction: vi.fn(async () => ({ success: true }) as const),
}));
vi.mock("@/actions/accounting", () => ({
  createChartOfAccountAction: vi.fn(async () => ({ success: true }) as const),
  postJournalEntryAction: vi.fn(async () => ({ success: true }) as const),
}));

const { createDeliveryAction, generateInvoiceAction, confirmDeliveryPodAction, createSalesReturnAction } =
  await import("@/actions/sales");
const { createGoodsReceiptAction, createPurchaseReturnAction } = await import("@/actions/purchasing");
const { recordCustomerPaymentAction, recordSupplierPaymentAction } = await import("@/actions/payments");
const { createStockAdjustmentAction } = await import("@/actions/inventory");
const { createStocktakeAction } = await import("@/actions/stocktakes");
const {
  createProcessingJobAction,
  completeProcessingJobAction,
  recordProcessingCostsAction,
  recordQcInspectionAction,
} = await import("@/actions/factory");
const {
  createProjectAction,
  addProjectMaterialAction,
  completeProjectAction,
  generateProjectInvoiceAction,
} = await import("@/actions/projects");
const {
  createBomAction,
  createProductionBatchAction,
  completeProductionBatchAction,
  recordBatchQcInspectionAction,
} = await import("@/actions/manufacturing");
const {
  createReservationAction,
  activateStockReservationAction,
  convertReservationToSalesOrderAction,
} = await import("@/actions/reservations");
const { createChartOfAccountAction, postJournalEntryAction } = await import("@/actions/accounting");
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

  test("confirmDeliveryPod reads __deliveryId and __salesOrderId and calls the real action with (deliveryId, salesOrderId, formData)", async () => {
    const formData = formDataWith({ __deliveryId: "del-789", __salesOrderId: "so-456", podReceivedBy: "Ali" });
    await offlineActionRegistry.confirmDeliveryPod(formData);
    expect(confirmDeliveryPodAction).toHaveBeenCalledWith("del-789", "so-456", formData);
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

  test("createProcessingJob passes formData straight through, no bound id to extract", async () => {
    const formData = formDataWith({ jobNumber: "JOB-1" });
    await offlineActionRegistry.createProcessingJob(formData);
    expect(createProcessingJobAction).toHaveBeenCalledWith(formData);
  });

  test("completeProcessingJob reads __processingJobId and calls the real action with (processingJobId, formData)", async () => {
    const formData = formDataWith({ __processingJobId: "job-555" });
    await offlineActionRegistry.completeProcessingJob(formData);
    expect(completeProcessingJobAction).toHaveBeenCalledWith("job-555", formData);
  });

  test("recordProcessingCosts reads __processingJobId and calls the real action with (processingJobId, formData)", async () => {
    const formData = formDataWith({ __processingJobId: "job-555", processingCost: "100" });
    await offlineActionRegistry.recordProcessingCosts(formData);
    expect(recordProcessingCostsAction).toHaveBeenCalledWith("job-555", formData);
  });

  test("recordQcInspection reads __inventoryUnitId and calls the real action with (inventoryUnitId, formData)", async () => {
    const formData = formDataWith({ __inventoryUnitId: "unit-666", outcome: "passed" });
    await offlineActionRegistry.recordQcInspection(formData);
    expect(recordQcInspectionAction).toHaveBeenCalledWith("unit-666", formData);
  });

  test("createProject passes formData straight through, no bound id to extract", async () => {
    const formData = formDataWith({ projectNumber: "PRJ-1" });
    await offlineActionRegistry.createProject(formData);
    expect(createProjectAction).toHaveBeenCalledWith(formData);
  });

  test("addProjectMaterial reads __projectId and calls the real action with (projectId, formData)", async () => {
    const formData = formDataWith({ __projectId: "prj-777", inventoryUnitId: "unit-1" });
    await offlineActionRegistry.addProjectMaterial(formData);
    expect(addProjectMaterialAction).toHaveBeenCalledWith("prj-777", formData);
  });

  test("completeProject reads __projectId and calls the real action with (projectId, formData)", async () => {
    const formData = formDataWith({ __projectId: "prj-777", laborCost: "100" });
    await offlineActionRegistry.completeProject(formData);
    expect(completeProjectAction).toHaveBeenCalledWith("prj-777", formData);
  });

  test("generateProjectInvoice reads __projectId and calls the real action with (projectId, formData)", async () => {
    const formData = formDataWith({ __projectId: "prj-777", invoiceNumber: "INV-9" });
    await offlineActionRegistry.generateProjectInvoice(formData);
    expect(generateProjectInvoiceAction).toHaveBeenCalledWith("prj-777", formData);
  });

  test("createBom passes formData straight through, no bound id to extract", async () => {
    const formData = formDataWith({ bomNumber: "BOM-1" });
    await offlineActionRegistry.createBom(formData);
    expect(createBomAction).toHaveBeenCalledWith(formData);
  });

  test("createProductionBatch passes formData straight through, no bound id to extract", async () => {
    const formData = formDataWith({ batchNumber: "PB-1" });
    await offlineActionRegistry.createProductionBatch(formData);
    expect(createProductionBatchAction).toHaveBeenCalledWith(formData);
  });

  test("completeProductionBatch reads __productionBatchId and calls the real action with (productionBatchId, formData)", async () => {
    const formData = formDataWith({ __productionBatchId: "pb-888", actualOutputQuantity: "100" });
    await offlineActionRegistry.completeProductionBatch(formData);
    expect(completeProductionBatchAction).toHaveBeenCalledWith("pb-888", formData);
  });

  test("recordBatchQcInspection reads __inventoryBatchId and calls the real action with (inventoryBatchId, formData)", async () => {
    const formData = formDataWith({ __inventoryBatchId: "ib-999", outcome: "passed" });
    await offlineActionRegistry.recordBatchQcInspection(formData);
    expect(recordBatchQcInspectionAction).toHaveBeenCalledWith("ib-999", formData);
  });

  test("createReservation passes formData straight through, no bound id to extract", async () => {
    const formData = formDataWith({ reservationNumber: "RES-1" });
    await offlineActionRegistry.createReservation(formData);
    expect(createReservationAction).toHaveBeenCalledWith(formData);
  });

  test("activateStockReservation reads __stockReservationId and calls the real action with (stockReservationId, formData)", async () => {
    const formData = formDataWith({ __stockReservationId: "res-111", holdHours: "24" });
    await offlineActionRegistry.activateStockReservation(formData);
    expect(activateStockReservationAction).toHaveBeenCalledWith("res-111", formData);
  });

  test("convertReservationToSalesOrder reads __stockReservationId and calls the real action with (stockReservationId, formData)", async () => {
    const formData = formDataWith({ __stockReservationId: "res-111", soNumber: "SO-9" });
    await offlineActionRegistry.convertReservationToSalesOrder(formData);
    expect(convertReservationToSalesOrderAction).toHaveBeenCalledWith("res-111", formData);
  });

  test("createChartOfAccount passes formData straight through, no bound id to extract", async () => {
    const formData = formDataWith({ code: "1050", name: "Petty Cash" });
    await offlineActionRegistry.createChartOfAccount(formData);
    expect(createChartOfAccountAction).toHaveBeenCalledWith(formData);
  });

  test("postJournalEntry passes formData straight through, no bound id to extract", async () => {
    const formData = formDataWith({ branchId: "branch-1" });
    await offlineActionRegistry.postJournalEntry(formData);
    expect(postJournalEntryAction).toHaveBeenCalledWith(formData);
  });

  test("createStocktake passes formData straight through, no bound id to extract", async () => {
    const formData = formDataWith({ stocktakeNumber: "STK-1" });
    await offlineActionRegistry.createStocktake(formData);
    expect(createStocktakeAction).toHaveBeenCalledWith(formData);
  });
});
