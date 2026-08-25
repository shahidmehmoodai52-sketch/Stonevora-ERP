import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { adminClient, createSignedInTestUser, deleteTestUser, hasServiceRoleKey } from "./helpers";

// Automated version of the live-database verification performed while closing
// two gaps flagged in docs/PRE_FACTORY_ARCHITECTURE_AUDIT.md: (1) none of the
// Phase 1 integrity functions converted a line's UOM before touching
// qty_on_hand/reserved_qty, so receiving/selling in a non-base UOM silently
// corrupted stock; (2) user_roles.branch_id existed but was never enforced by
// RLS, so a branch-scoped role could see another branch's data. Requires
// SUPABASE_SERVICE_ROLE_KEY (test setup only, see tests/rls/helpers.ts).
describe.skipIf(!hasServiceRoleKey)("Foundation hardening: UOM conversion + branch scoping", () => {
  let owner: { userId: string; client: ReturnType<typeof adminClient> };
  let salesA: { userId: string; client: ReturnType<typeof adminClient> };
  let tenantId: string;
  let branchAId: string;
  let branchBId: string;
  let warehouseAId: string;
  let warehouseBId: string;
  let supplierId: string;
  let customerId: string;
  let productId: string;
  let boxUomId: string;
  let pcsUomId: string;

  beforeAll(async () => {
    const suffix = Date.now();
    owner = await createSignedInTestUser(`fh-owner-${suffix}@stonevora.test`, "test-password-123");
    salesA = await createSignedInTestUser(`fh-salesA-${suffix}@stonevora.test`, "test-password-123");

    const { data: tId } = await owner.client.rpc("create_tenant_for_user", {
      p_tenant_name: `Foundation Test ${suffix}`,
      p_tenant_slug: `foundation-test-${suffix}`,
    });
    tenantId = tId!;

    const admin = adminClient();
    const { data: box } = await admin.from("uom").select("id").eq("code", "BOX").is("tenant_id", null).single();
    const { data: pcs } = await admin.from("uom").select("id").eq("code", "PCS").is("tenant_id", null).single();
    boxUomId = box!.id;
    pcsUomId = pcs!.id;

    // Global conversion: 1 BOX = 10 PCS (and the reverse) -- global rows can
    // only be written by the service role, matching the seed-data precedent.
    await admin.from("uom_conversions").insert([
      { tenant_id: null, product_id: null, from_uom_id: boxUomId, to_uom_id: pcsUomId, conversion_factor: 10 },
      { tenant_id: null, product_id: null, from_uom_id: pcsUomId, to_uom_id: boxUomId, conversion_factor: 0.1 },
    ]);

    const { data: branchA } = await owner.client
      .from("branches").insert({ tenant_id: tenantId, code: "BA", name: "Branch A", is_head_office: true }).select("id").single();
    branchAId = branchA!.id;
    const { data: branchB } = await owner.client
      .from("branches").insert({ tenant_id: tenantId, code: "BB", name: "Branch B" }).select("id").single();
    branchBId = branchB!.id;

    const { data: warehouseA } = await owner.client
      .from("warehouses").insert({ tenant_id: tenantId, branch_id: branchAId, code: "WA", name: "Warehouse A" }).select("id").single();
    warehouseAId = warehouseA!.id;
    const { data: warehouseB } = await owner.client
      .from("warehouses").insert({ tenant_id: tenantId, branch_id: branchBId, code: "WB", name: "Warehouse B" }).select("id").single();
    warehouseBId = warehouseB!.id;

    const { data: supplier } = await owner.client
      .from("suppliers").insert({ tenant_id: tenantId, code: "SUP1", name: "Test Supplier" }).select("id").single();
    supplierId = supplier!.id;
    const { data: customer } = await owner.client
      .from("customers").insert({ tenant_id: tenantId, code: "CUST1", name: "Test Customer" }).select("id").single();
    customerId = customer!.id;

    const { data: product } = await owner.client
      .from("products")
      .insert({ tenant_id: tenantId, sku: "TILE-BOX-01", name: "Tile sold by box", inventory_tracking_mode: "simple", base_uom_id: pcsUomId })
      .select("id").single();
    productId = product!.id;

    const { data: salespersonRole } = await admin
      .from("roles").select("id").eq("tenant_id", tenantId).eq("code", "salesperson").single();
    await admin.from("user_tenants").insert({ user_id: salesA.userId, tenant_id: tenantId });
    await admin.from("user_roles").insert({ user_id: salesA.userId, tenant_id: tenantId, role_id: salespersonRole!.id, branch_id: branchAId });
  });

  afterAll(async () => {
    const admin = adminClient();
    await admin.from("uom_conversions").delete().eq("from_uom_id", boxUomId).eq("to_uom_id", pcsUomId).is("product_id", null).eq("conversion_factor", 10);
    await admin.from("uom_conversions").delete().eq("from_uom_id", pcsUomId).eq("to_uom_id", boxUomId).is("product_id", null).eq("conversion_factor", 0.1);
    await admin.from("tenants").delete().eq("id", tenantId);
    await deleteTestUser(owner.userId);
    await deleteTestUser(salesA.userId);
  });

  test("UOM conversion: receiving/selling in BOX correctly converts to PCS-denominated stock and preserves cost", async () => {
    const { data: po } = await owner.client
      .from("purchase_orders")
      .insert({ tenant_id: tenantId, branch_id: branchAId, supplier_id: supplierId, po_number: "PO-1", status: "confirmed" })
      .select("id").single();
    const { data: poLine } = await owner.client
      .from("purchase_order_lines")
      .insert({ tenant_id: tenantId, purchase_order_id: po!.id, product_id: productId, quantity: 5, uom_id: boxUomId, unit_price: 100 })
      .select("id").single();

    const { data: grn } = await owner.client
      .from("goods_receipts")
      .insert({ tenant_id: tenantId, branch_id: branchAId, warehouse_id: warehouseAId, purchase_order_id: po!.id, grn_number: "GRN-1", freight_cost: 0, landed_cost_basis: "value" })
      .select("id").single();
    const { data: grnLine } = await owner.client
      .from("goods_receipt_lines")
      .insert({ tenant_id: tenantId, goods_receipt_id: grn!.id, purchase_order_line_id: poLine!.id, product_id: productId, quantity: 5, uom_id: boxUomId, unit_cost: 100 })
      .select("id").single();

    const { error: grnError } = await owner.client.rpc("post_goods_receipt", { p_goods_receipt_id: grn!.id });
    expect(grnError).toBeNull();

    const { data: stockAfterReceipt } = await owner.client
      .from("inventory_stock").select("qty_on_hand, avg_cost, uom_id").eq("product_id", productId).single();
    // 5 boxes * 10 pcs/box = 50 pcs; (5*100)/50 = 10 per pcs.
    expect(stockAfterReceipt?.qty_on_hand).toBe("50.0000");
    expect(stockAfterReceipt?.avg_cost).toBe("10.0000");
    expect(stockAfterReceipt?.uom_id).toBe(pcsUomId);

    const { data: grnLineAfter } = await owner.client
      .from("goods_receipt_lines").select("base_quantity").eq("id", grnLine!.id).single();
    expect(grnLineAfter?.base_quantity).toBe("50.0000");

    const { data: poLineAfter } = await owner.client
      .from("purchase_order_lines").select("received_quantity").eq("id", poLine!.id).single();
    expect(poLineAfter?.received_quantity).toBe("5.0000"); // still in the PO line's own BOX unit

    const { data: so } = await owner.client
      .from("sales_orders")
      .insert({ tenant_id: tenantId, branch_id: branchAId, customer_id: customerId, warehouse_id: warehouseAId, so_number: "SO-1", status: "draft" })
      .select("id").single();
    const { data: soLine } = await owner.client
      .from("sales_order_lines")
      .insert({ tenant_id: tenantId, sales_order_id: so!.id, product_id: productId, quantity: 3, uom_id: boxUomId, unit_price: 150 })
      .select("id").single();

    const { error: confirmError } = await owner.client.rpc("confirm_sales_order", { p_sales_order_id: so!.id });
    expect(confirmError).toBeNull();

    const { data: stockAfterConfirm } = await owner.client
      .from("inventory_stock").select("qty_on_hand, reserved_qty").eq("product_id", productId).single();
    expect(stockAfterConfirm?.qty_on_hand).toBe("50.0000");
    expect(stockAfterConfirm?.reserved_qty).toBe("30.0000"); // 3 boxes -> 30 pcs reserved

    const { data: soLineAfter } = await owner.client
      .from("sales_order_lines").select("reserved_quantity, base_quantity").eq("id", soLine!.id).single();
    expect(soLineAfter?.reserved_quantity).toBe("3.0000"); // line's own BOX unit, unchanged
    expect(soLineAfter?.base_quantity).toBe("30.0000");

    const { data: delivery } = await owner.client
      .from("deliveries")
      .insert({ tenant_id: tenantId, branch_id: branchAId, warehouse_id: warehouseAId, sales_order_id: so!.id, delivery_number: "DEL-1" })
      .select("id").single();
    const { data: deliveryLine } = await owner.client
      .from("delivery_lines")
      .insert({ tenant_id: tenantId, delivery_id: delivery!.id, sales_order_line_id: soLine!.id, product_id: productId, quantity: 3 })
      .select("id").single();

    const { error: dispatchError } = await owner.client.rpc("dispatch_delivery", { p_delivery_id: delivery!.id });
    expect(dispatchError).toBeNull();

    const { data: stockAfterDispatch } = await owner.client
      .from("inventory_stock").select("qty_on_hand, reserved_qty").eq("product_id", productId).single();
    expect(stockAfterDispatch?.qty_on_hand).toBe("20.0000"); // 50 - 30 pcs
    expect(stockAfterDispatch?.reserved_qty).toBe("0.0000");

    const { data: deliveryLineAfter } = await owner.client
      .from("delivery_lines").select("unit_cost, base_quantity").eq("id", deliveryLine!.id).single();
    // Cost round-trips correctly through the BOX<->PCS conversion: 100/box in, 100/box out.
    expect(deliveryLineAfter?.unit_cost).toBe("100.0000");
    expect(deliveryLineAfter?.base_quantity).toBe("30.0000");

    const { data: invoiceId } = await owner.client.rpc("generate_sales_invoice_from_delivery", {
      p_delivery_id: delivery!.id,
      p_invoice_number: "INV-1",
    });
    expect(invoiceId).toBeTruthy();

    const { data: invoiceLine } = await owner.client
      .from("sales_invoice_lines_secure")
      .select("unit_price, unit_cost, quantity, line_total, margin")
      .eq("sales_invoice_id", invoiceId!)
      .single();
    expect(invoiceLine?.unit_price).toBe("150.0000");
    expect(invoiceLine?.unit_cost).toBe("100.0000");
    expect(invoiceLine?.line_total).toBe("450.0000");
    expect(Number(invoiceLine?.margin)).toBeCloseTo(150, 4);
  });

  test("UOM conversion: raises a clear error rather than guessing when no conversion path is configured", async () => {
    const { data: tonUom } = await adminClient().from("uom").select("id").eq("code", "TON").is("tenant_id", null).single();

    const { data: po } = await owner.client
      .from("purchase_orders")
      .insert({ tenant_id: tenantId, branch_id: branchAId, supplier_id: supplierId, po_number: "PO-NOCONV", status: "confirmed" })
      .select("id").single();
    const { data: poLine } = await owner.client
      .from("purchase_order_lines")
      .insert({ tenant_id: tenantId, purchase_order_id: po!.id, product_id: productId, quantity: 1, uom_id: tonUom!.id, unit_price: 100 })
      .select("id").single();
    const { data: grn } = await owner.client
      .from("goods_receipts")
      .insert({ tenant_id: tenantId, branch_id: branchAId, warehouse_id: warehouseAId, purchase_order_id: po!.id, grn_number: "GRN-NOCONV", freight_cost: 0, landed_cost_basis: "value" })
      .select("id").single();
    await owner.client.from("goods_receipt_lines").insert({
      tenant_id: tenantId, goods_receipt_id: grn!.id, purchase_order_line_id: poLine!.id,
      product_id: productId, quantity: 1, uom_id: tonUom!.id, unit_cost: 100,
    });

    const { error } = await owner.client.rpc("post_goods_receipt", { p_goods_receipt_id: grn!.id });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/No UOM conversion defined/);
  });

  test("Branch scoping: a branch-A-scoped role sees only branch A's sales orders; an unscoped role sees all", async () => {
    const { data: soA } = await owner.client
      .from("sales_orders")
      .insert({ tenant_id: tenantId, branch_id: branchAId, customer_id: customerId, warehouse_id: warehouseAId, so_number: "SO-BRANCH-A", status: "draft" })
      .select("id").single();
    const { data: soB } = await owner.client
      .from("sales_orders")
      .insert({ tenant_id: tenantId, branch_id: branchBId, customer_id: customerId, warehouse_id: warehouseBId, so_number: "SO-BRANCH-B", status: "draft" })
      .select("id").single();

    const { data: salesASees } = await salesA.client
      .from("sales_orders").select("id, so_number").eq("tenant_id", tenantId);
    expect(salesASees?.some((r) => r.id === soA!.id)).toBe(true);
    expect(salesASees?.some((r) => r.id === soB!.id)).toBe(false);

    const { data: ownerSees } = await owner.client
      .from("sales_orders").select("id, so_number").eq("tenant_id", tenantId);
    expect(ownerSees?.some((r) => r.id === soA!.id)).toBe(true);
    expect(ownerSees?.some((r) => r.id === soB!.id)).toBe(true);
  });
});
