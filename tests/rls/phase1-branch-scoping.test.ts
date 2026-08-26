import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { adminClient, createSignedInTestUser, deleteTestUser, hasServiceRoleKey } from "./helpers";

// Automated regression test for migration 0045: post_goods_receipt,
// confirm_sales_order, dispatch_delivery, and generate_sales_invoice_from_delivery
// never re-checked has_branch_access() in their own bodies, even though migration
// 0033 added the check to their tables' RLS policies -- a SECURITY DEFINER
// function's body bypasses RLS entirely, so a Branch-B-scoped user could call any
// of the four and act on Branch-A data outright. Requires SUPABASE_SERVICE_ROLE_KEY
// (test setup only, see tests/rls/helpers.ts).
describe.skipIf(!hasServiceRoleKey)("Phase 1 branch scoping (migration 0045 regression)", () => {
  let owner: { userId: string; client: ReturnType<typeof adminClient> };
  let branchBUser: { userId: string; client: ReturnType<typeof adminClient> };
  let tenantId: string;
  let branchAId: string;
  let branchBId: string;
  let warehouseAId: string;
  let supplierId: string;
  let customerId: string;
  let productId: string;
  let pcsUomId: string;

  beforeAll(async () => {
    const suffix = Date.now();
    owner = await createSignedInTestUser(`p1-branchsec-owner-${suffix}@stonevora.test`, "test-password-123");
    branchBUser = await createSignedInTestUser(`p1-branchsec-b-${suffix}@stonevora.test`, "test-password-123");

    const { data: tId } = await owner.client.rpc("create_tenant_for_user", {
      p_tenant_name: `Branch Sec Test ${suffix}`,
      p_tenant_slug: `branch-sec-test-${suffix}`,
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
      .insert({ tenant_id: tenantId, sku: "TILE-BS-01", name: "Test Tile", inventory_tracking_mode: "simple", base_uom_id: pcsUomId })
      .select("id").single();
    productId = product!.id;

    // warehouse_staff covers purchasing.edit (post_goods_receipt); dispatch_staff
    // covers sales.create/edit (confirm_sales_order, dispatch_delivery,
    // generate_sales_invoice_from_delivery) -- both scoped only to Branch B, so any
    // success against Branch-A data can only be explained by a missing branch check.
    const { data: warehouseStaffRole } = await admin.from("roles").select("id").eq("tenant_id", tenantId).eq("code", "warehouse_staff").single();
    const { data: dispatchStaffRole } = await admin.from("roles").select("id").eq("tenant_id", tenantId).eq("code", "dispatch_staff").single();
    await admin.from("user_tenants").insert({ user_id: branchBUser.userId, tenant_id: tenantId });
    await admin.from("user_roles").insert([
      { user_id: branchBUser.userId, tenant_id: tenantId, role_id: warehouseStaffRole!.id, branch_id: branchBId },
      { user_id: branchBUser.userId, tenant_id: tenantId, role_id: dispatchStaffRole!.id, branch_id: branchBId },
    ]);
  });

  afterAll(async () => {
    const admin = adminClient();
    await admin.from("audit_log").delete().in("changed_by", [owner.userId, branchBUser.userId]);
    await admin.from("tenants").delete().eq("id", tenantId);
    await deleteTestUser(owner.userId);
    await deleteTestUser(branchBUser.userId);
  });

  test("post_goods_receipt rejects a Branch-B-scoped user acting on a Branch-A receipt, but succeeds for the owner", async () => {
    const { data: po } = await owner.client
      .from("purchase_orders")
      .insert({ tenant_id: tenantId, branch_id: branchAId, supplier_id: supplierId, po_number: "PO-BS-1", status: "confirmed" })
      .select("id").single();
    const { data: poLine } = await owner.client
      .from("purchase_order_lines")
      .insert({ tenant_id: tenantId, purchase_order_id: po!.id, product_id: productId, quantity: 10, uom_id: pcsUomId, unit_price: 20 })
      .select("id").single();
    const { data: grn } = await owner.client
      .from("goods_receipts")
      .insert({ tenant_id: tenantId, branch_id: branchAId, warehouse_id: warehouseAId, purchase_order_id: po!.id, grn_number: "GRN-BS-1", landed_cost_basis: "value" })
      .select("id").single();
    await owner.client.from("goods_receipt_lines").insert({
      tenant_id: tenantId, goods_receipt_id: grn!.id, purchase_order_line_id: poLine!.id,
      product_id: productId, quantity: 10, uom_id: pcsUomId, unit_cost: 20,
    });

    const { error: rejected } = await branchBUser.client.rpc("post_goods_receipt", { p_goods_receipt_id: grn!.id });
    expect(rejected).not.toBeNull();
    expect(rejected?.message).toMatch(/do not have access to the branch/);

    const { error: succeeded } = await owner.client.rpc("post_goods_receipt", { p_goods_receipt_id: grn!.id });
    expect(succeeded).toBeNull();
    const { data: posted } = await owner.client.from("goods_receipts").select("status").eq("id", grn!.id).single();
    expect(posted?.status).toBe("posted");
  });

  test("confirm_sales_order, dispatch_delivery, and generate_sales_invoice_from_delivery all reject a Branch-B-scoped user on Branch-A data, but succeed for the owner", async () => {
    // Owner posts a receipt first so there's stock to sell.
    const { data: po } = await owner.client
      .from("purchase_orders")
      .insert({ tenant_id: tenantId, branch_id: branchAId, supplier_id: supplierId, po_number: "PO-BS-2", status: "confirmed" })
      .select("id").single();
    const { data: poLine } = await owner.client
      .from("purchase_order_lines")
      .insert({ tenant_id: tenantId, purchase_order_id: po!.id, product_id: productId, quantity: 100, uom_id: pcsUomId, unit_price: 20 })
      .select("id").single();
    const { data: grn } = await owner.client
      .from("goods_receipts")
      .insert({ tenant_id: tenantId, branch_id: branchAId, warehouse_id: warehouseAId, purchase_order_id: po!.id, grn_number: "GRN-BS-2", landed_cost_basis: "value" })
      .select("id").single();
    await owner.client.from("goods_receipt_lines").insert({
      tenant_id: tenantId, goods_receipt_id: grn!.id, purchase_order_line_id: poLine!.id,
      product_id: productId, quantity: 100, uom_id: pcsUomId, unit_cost: 20,
    });
    await owner.client.rpc("post_goods_receipt", { p_goods_receipt_id: grn!.id });

    const { data: so } = await owner.client
      .from("sales_orders")
      .insert({ tenant_id: tenantId, branch_id: branchAId, customer_id: customerId, warehouse_id: warehouseAId, so_number: "SO-BS-1", status: "draft" })
      .select("id").single();
    const { data: soLine } = await owner.client
      .from("sales_order_lines")
      .insert({ tenant_id: tenantId, sales_order_id: so!.id, product_id: productId, quantity: 10, uom_id: pcsUomId, unit_price: 25 })
      .select("id").single();

    const { error: confirmRejected } = await branchBUser.client.rpc("confirm_sales_order", { p_sales_order_id: so!.id });
    expect(confirmRejected).not.toBeNull();
    expect(confirmRejected?.message).toMatch(/do not have access to the branch/);

    const { error: confirmSucceeded } = await owner.client.rpc("confirm_sales_order", { p_sales_order_id: so!.id });
    expect(confirmSucceeded).toBeNull();

    const { data: delivery } = await owner.client
      .from("deliveries")
      .insert({ tenant_id: tenantId, branch_id: branchAId, warehouse_id: warehouseAId, sales_order_id: so!.id, delivery_number: "DEL-BS-1" })
      .select("id").single();
    await owner.client.from("delivery_lines").insert({
      tenant_id: tenantId, delivery_id: delivery!.id, sales_order_line_id: soLine!.id, product_id: productId, quantity: 10,
    });

    const { error: dispatchRejected } = await branchBUser.client.rpc("dispatch_delivery", { p_delivery_id: delivery!.id });
    expect(dispatchRejected).not.toBeNull();
    expect(dispatchRejected?.message).toMatch(/do not have access to the branch/);

    const { error: dispatchSucceeded } = await owner.client.rpc("dispatch_delivery", { p_delivery_id: delivery!.id });
    expect(dispatchSucceeded).toBeNull();

    const { error: invoiceRejected } = await branchBUser.client.rpc("generate_sales_invoice_from_delivery", {
      p_delivery_id: delivery!.id,
      p_invoice_number: "INV-BS-REJECT",
    });
    expect(invoiceRejected).not.toBeNull();
    expect(invoiceRejected?.message).toMatch(/do not have access to the branch/);

    const { data: invoiceId, error: invoiceSucceeded } = await owner.client.rpc("generate_sales_invoice_from_delivery", {
      p_delivery_id: delivery!.id,
      p_invoice_number: "INV-BS-1",
    });
    expect(invoiceSucceeded).toBeNull();
    expect(invoiceId).toBeTruthy();
  });
});
