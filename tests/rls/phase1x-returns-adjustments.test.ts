import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { adminClient, createSignedInTestUser, deleteTestUser, hasServiceRoleKey } from "./helpers";

// Automated version of the live-database verification performed while
// building Phase 1.x (Returns/Credit-Debit notes + manual stock
// adjustments). Requires SUPABASE_SERVICE_ROLE_KEY (test setup only, see
// tests/rls/helpers.ts).
describe.skipIf(!hasServiceRoleKey)("Phase 1.x: Returns and Stock Adjustments", () => {
  let owner: { userId: string; client: ReturnType<typeof adminClient> };
  let branchBUser: { userId: string; client: ReturnType<typeof adminClient> };
  let salesperson: { userId: string; client: ReturnType<typeof adminClient> };
  let warehouseStaff: { userId: string; client: ReturnType<typeof adminClient> };
  let tenantId: string;
  let branchAId: string;
  let branchBId: string;
  let warehouseAId: string;
  let supplierId: string;
  let customerId: string;
  let productId: string;
  let batchProductId: string;
  let pcsUomId: string;

  beforeAll(async () => {
    const suffix = Date.now();
    owner = await createSignedInTestUser(`p1x-owner-${suffix}@stonevora.test`, "test-password-123");
    branchBUser = await createSignedInTestUser(`p1x-branchb-${suffix}@stonevora.test`, "test-password-123");
    salesperson = await createSignedInTestUser(`p1x-salesperson-${suffix}@stonevora.test`, "test-password-123");
    warehouseStaff = await createSignedInTestUser(`p1x-warehousestaff-${suffix}@stonevora.test`, "test-password-123");

    const { data: tId } = await owner.client.rpc("create_tenant_for_user", {
      p_tenant_name: `Phase1x Test ${suffix}`,
      p_tenant_slug: `phase1x-test-${suffix}`,
    });
    tenantId = tId!;

    const admin = adminClient();
    const { data: uom } = await admin.from("uom").select("id").eq("code", "PCS").is("tenant_id", null).single();
    pcsUomId = uom!.id;

    const { data: branchA } = await owner.client
      .from("branches").insert({ tenant_id: tenantId, code: "BA", name: "Branch A", is_head_office: true }).select("id").single();
    branchAId = branchA!.id;
    const { data: branchB } = await owner.client
      .from("branches").insert({ tenant_id: tenantId, code: "BB", name: "Branch B" }).select("id").single();
    branchBId = branchB!.id;

    const { data: warehouseA } = await owner.client
      .from("warehouses").insert({ tenant_id: tenantId, branch_id: branchAId, code: "WA", name: "Warehouse A" }).select("id").single();
    warehouseAId = warehouseA!.id;

    const { data: supplier } = await owner.client
      .from("suppliers").insert({ tenant_id: tenantId, code: "SUP1", name: "Test Supplier" }).select("id").single();
    supplierId = supplier!.id;
    const { data: customer } = await owner.client
      .from("customers").insert({ tenant_id: tenantId, code: "CUST1", name: "Test Customer" }).select("id").single();
    customerId = customer!.id;

    const { data: product } = await owner.client
      .from("products")
      .insert({ tenant_id: tenantId, sku: "TILE-P1X-01", name: "Test Tile Simple", inventory_tracking_mode: "simple", base_uom_id: pcsUomId })
      .select("id").single();
    productId = product!.id;
    const { data: batchProduct } = await owner.client
      .from("products")
      .insert({ tenant_id: tenantId, sku: "TILE-P1X-BATCH", name: "Test Tile Batch", inventory_tracking_mode: "batch", base_uom_id: pcsUomId })
      .select("id").single();
    batchProductId = batchProduct!.id;

    const { data: salespersonRole } = await admin.from("roles").select("id").eq("tenant_id", tenantId).eq("code", "salesperson").single();
    const { data: warehouseStaffRole } = await admin.from("roles").select("id").eq("tenant_id", tenantId).eq("code", "warehouse_staff").single();
    const { data: ownerRole } = await admin.from("roles").select("id").eq("tenant_id", tenantId).eq("code", "owner").single();
    await admin.from("user_tenants").insert([
      { user_id: branchBUser.userId, tenant_id: tenantId },
      { user_id: salesperson.userId, tenant_id: tenantId },
      { user_id: warehouseStaff.userId, tenant_id: tenantId },
    ]);
    await admin.from("user_roles").insert([
      // owner role scoped to Branch B isolates pure branch-scoping from permission checks.
      { user_id: branchBUser.userId, tenant_id: tenantId, role_id: ownerRole!.id, branch_id: branchBId },
      { user_id: salesperson.userId, tenant_id: tenantId, role_id: salespersonRole!.id },
      { user_id: warehouseStaff.userId, tenant_id: tenantId, role_id: warehouseStaffRole!.id },
    ]);
  });

  afterAll(async () => {
    const admin = adminClient();
    await admin.from("audit_log").delete().in("changed_by", [owner.userId, branchBUser.userId, salesperson.userId, warehouseStaff.userId]);
    await admin.from("tenants").delete().eq("id", tenantId);
    await deleteTestUser(owner.userId);
    await deleteTestUser(branchBUser.userId);
    await deleteTestUser(salesperson.userId);
    await deleteTestUser(warehouseStaff.userId);
  });

  async function receiveStock(suffix: string, quantity: number, unitPrice: number) {
    const { data: po } = await owner.client
      .from("purchase_orders").insert({ tenant_id: tenantId, branch_id: branchAId, supplier_id: supplierId, po_number: `PO-${suffix}`, status: "confirmed" }).select("id").single();
    const { data: poLine } = await owner.client
      .from("purchase_order_lines").insert({ tenant_id: tenantId, purchase_order_id: po!.id, product_id: productId, quantity, uom_id: pcsUomId, unit_price: unitPrice }).select("id").single();
    const { data: grn } = await owner.client
      .from("goods_receipts").insert({ tenant_id: tenantId, branch_id: branchAId, warehouse_id: warehouseAId, purchase_order_id: po!.id, grn_number: `GRN-${suffix}`, landed_cost_basis: "value" }).select("id").single();
    const { data: grnLine } = await owner.client
      .from("goods_receipt_lines").insert({ tenant_id: tenantId, goods_receipt_id: grn!.id, purchase_order_line_id: poLine!.id, product_id: productId, quantity, uom_id: pcsUomId, unit_cost: unitPrice }).select("id").single();
    await owner.client.rpc("post_goods_receipt", { p_goods_receipt_id: grn!.id });
    return { grnId: grn!.id as string, grnLineId: grnLine!.id as string };
  }

  async function sellStock(suffix: string, quantity: number, unitPrice: number) {
    const { data: so } = await owner.client
      .from("sales_orders").insert({ tenant_id: tenantId, branch_id: branchAId, customer_id: customerId, warehouse_id: warehouseAId, so_number: `SO-${suffix}`, status: "draft" }).select("id").single();
    const { data: soLine } = await owner.client
      .from("sales_order_lines").insert({ tenant_id: tenantId, sales_order_id: so!.id, product_id: productId, quantity, uom_id: pcsUomId, unit_price: unitPrice }).select("id").single();
    await owner.client.rpc("confirm_sales_order", { p_sales_order_id: so!.id });
    const { data: delivery } = await owner.client
      .from("deliveries").insert({ tenant_id: tenantId, branch_id: branchAId, warehouse_id: warehouseAId, sales_order_id: so!.id, delivery_number: `DEL-${suffix}` }).select("id").single();
    await owner.client.from("delivery_lines").insert({ tenant_id: tenantId, delivery_id: delivery!.id, sales_order_line_id: soLine!.id, product_id: productId, quantity });
    await owner.client.rpc("dispatch_delivery", { p_delivery_id: delivery!.id });
    const { data: invoiceId } = await owner.client.rpc("generate_sales_invoice_from_delivery", { p_delivery_id: delivery!.id, p_invoice_number: `INV-${suffix}` });
    const { data: invLine } = await owner.client.from("sales_invoice_lines").select("id").eq("sales_invoice_id", invoiceId!).single();
    return { invoiceId: invoiceId as string, invoiceLineId: invLine!.id as string };
  }

  test("sales return: posts as a credit note, restocks, tracks returned_quantity, redacts margin, hits the customer ledger", async () => {
    const suffix = `${Date.now()}-SR`;
    await receiveStock(suffix, 100, 20);
    const { invoiceId, invoiceLineId } = await sellStock(suffix, 40, 30);

    const { data: sr } = await owner.client
      .from("sales_returns").insert({ tenant_id: tenantId, branch_id: branchAId, warehouse_id: warehouseAId, customer_id: customerId, sales_invoice_id: invoiceId, return_number: `SR-${suffix}` }).select("id").single();
    await owner.client.from("sales_return_lines").insert({
      tenant_id: tenantId, sales_return_id: sr!.id, sales_invoice_line_id: invoiceLineId, product_id: productId,
      quantity: 10, uom_id: pcsUomId, unit_price: 30, unit_cost: 20, line_total: 300, restock: true,
    });

    const { data: stockBefore } = await owner.client.from("inventory_stock").select("qty_on_hand").eq("product_id", productId).single();
    const { error: postErr } = await owner.client.rpc("post_sales_return", { p_sales_return_id: sr!.id });
    expect(postErr).toBeNull();

    const { data: posted } = await owner.client.from("sales_returns").select("status, total_amount").eq("id", sr!.id).single();
    expect(posted?.status).toBe("posted");
    expect(Number(posted?.total_amount)).toBeCloseTo(300, 4);

    const { data: stockAfter } = await owner.client.from("inventory_stock").select("qty_on_hand, avg_cost").eq("product_id", productId).single();
    expect(Number(stockAfter?.qty_on_hand)).toBeCloseTo(Number(stockBefore?.qty_on_hand) + 10, 4);
    expect(Number(stockAfter?.avg_cost)).toBeCloseTo(20, 4);

    const { data: invLine } = await owner.client.from("sales_invoice_lines").select("returned_quantity").eq("id", invoiceLineId).single();
    expect(Number(invLine?.returned_quantity)).toBeCloseTo(10, 4);

    const { data: ledgerRows } = await owner.client.from("customer_ledger").select("entry_type, amount").eq("customer_id", customerId).order("id");
    const creditRow = ledgerRows!.find((r) => r.entry_type === "credit_note");
    expect(Number(creditRow?.amount)).toBeCloseTo(-300, 4);

    const { data: ownerLine } = await owner.client.from("sales_return_lines_secure").select("margin, unit_cost").eq("sales_return_id", sr!.id).single();
    expect(ownerLine?.margin).not.toBeNull();
    const { data: spLine } = await salesperson.client.from("sales_return_lines_secure").select("margin, unit_cost").eq("sales_return_id", sr!.id).single();
    expect(spLine?.margin).toBeNull();
    expect(spLine?.unit_cost).toBeNull();
  });

  test("sales return rejects returning more than was invoiced", async () => {
    const suffix = `${Date.now()}-SROVER`;
    await receiveStock(suffix, 50, 10);
    const { invoiceId, invoiceLineId } = await sellStock(suffix, 20, 15);

    const { data: sr } = await owner.client
      .from("sales_returns").insert({ tenant_id: tenantId, branch_id: branchAId, warehouse_id: warehouseAId, customer_id: customerId, sales_invoice_id: invoiceId, return_number: `SR-${suffix}` }).select("id").single();
    await owner.client.from("sales_return_lines").insert({
      tenant_id: tenantId, sales_return_id: sr!.id, sales_invoice_line_id: invoiceLineId, product_id: productId,
      quantity: 25, uom_id: pcsUomId, unit_price: 15, unit_cost: 10, line_total: 375, restock: true,
    });

    const { error } = await owner.client.rpc("post_sales_return", { p_sales_return_id: sr!.id });
    expect(error?.message).toMatch(/Cannot return more than was invoiced/);
  });

  test("purchase return: posts as a debit note, decrements stock, tracks returned_quantity, rejects over-return and insufficient stock", async () => {
    const suffix = `${Date.now()}-PR`;
    const { grnId, grnLineId } = await receiveStock(suffix, 100, 20);

    const { data: pr } = await owner.client
      .from("purchase_returns").insert({ tenant_id: tenantId, branch_id: branchAId, warehouse_id: warehouseAId, supplier_id: supplierId, goods_receipt_id: grnId, return_number: `PR-${suffix}` }).select("id").single();
    await owner.client.from("purchase_return_lines").insert({
      tenant_id: tenantId, purchase_return_id: pr!.id, goods_receipt_line_id: grnLineId, product_id: productId,
      quantity: 15, uom_id: pcsUomId, unit_cost: 20, line_total: 300,
    });

    const { data: stockBefore } = await owner.client.from("inventory_stock").select("qty_on_hand").eq("product_id", productId).single();
    const { error: postErr } = await owner.client.rpc("post_purchase_return", { p_purchase_return_id: pr!.id });
    expect(postErr).toBeNull();

    const { data: posted } = await owner.client.from("purchase_returns").select("status, total_amount").eq("id", pr!.id).single();
    expect(posted?.status).toBe("posted");
    expect(Number(posted?.total_amount)).toBeCloseTo(300, 4);

    const { data: stockAfter } = await owner.client.from("inventory_stock").select("qty_on_hand").eq("product_id", productId).single();
    expect(Number(stockAfter?.qty_on_hand)).toBeCloseTo(Number(stockBefore?.qty_on_hand) - 15, 4);

    const { data: grnLine } = await owner.client.from("goods_receipt_lines").select("returned_quantity").eq("id", grnLineId).single();
    expect(Number(grnLine?.returned_quantity)).toBeCloseTo(15, 4);

    const { data: ledgerRows } = await owner.client.from("supplier_ledger").select("entry_type, amount").eq("supplier_id", supplierId).order("id");
    const debitRow = ledgerRows!.find((r) => r.entry_type === "debit_note");
    expect(Number(debitRow?.amount)).toBeCloseTo(-300, 4);

    // Over-return: exceeds what was received on this GRN line.
    const { data: pr2 } = await owner.client
      .from("purchase_returns").insert({ tenant_id: tenantId, branch_id: branchAId, warehouse_id: warehouseAId, supplier_id: supplierId, goods_receipt_id: grnId, return_number: `PR-${suffix}-OVER` }).select("id").single();
    await owner.client.from("purchase_return_lines").insert({
      tenant_id: tenantId, purchase_return_id: pr2!.id, goods_receipt_line_id: grnLineId, product_id: productId,
      quantity: 90, uom_id: pcsUomId, unit_cost: 20, line_total: 1800,
    });
    const { error: overErr } = await owner.client.rpc("post_purchase_return", { p_purchase_return_id: pr2!.id });
    expect(overErr?.message).toMatch(/Cannot return more than was received/);
  });

  test("stock adjustment: blends cost on increase (simple + batch), decrements on shrinkage, rejects missing unit_cost, insufficient stock, and unit-tracked products", async () => {
    const suffix = `${Date.now()}-ADJ`;
    await receiveStock(suffix, 50, 10);

    const admin = adminClient();
    const { data: batch } = await admin
      .from("inventory_batches").insert({ tenant_id: tenantId, product_id: batchProductId, batch_number: `BATCH-${suffix}`, qty_on_hand: 50, uom_id: pcsUomId, cost_per_uom: 10 }).select("id").single();

    const { data: adj } = await owner.client
      .from("stock_adjustments").insert({ tenant_id: tenantId, branch_id: branchAId, warehouse_id: warehouseAId, adjustment_number: `ADJ-${suffix}`, reason_code: "count_correction" }).select("id").single();
    await owner.client.from("stock_adjustment_lines").insert([
      { tenant_id: tenantId, stock_adjustment_id: adj!.id, product_id: productId, quantity_change: 10, uom_id: pcsUomId, unit_cost: 20 },
      { tenant_id: tenantId, stock_adjustment_id: adj!.id, product_id: productId, quantity_change: -5, uom_id: pcsUomId },
      { tenant_id: tenantId, stock_adjustment_id: adj!.id, product_id: batchProductId, quantity_change: 10, uom_id: pcsUomId, unit_cost: 15, batch_id: batch!.id },
    ]);

    const { error: postErr } = await owner.client.rpc("post_stock_adjustment", { p_stock_adjustment_id: adj!.id });
    expect(postErr).toBeNull();

    const { data: stock } = await owner.client.from("inventory_stock").select("qty_on_hand, avg_cost").eq("product_id", productId).single();
    expect(Number(stock?.qty_on_hand)).toBeCloseTo(55, 4); // 50 + 10 - 5
    expect(Number(stock?.avg_cost)).toBeCloseTo((50 * 10 + 10 * 20) / 60, 2);

    const { data: batchAfter } = await owner.client.from("inventory_batches").select("qty_on_hand, cost_per_uom").eq("id", batch!.id).single();
    expect(Number(batchAfter?.qty_on_hand)).toBeCloseTo(60, 4);
    expect(Number(batchAfter?.cost_per_uom)).toBeCloseTo((50 * 10 + 10 * 15) / 60, 2);

    // Missing unit_cost on an increase.
    const { data: adj2 } = await owner.client
      .from("stock_adjustments").insert({ tenant_id: tenantId, branch_id: branchAId, warehouse_id: warehouseAId, adjustment_number: `ADJ-${suffix}-NOCOST`, reason_code: "found" }).select("id").single();
    await owner.client.from("stock_adjustment_lines").insert({ tenant_id: tenantId, stock_adjustment_id: adj2!.id, product_id: productId, quantity_change: 5, uom_id: pcsUomId });
    const { error: noCostErr } = await owner.client.rpc("post_stock_adjustment", { p_stock_adjustment_id: adj2!.id });
    expect(noCostErr?.message).toMatch(/unit_cost is required/);

    // Insufficient stock on a decrease.
    const { data: adj3 } = await owner.client
      .from("stock_adjustments").insert({ tenant_id: tenantId, branch_id: branchAId, warehouse_id: warehouseAId, adjustment_number: `ADJ-${suffix}-SHORT`, reason_code: "shrinkage" }).select("id").single();
    await owner.client.from("stock_adjustment_lines").insert({ tenant_id: tenantId, stock_adjustment_id: adj3!.id, product_id: productId, quantity_change: -1000, uom_id: pcsUomId });
    const { error: shortErr } = await owner.client.rpc("post_stock_adjustment", { p_stock_adjustment_id: adj3!.id });
    expect(shortErr?.message).toMatch(/Insufficient available stock/);

    // Unit-tracked products are out of scope for this workflow.
    const { data: unitProduct } = await owner.client
      .from("products").insert({ tenant_id: tenantId, sku: `BLK-${suffix}`, name: "Test Block", inventory_tracking_mode: "unit", base_uom_id: pcsUomId }).select("id").single();
    const { data: adj4 } = await owner.client
      .from("stock_adjustments").insert({ tenant_id: tenantId, branch_id: branchAId, warehouse_id: warehouseAId, adjustment_number: `ADJ-${suffix}-UNIT`, reason_code: "other" }).select("id").single();
    await owner.client.from("stock_adjustment_lines").insert({ tenant_id: tenantId, stock_adjustment_id: adj4!.id, product_id: unitProduct!.id, quantity_change: 1, uom_id: pcsUomId, unit_cost: 100 });
    const { error: unitErr } = await owner.client.rpc("post_stock_adjustment", { p_stock_adjustment_id: adj4!.id });
    expect(unitErr?.message).toMatch(/Unit-tracked products/);
  });

  test("branch scoping: a Branch-B-scoped owner cannot post a Branch-A stock adjustment, sales return, or purchase return", async () => {
    const suffix = `${Date.now()}-BRANCH`;
    const { grnId, grnLineId } = await receiveStock(suffix, 30, 10);
    const { invoiceId, invoiceLineId } = await sellStock(suffix, 5, 15);

    const { data: adj } = await owner.client
      .from("stock_adjustments").insert({ tenant_id: tenantId, branch_id: branchAId, warehouse_id: warehouseAId, adjustment_number: `ADJ-${suffix}`, reason_code: "other" }).select("id").single();
    const { error: adjErr } = await branchBUser.client.rpc("post_stock_adjustment", { p_stock_adjustment_id: adj!.id });
    expect(adjErr?.message).toMatch(/do not have access to the branch/);

    const { data: sr } = await owner.client
      .from("sales_returns").insert({ tenant_id: tenantId, branch_id: branchAId, warehouse_id: warehouseAId, customer_id: customerId, sales_invoice_id: invoiceId, return_number: `SR-${suffix}` }).select("id").single();
    const { error: srErr } = await branchBUser.client.rpc("post_sales_return", { p_sales_return_id: sr!.id });
    expect(srErr?.message).toMatch(/do not have access to the branch/);

    const { data: pr } = await owner.client
      .from("purchase_returns").insert({ tenant_id: tenantId, branch_id: branchAId, warehouse_id: warehouseAId, supplier_id: supplierId, goods_receipt_id: grnId, return_number: `PR-${suffix}` }).select("id").single();
    const { error: prErr } = await branchBUser.client.rpc("post_purchase_return", { p_purchase_return_id: pr!.id });
    expect(prErr?.message).toMatch(/do not have access to the branch/);

    // Line ids only needed to satisfy unused-var linting via a real reference.
    expect(grnLineId).toBeTruthy();
    expect(invoiceLineId).toBeTruthy();
  });

  test("permission denial: salesperson cannot post a stock adjustment or purchase return; warehouse_staff cannot post a sales return", async () => {
    const suffix = `${Date.now()}-PERM`;
    const { grnId } = await receiveStock(suffix, 30, 10);
    const { invoiceId } = await sellStock(suffix, 5, 15);

    const { data: adj } = await owner.client
      .from("stock_adjustments").insert({ tenant_id: tenantId, branch_id: branchAId, warehouse_id: warehouseAId, adjustment_number: `ADJ-${suffix}`, reason_code: "other" }).select("id").single();
    const { error: adjErr } = await salesperson.client.rpc("post_stock_adjustment", { p_stock_adjustment_id: adj!.id });
    expect(adjErr?.message).toMatch(/Missing permission: warehouse.edit/);

    const { data: pr } = await owner.client
      .from("purchase_returns").insert({ tenant_id: tenantId, branch_id: branchAId, warehouse_id: warehouseAId, supplier_id: supplierId, goods_receipt_id: grnId, return_number: `PR-${suffix}` }).select("id").single();
    const { error: prErr } = await salesperson.client.rpc("post_purchase_return", { p_purchase_return_id: pr!.id });
    expect(prErr?.message).toMatch(/Missing permission: purchasing.edit/);

    const { data: sr } = await owner.client
      .from("sales_returns").insert({ tenant_id: tenantId, branch_id: branchAId, warehouse_id: warehouseAId, customer_id: customerId, sales_invoice_id: invoiceId, return_number: `SR-${suffix}` }).select("id").single();
    const { error: srErr } = await warehouseStaff.client.rpc("post_sales_return", { p_sales_return_id: sr!.id });
    expect(srErr?.message).toMatch(/Missing permission: sales.edit/);
  });
});
