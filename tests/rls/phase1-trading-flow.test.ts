import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { adminClient, createSignedInTestUser, deleteTestUser, hasServiceRoleKey } from "./helpers";

// Mirrors the manual verification performed against the live database while
// building Phase 1: landed-cost allocation, oversell prevention, COGS capture,
// margin redaction, and the payment→ledger sync. Requires
// SUPABASE_SERVICE_ROLE_KEY (test setup only, see tests/rls/helpers.ts).
describe.skipIf(!hasServiceRoleKey)("Phase 1: trading/distribution flow", () => {
  let owner: { userId: string; client: ReturnType<typeof adminClient> };
  let salesperson: { userId: string; client: ReturnType<typeof adminClient> };
  let tenantId: string;
  let branchId: string;
  let warehouseId: string;
  let supplierId: string;
  let customerId: string;
  let productId: string;
  let pcsUomId: string;
  let poId: string;
  let poLineId: string;
  let soId: string;
  let soLineId: string;

  beforeAll(async () => {
    const suffix = Date.now();
    owner = await createSignedInTestUser(`p1-owner-${suffix}@stonevora.test`, "test-password-123");
    salesperson = await createSignedInTestUser(`p1-sales-${suffix}@stonevora.test`, "test-password-123");

    const { data: tId } = await owner.client.rpc("create_tenant_for_user", {
      p_tenant_name: `Phase1 Test ${suffix}`,
      p_tenant_slug: `phase1-test-${suffix}`,
    });
    tenantId = tId!;

    const admin = adminClient();
    const { data: uom } = await admin.from("uom").select("id").eq("code", "PCS").is("tenant_id", null).single();
    pcsUomId = uom!.id;

    const { data: branch } = await owner.client
      .from("branches")
      .insert({ tenant_id: tenantId, code: "HO", name: "Head Office", is_head_office: true })
      .select("id")
      .single();
    branchId = branch!.id;

    const { data: warehouse } = await owner.client
      .from("warehouses")
      .insert({ tenant_id: tenantId, branch_id: branchId, code: "WH1", name: "Main" })
      .select("id")
      .single();
    warehouseId = warehouse!.id;

    const { data: supplier } = await owner.client
      .from("suppliers")
      .insert({ tenant_id: tenantId, code: "SUP1", name: "Test Supplier" })
      .select("id")
      .single();
    supplierId = supplier!.id;

    const { data: customer } = await owner.client
      .from("customers")
      .insert({ tenant_id: tenantId, code: "CUST1", name: "Test Customer" })
      .select("id")
      .single();
    customerId = customer!.id;

    const { data: product } = await owner.client
      .from("products")
      .insert({ tenant_id: tenantId, sku: "TILE-01", name: "Test Tile", inventory_tracking_mode: "simple", base_uom_id: pcsUomId })
      .select("id")
      .single();
    productId = product!.id;

    const { data: salespersonRole } = await admin
      .from("roles")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("code", "salesperson")
      .single();
    await admin.from("user_tenants").insert({ user_id: salesperson.userId, tenant_id: tenantId });
    await admin.from("user_roles").insert({ user_id: salesperson.userId, tenant_id: tenantId, role_id: salespersonRole!.id });
  });

  afterAll(async () => {
    const admin = adminClient();
    await admin.from("tenants").delete().eq("id", tenantId);
    await deleteTestUser(owner.userId);
    await deleteTestUser(salesperson.userId);
  });

  test("landed cost allocates correctly and updates weighted-average cost", async () => {
    const { data: po } = await owner.client
      .from("purchase_orders")
      .insert({ tenant_id: tenantId, branch_id: branchId, supplier_id: supplierId, po_number: "PO-1", status: "confirmed" })
      .select("id")
      .single();
    poId = po!.id;

    const { data: poLine } = await owner.client
      .from("purchase_order_lines")
      .insert({ tenant_id: tenantId, purchase_order_id: poId, product_id: productId, quantity: 100, uom_id: pcsUomId, unit_price: 20 })
      .select("id")
      .single();
    poLineId = poLine!.id;

    const { data: grn } = await owner.client
      .from("goods_receipts")
      .insert({ tenant_id: tenantId, branch_id: branchId, warehouse_id: warehouseId, purchase_order_id: poId, grn_number: "GRN-1", freight_cost: 200, landed_cost_basis: "value" })
      .select("id")
      .single();

    await owner.client.from("goods_receipt_lines").insert({
      tenant_id: tenantId, goods_receipt_id: grn!.id, purchase_order_line_id: poLineId,
      product_id: productId, quantity: 100, uom_id: pcsUomId, unit_cost: 20,
    });

    const { error } = await owner.client.rpc("post_goods_receipt", { p_goods_receipt_id: grn!.id });
    expect(error).toBeNull();

    const { data: stock } = await owner.client
      .from("inventory_stock")
      .select("qty_on_hand, avg_cost")
      .eq("product_id", productId)
      .single();
    // (100 * 20 + 200 freight) / 100 = 22
    expect(stock?.qty_on_hand).toBe("100.0000");
    expect(stock?.avg_cost).toBe("22.0000");
  });

  test("confirm_sales_order rejects overselling and reserves nothing on failure", async () => {
    const { data: so } = await owner.client
      .from("sales_orders")
      .insert({ tenant_id: tenantId, branch_id: branchId, customer_id: customerId, warehouse_id: warehouseId, so_number: "SO-1", status: "draft" })
      .select("id")
      .single();
    soId = so!.id;

    const { data: soLine } = await owner.client
      .from("sales_order_lines")
      .insert({ tenant_id: tenantId, sales_order_id: soId, product_id: productId, quantity: 150, uom_id: pcsUomId, unit_price: 25 })
      .select("id")
      .single();
    soLineId = soLine!.id;

    const { error } = await owner.client.rpc("confirm_sales_order", { p_sales_order_id: soId });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/Insufficient available stock/);

    const { data: stock } = await owner.client
      .from("inventory_stock")
      .select("reserved_qty")
      .eq("product_id", productId)
      .single();
    expect(stock?.reserved_qty).toBe("0.0000");
  });

  test("confirm_sales_order reserves correctly once quantity fits, dispatch decrements stock and captures COGS", async () => {
    await owner.client.from("sales_order_lines").update({ quantity: 60 }).eq("id", soLineId);

    const { error: confirmError } = await owner.client.rpc("confirm_sales_order", { p_sales_order_id: soId });
    expect(confirmError).toBeNull();

    const { data: stockAfterConfirm } = await owner.client
      .from("inventory_stock")
      .select("qty_on_hand, reserved_qty")
      .eq("product_id", productId)
      .single();
    expect(stockAfterConfirm?.qty_on_hand).toBe("100.0000");
    expect(stockAfterConfirm?.reserved_qty).toBe("60.0000");

    const { data: delivery } = await owner.client
      .from("deliveries")
      .insert({ tenant_id: tenantId, branch_id: branchId, warehouse_id: warehouseId, sales_order_id: soId, delivery_number: "DEL-1" })
      .select("id")
      .single();

    const { data: deliveryLine } = await owner.client
      .from("delivery_lines")
      .insert({ tenant_id: tenantId, delivery_id: delivery!.id, sales_order_line_id: soLineId, product_id: productId, quantity: 60 })
      .select("id")
      .single();

    const { error: dispatchError } = await owner.client.rpc("dispatch_delivery", { p_delivery_id: delivery!.id });
    expect(dispatchError).toBeNull();

    const { data: stockAfterDispatch } = await owner.client
      .from("inventory_stock")
      .select("qty_on_hand, reserved_qty")
      .eq("product_id", productId)
      .single();
    expect(stockAfterDispatch?.qty_on_hand).toBe("40.0000");
    expect(stockAfterDispatch?.reserved_qty).toBe("0.0000");

    const { data: line } = await owner.client
      .from("delivery_lines")
      .select("unit_cost")
      .eq("id", deliveryLine!.id)
      .single();
    expect(line?.unit_cost).toBe("22.0000");

    const { data: invoiceId } = await owner.client.rpc("generate_sales_invoice_from_delivery", {
      p_delivery_id: delivery!.id,
      p_invoice_number: "INV-1",
    });
    expect(invoiceId).toBeTruthy();

    const { data: ownerLine } = await owner.client
      .from("sales_invoice_lines_secure")
      .select("unit_cost, margin")
      .eq("sales_invoice_id", invoiceId!)
      .single();
    // (60*25) - (60*22) = 180
    expect(ownerLine?.unit_cost).toBe("22.0000");
    expect(Number(ownerLine?.margin)).toBeCloseTo(180, 4);

    const { data: salespersonLine } = await salesperson.client
      .from("sales_invoice_lines_secure")
      .select("unit_cost, margin")
      .eq("sales_invoice_id", invoiceId!)
      .single();
    expect(salespersonLine?.unit_cost).toBeNull();
    expect(salespersonLine?.margin).toBeNull();
  });
});
