import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { adminClient, createSignedInTestUser, deleteTestUser, hasServiceRoleKey } from "./helpers";

// Automated version of the live-database verification performed while
// building the stock-transfer module (docs/PRE_FACTORY_ARCHITECTURE_AUDIT.md
// section 3/12). Requires SUPABASE_SERVICE_ROLE_KEY (test setup only).
describe.skipIf(!hasServiceRoleKey)("Stock transfers", () => {
  let owner: { userId: string; client: ReturnType<typeof adminClient> };
  let branchCUser: { userId: string; client: ReturnType<typeof adminClient> };
  let tenantId: string;
  let branchAId: string;
  let branchBId: string;
  let branchCId: string;
  let warehouseAId: string;
  let warehouseBId: string;
  let locationAId: string;
  let locationBId: string;
  let productId: string;
  let pcsUomId: string;
  let sourceStockId: string;

  beforeAll(async () => {
    const suffix = Date.now();
    owner = await createSignedInTestUser(`st-owner-${suffix}@stonevora.test`, "test-password-123");
    branchCUser = await createSignedInTestUser(`st-branchC-${suffix}@stonevora.test`, "test-password-123");

    const { data: tId } = await owner.client.rpc("create_tenant_for_user", {
      p_tenant_name: `Stock Transfer Test ${suffix}`,
      p_tenant_slug: `stock-transfer-test-${suffix}`,
    });
    tenantId = tId!;

    const admin = adminClient();
    const { data: pcs } = await admin.from("uom").select("id").eq("code", "PCS").is("tenant_id", null).single();
    pcsUomId = pcs!.id;

    const { data: branchA } = await owner.client.from("branches").insert({ tenant_id: tenantId, code: "BA", name: "Branch A", is_head_office: true }).select("id").single();
    branchAId = branchA!.id;
    const { data: branchB } = await owner.client.from("branches").insert({ tenant_id: tenantId, code: "BB", name: "Branch B" }).select("id").single();
    branchBId = branchB!.id;
    const { data: branchC } = await owner.client.from("branches").insert({ tenant_id: tenantId, code: "BC", name: "Branch C" }).select("id").single();
    branchCId = branchC!.id;

    const { data: warehouseA } = await owner.client.from("warehouses").insert({ tenant_id: tenantId, branch_id: branchAId, code: "WA", name: "Warehouse A" }).select("id").single();
    warehouseAId = warehouseA!.id;
    const { data: warehouseB } = await owner.client.from("warehouses").insert({ tenant_id: tenantId, branch_id: branchBId, code: "WB", name: "Warehouse B" }).select("id").single();
    warehouseBId = warehouseB!.id;

    const { data: locationA } = await owner.client.from("storage_locations").insert({ tenant_id: tenantId, warehouse_id: warehouseAId, location_type: "zone", code: "ZA1" }).select("id").single();
    locationAId = locationA!.id;
    const { data: locationB } = await owner.client.from("storage_locations").insert({ tenant_id: tenantId, warehouse_id: warehouseBId, location_type: "zone", code: "ZB1" }).select("id").single();
    locationBId = locationB!.id;

    const { data: product } = await owner.client
      .from("products")
      .insert({ tenant_id: tenantId, sku: "XFER-01", name: "Transfer Test Product", inventory_tracking_mode: "simple", base_uom_id: pcsUomId })
      .select("id").single();
    productId = product!.id;

    const { data: stock } = await owner.client
      .from("inventory_stock")
      .insert({ tenant_id: tenantId, product_id: productId, location_id: locationAId, qty_on_hand: 100, avg_cost: 5, uom_id: pcsUomId })
      .select("id").single();
    sourceStockId = stock!.id;

    const { data: inventoryManagerRole } = await admin
      .from("roles").select("id").eq("tenant_id", tenantId).eq("code", "inventory_manager").single();
    await admin.from("user_tenants").insert({ user_id: branchCUser.userId, tenant_id: tenantId });
    await admin.from("user_roles").insert({ user_id: branchCUser.userId, tenant_id: tenantId, role_id: inventoryManagerRole!.id, branch_id: branchCId });
  });

  afterAll(async () => {
    const admin = adminClient();
    await admin.from("tenants").delete().eq("id", tenantId);
    await deleteTestUser(owner.userId);
    await deleteTestUser(branchCUser.userId);
  });

  test("rejects a transfer with the same source and destination warehouse", async () => {
    const { error } = await owner.client.from("stock_transfers").insert({
      tenant_id: tenantId, transfer_number: "XFER-SAME",
      source_branch_id: branchAId, source_warehouse_id: warehouseAId,
      destination_branch_id: branchAId, destination_warehouse_id: warehouseAId,
    });
    expect(error).not.toBeNull();
  });

  test("full transfer: source decreases, destination increases, genealogy of the movement is traceable", async () => {
    const { data: transfer } = await owner.client
      .from("stock_transfers")
      .insert({ tenant_id: tenantId, transfer_number: "XFER-1", source_branch_id: branchAId, source_warehouse_id: warehouseAId, destination_branch_id: branchBId, destination_warehouse_id: warehouseBId })
      .select("id").single();
    const { data: line } = await owner.client
      .from("stock_transfer_lines")
      .insert({ tenant_id: tenantId, stock_transfer_id: transfer!.id, product_id: productId, quantity: 30, uom_id: pcsUomId, source_location_id: locationAId, destination_location_id: locationBId })
      .select("id").single();

    const { error: shipError } = await owner.client.rpc("ship_stock_transfer", { p_stock_transfer_id: transfer!.id });
    expect(shipError).toBeNull();

    const { data: sourceAfterShip } = await owner.client.from("inventory_stock").select("qty_on_hand").eq("id", sourceStockId).single();
    expect(sourceAfterShip?.qty_on_hand).toBe("70.0000");

    // Duplicate ship must not double-decrement.
    const { error: duplicateShipError } = await owner.client.rpc("ship_stock_transfer", { p_stock_transfer_id: transfer!.id });
    expect(duplicateShipError).not.toBeNull();
    const { data: sourceAfterDuplicate } = await owner.client.from("inventory_stock").select("qty_on_hand").eq("id", sourceStockId).single();
    expect(sourceAfterDuplicate?.qty_on_hand).toBe("70.0000");

    const { error: receiveError } = await owner.client.rpc("receive_stock_transfer", { p_stock_transfer_id: transfer!.id, p_line_quantities: {} });
    expect(receiveError).toBeNull();

    const { data: destStock } = await owner.client.from("inventory_stock").select("qty_on_hand").eq("product_id", productId).eq("location_id", locationBId).single();
    expect(destStock?.qty_on_hand).toBe("30.0000");

    const { data: transferAfter } = await owner.client.from("stock_transfers").select("status").eq("id", transfer!.id).single();
    expect(transferAfter?.status).toBe("received");

    const { data: lineAfter } = await owner.client.from("stock_transfer_lines").select("base_quantity, received_quantity").eq("id", line!.id).single();
    expect(lineAfter?.base_quantity).toBe("30.0000");
    expect(lineAfter?.received_quantity).toBe("30.0000");
  });

  test("partial receipt: only the received quantity becomes available, transfer stays in_transit until fully received", async () => {
    const { data: transfer } = await owner.client
      .from("stock_transfers")
      .insert({ tenant_id: tenantId, transfer_number: "XFER-PARTIAL", source_branch_id: branchAId, source_warehouse_id: warehouseAId, destination_branch_id: branchBId, destination_warehouse_id: warehouseBId })
      .select("id").single();
    const { data: line } = await owner.client
      .from("stock_transfer_lines")
      .insert({ tenant_id: tenantId, stock_transfer_id: transfer!.id, product_id: productId, quantity: 20, uom_id: pcsUomId, source_location_id: locationAId, destination_location_id: locationBId })
      .select("id").single();

    await owner.client.rpc("ship_stock_transfer", { p_stock_transfer_id: transfer!.id });

    const { error: overReceiveError } = await owner.client.rpc("receive_stock_transfer", {
      p_stock_transfer_id: transfer!.id,
      p_line_quantities: { [line!.id]: 999 },
    });
    expect(overReceiveError).not.toBeNull();

    const { error: partialError } = await owner.client.rpc("receive_stock_transfer", {
      p_stock_transfer_id: transfer!.id,
      p_line_quantities: { [line!.id]: 12 },
    });
    expect(partialError).toBeNull();

    const { data: transferAfterPartial } = await owner.client.from("stock_transfers").select("status").eq("id", transfer!.id).single();
    expect(transferAfterPartial?.status).toBe("in_transit"); // not closed until fully received

    const { error: completeError } = await owner.client.rpc("receive_stock_transfer", {
      p_stock_transfer_id: transfer!.id,
      p_line_quantities: { [line!.id]: 8 },
    });
    expect(completeError).toBeNull();

    const { data: transferAfterComplete } = await owner.client.from("stock_transfers").select("status").eq("id", transfer!.id).single();
    expect(transferAfterComplete?.status).toBe("received");

    const { data: lineAfter } = await owner.client.from("stock_transfer_lines").select("received_quantity").eq("id", line!.id).single();
    expect(lineAfter?.received_quantity).toBe("20.0000");
  });

  test("cancellation from in_transit restores the source quantity exactly", async () => {
    const { data: sourceBefore } = await owner.client.from("inventory_stock").select("qty_on_hand").eq("id", sourceStockId).single();
    const before = Number(sourceBefore?.qty_on_hand);

    const { data: transfer } = await owner.client
      .from("stock_transfers")
      .insert({ tenant_id: tenantId, transfer_number: "XFER-CANCEL", source_branch_id: branchAId, source_warehouse_id: warehouseAId, destination_branch_id: branchBId, destination_warehouse_id: warehouseBId })
      .select("id").single();
    await owner.client
      .from("stock_transfer_lines")
      .insert({ tenant_id: tenantId, stock_transfer_id: transfer!.id, product_id: productId, quantity: 15, uom_id: pcsUomId, source_location_id: locationAId, destination_location_id: locationBId });

    await owner.client.rpc("ship_stock_transfer", { p_stock_transfer_id: transfer!.id });
    const { data: sourceAfterShip } = await owner.client.from("inventory_stock").select("qty_on_hand").eq("id", sourceStockId).single();
    expect(Number(sourceAfterShip?.qty_on_hand)).toBeCloseTo(before - 15, 4);

    const { error: cancelError } = await owner.client.rpc("cancel_stock_transfer", { p_stock_transfer_id: transfer!.id });
    expect(cancelError).toBeNull();

    const { data: sourceAfterCancel } = await owner.client.from("inventory_stock").select("qty_on_hand").eq("id", sourceStockId).single();
    expect(Number(sourceAfterCancel?.qty_on_hand)).toBeCloseTo(before, 4);

    const { data: transferAfter } = await owner.client.from("stock_transfers").select("status").eq("id", transfer!.id).single();
    expect(transferAfter?.status).toBe("cancelled");
  });

  test("rejects shipping more than the available source quantity (invalid source)", async () => {
    const { data: transfer } = await owner.client
      .from("stock_transfers")
      .insert({ tenant_id: tenantId, transfer_number: "XFER-INSUFFICIENT", source_branch_id: branchAId, source_warehouse_id: warehouseAId, destination_branch_id: branchBId, destination_warehouse_id: warehouseBId })
      .select("id").single();
    await owner.client
      .from("stock_transfer_lines")
      .insert({ tenant_id: tenantId, stock_transfer_id: transfer!.id, product_id: productId, quantity: 100000, uom_id: pcsUomId, source_location_id: locationAId, destination_location_id: locationBId });

    const { error } = await owner.client.rpc("ship_stock_transfer", { p_stock_transfer_id: transfer!.id });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/Insufficient available stock/);
  });

  test("a branch-scoped role cannot see, ship, or receive a transfer between two branches it has no access to", async () => {
    const { data: transfer } = await owner.client
      .from("stock_transfers")
      .insert({ tenant_id: tenantId, transfer_number: "XFER-UNAUTH", source_branch_id: branchAId, source_warehouse_id: warehouseAId, destination_branch_id: branchBId, destination_warehouse_id: warehouseBId })
      .select("id").single();
    await owner.client
      .from("stock_transfer_lines")
      .insert({ tenant_id: tenantId, stock_transfer_id: transfer!.id, product_id: productId, quantity: 1, uom_id: pcsUomId, source_location_id: locationAId, destination_location_id: locationBId });

    const { data: visible } = await branchCUser.client.from("stock_transfers").select("id").eq("id", transfer!.id);
    expect(visible ?? []).toHaveLength(0);

    const { error: shipError } = await branchCUser.client.rpc("ship_stock_transfer", { p_stock_transfer_id: transfer!.id });
    expect(shipError).not.toBeNull();
  });
});
