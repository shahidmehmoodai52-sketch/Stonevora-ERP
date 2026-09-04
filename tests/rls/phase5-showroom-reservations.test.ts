import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { adminClient, createSignedInTestUser, deleteTestUser, hasServiceRoleKey } from "./helpers";

// Automated version of the live-database verification performed while
// building Phase 5 (Showroom/Reservation mode). Requires
// SUPABASE_SERVICE_ROLE_KEY (test setup only, see tests/rls/helpers.ts).
describe.skipIf(!hasServiceRoleKey)("Phase 5: Showroom Reservations", () => {
  let owner: { userId: string; client: ReturnType<typeof adminClient> };
  let branchBUser: { userId: string; client: ReturnType<typeof adminClient> };
  let viewer: { userId: string; client: ReturnType<typeof adminClient> };
  let tenantId: string;
  let branchAId: string;
  let branchBId: string;
  let warehouseAId: string;
  let locationAId: string;
  let customerId: string;
  let pcsUomId: string;
  let sqmUomId: string;
  let simpleProductId: string;
  let batchProductId: string;
  let unitProductId: string;

  beforeAll(async () => {
    const suffix = Date.now();
    owner = await createSignedInTestUser(`p5-owner-${suffix}@stonevora.test`, "test-password-123");
    branchBUser = await createSignedInTestUser(`p5-branchb-${suffix}@stonevora.test`, "test-password-123");
    viewer = await createSignedInTestUser(`p5-viewer-${suffix}@stonevora.test`, "test-password-123");

    const { data: tId } = await owner.client.rpc("create_tenant_for_user", {
      p_tenant_name: `Phase5 Test ${suffix}`,
      p_tenant_slug: `phase5-test-${suffix}`,
    });
    tenantId = tId!;

    const admin = adminClient();
    // Showroom Reservation is an optional capability -- create_tenant_for_user
    // only auto-grants 'trading_distribution'.
    const { data: capability } = await admin.from("business_capabilities").select("id").eq("code", "showroom_reservation").single();
    await admin.from("tenant_capabilities").insert({ tenant_id: tenantId, capability_id: capability!.id, enabled_by: owner.userId });

    const { data: pcsUom } = await admin.from("uom").select("id").eq("code", "PCS").is("tenant_id", null).single();
    pcsUomId = pcsUom!.id;
    const { data: sqmUom } = await admin.from("uom").select("id").eq("code", "SQM").is("tenant_id", null).single();
    sqmUomId = sqmUom!.id;

    const { data: branchA } = await owner.client
      .from("branches").insert({ tenant_id: tenantId, code: "BA", name: "Branch A", is_head_office: true }).select("id").single();
    branchAId = branchA!.id;
    const { data: branchB } = await owner.client
      .from("branches").insert({ tenant_id: tenantId, code: "BB", name: "Branch B" }).select("id").single();
    branchBId = branchB!.id;

    const { data: warehouseA } = await owner.client
      .from("warehouses").insert({ tenant_id: tenantId, branch_id: branchAId, code: "WA", name: "Warehouse A" }).select("id").single();
    warehouseAId = warehouseA!.id;
    const { data: locationA } = await owner.client
      .from("storage_locations").insert({ tenant_id: tenantId, warehouse_id: warehouseAId, location_type: "zone", code: "Z1", name: "Zone 1" }).select("id").single();
    locationAId = locationA!.id;

    const { data: customer } = await owner.client
      .from("customers").insert({ tenant_id: tenantId, code: "CUST1", name: "Walk-in Customer" }).select("id").single();
    customerId = customer!.id;

    const { data: simpleProduct } = await owner.client
      .from("products").insert({ tenant_id: tenantId, sku: "TILE-SIMPLE-01", name: "Simple Tile", inventory_tracking_mode: "simple", base_uom_id: pcsUomId }).select("id").single();
    simpleProductId = simpleProduct!.id;
    const { data: batchProduct } = await owner.client
      .from("products").insert({ tenant_id: tenantId, sku: "TILE-BATCH-01", name: "Batch Tile", inventory_tracking_mode: "batch", base_uom_id: sqmUomId }).select("id").single();
    batchProductId = batchProduct!.id;
    const { data: unitProduct } = await owner.client
      .from("products").insert({ tenant_id: tenantId, sku: "SLAB-UNIT-01", name: "Granite Slab", inventory_tracking_mode: "unit", base_uom_id: sqmUomId }).select("id").single();
    unitProductId = unitProduct!.id;

    await admin.from("inventory_stock").insert({ tenant_id: tenantId, product_id: simpleProductId, location_id: locationAId, qty_on_hand: 100, uom_id: pcsUomId });
    await admin.from("inventory_batches").insert({ tenant_id: tenantId, product_id: batchProductId, batch_number: "BATCH-01", qty_on_hand: 50, uom_id: sqmUomId, current_location_id: locationAId, cost_per_uom: 10, status: "in_stock" });
    await admin.from("inventory_units").insert({ tenant_id: tenantId, product_id: unitProductId, unit_code: "SLAB-001", status: "in_stock", current_location_id: locationAId });

    const { data: viewerRole } = await admin.from("roles").select("id").eq("tenant_id", tenantId).eq("code", "viewer").single();
    const { data: ownerRole } = await admin.from("roles").select("id").eq("tenant_id", tenantId).eq("code", "owner").single();
    await admin.from("user_tenants").insert([
      { user_id: branchBUser.userId, tenant_id: tenantId },
      { user_id: viewer.userId, tenant_id: tenantId },
    ]);
    await admin.from("user_roles").insert([
      // owner role scoped to Branch B isolates pure branch-scoping from permission checks.
      { user_id: branchBUser.userId, tenant_id: tenantId, role_id: ownerRole!.id, branch_id: branchBId },
      { user_id: viewer.userId, tenant_id: tenantId, role_id: viewerRole!.id },
    ]);
  });

  afterAll(async () => {
    const admin = adminClient();
    await admin.from("audit_log").delete().in("changed_by", [owner.userId, branchBUser.userId, viewer.userId]);
    await admin.from("tenants").delete().eq("id", tenantId);
    await deleteTestUser(owner.userId);
    await deleteTestUser(branchBUser.userId);
    await deleteTestUser(viewer.userId);
  });

  async function createDraftReservation(suffix: string, lines: { productId: string; quantity: number; uomId: string; unitPrice: number }[]) {
    const { data: reservation } = await owner.client
      .from("stock_reservations").insert({
        tenant_id: tenantId, branch_id: branchAId, warehouse_id: warehouseAId, customer_id: customerId,
        reservation_number: `RES-${suffix}`, status: "draft",
      }).select("id").single();
    for (const line of lines) {
      await owner.client.from("stock_reservation_lines").insert({
        tenant_id: tenantId, stock_reservation_id: reservation!.id, product_id: line.productId,
        quantity: line.quantity, uom_id: line.uomId, unit_price: line.unitPrice,
      });
    }
    return reservation!.id as string;
  }

  test("golden path: activation holds stock proportionally, conversion hands off the hold to a real confirmed sales order without double-reserving, and the order dispatches through Phase 1's own pipeline", async () => {
    const suffix = `${Date.now()}-GOLDEN`;
    const reservationId = await createDraftReservation(suffix, [
      { productId: simpleProductId, quantity: 10, uomId: pcsUomId, unitPrice: 20 },
      { productId: batchProductId, quantity: 15, uomId: sqmUomId, unitPrice: 8 },
    ]);

    const { error: activateErr } = await owner.client.rpc("activate_stock_reservation", { p_stock_reservation_id: reservationId, p_hold_hours: 48 });
    expect(activateErr).toBeNull();

    const { data: activated } = await owner.client.from("stock_reservations").select("status, expires_at").eq("id", reservationId).single();
    expect(activated?.status).toBe("active");
    expect(new Date(activated!.expires_at!).getTime()).toBeGreaterThan(Date.now());

    const { data: simpleStock } = await owner.client.from("inventory_stock").select("qty_on_hand, reserved_qty").eq("product_id", simpleProductId).single();
    expect(Number(simpleStock?.reserved_qty)).toBeCloseTo(10, 4);
    const { data: batchStock } = await owner.client.from("inventory_batches").select("qty_on_hand, reserved_qty").eq("product_id", batchProductId).single();
    expect(Number(batchStock?.reserved_qty)).toBeCloseTo(15, 4);

    const { error: convertErr, data: salesOrderId } = await owner.client.rpc("convert_reservation_to_sales_order", { p_stock_reservation_id: reservationId, p_so_number: `SO-${suffix}` });
    expect(convertErr).toBeNull();

    const { data: so } = await owner.client.from("sales_orders").select("status").eq("id", salesOrderId!).single();
    expect(so?.status).toBe("confirmed");
    const { data: converted } = await owner.client.from("stock_reservations").select("status, sales_order_id").eq("id", reservationId).single();
    expect(converted?.status).toBe("converted");
    expect(converted?.sales_order_id).toBe(salesOrderId);

    // The hold must not have been double-reserved by conversion.
    const { data: batchStockAfterConvert } = await owner.client.from("inventory_batches").select("reserved_qty").eq("product_id", batchProductId).single();
    expect(Number(batchStockAfterConvert?.reserved_qty)).toBeCloseTo(15, 4);

    const { data: delivery } = await owner.client
      .from("deliveries").insert({ tenant_id: tenantId, branch_id: branchAId, warehouse_id: warehouseAId, sales_order_id: salesOrderId!, delivery_number: `DEL-${suffix}` }).select("id").single();
    const { data: soLines } = await owner.client.from("sales_order_lines").select("id, product_id, quantity").eq("sales_order_id", salesOrderId!);
    for (const line of soLines ?? []) {
      await owner.client.from("delivery_lines").insert({ tenant_id: tenantId, delivery_id: delivery!.id, sales_order_line_id: line.id, product_id: line.product_id, quantity: line.quantity });
    }
    const { error: dispatchErr } = await owner.client.rpc("dispatch_delivery", { p_delivery_id: delivery!.id });
    expect(dispatchErr).toBeNull();

    const { data: batchStockAfterDispatch } = await owner.client.from("inventory_batches").select("qty_on_hand, reserved_qty").eq("product_id", batchProductId).single();
    expect(Number(batchStockAfterDispatch?.reserved_qty)).toBeCloseTo(0, 4);
  });

  test("release gives the held stock back without ever creating a sales order", async () => {
    const suffix = `${Date.now()}-RELEASE`;
    const reservationId = await createDraftReservation(suffix, [{ productId: simpleProductId, quantity: 5, uomId: pcsUomId, unitPrice: 20 }]);
    await owner.client.rpc("activate_stock_reservation", { p_stock_reservation_id: reservationId, p_hold_hours: 24 });

    const { error: releaseErr } = await owner.client.rpc("release_stock_reservation", { p_stock_reservation_id: reservationId });
    expect(releaseErr).toBeNull();

    const { data: released } = await owner.client.from("stock_reservations").select("status, sales_order_id").eq("id", reservationId).single();
    expect(released?.status).toBe("released");
    expect(released?.sales_order_id).toBeNull();

    // Releasing again is rejected -- only an active hold can be released.
    const { error: reReleaseErr } = await owner.client.rpc("release_stock_reservation", { p_stock_reservation_id: reservationId });
    expect(reReleaseErr?.message).toMatch(/not active/);
  });

  test("an expired reservation cannot be converted, but can still be released", async () => {
    const suffix = `${Date.now()}-EXPIRED`;
    const reservationId = await createDraftReservation(suffix, [{ productId: simpleProductId, quantity: 5, uomId: pcsUomId, unitPrice: 20 }]);
    await owner.client.rpc("activate_stock_reservation", { p_stock_reservation_id: reservationId, p_hold_hours: 24 });

    const admin = adminClient();
    await admin.from("stock_reservations").update({ expires_at: new Date(Date.now() - 3600_000).toISOString() }).eq("id", reservationId);

    const { error: convertErr } = await owner.client.rpc("convert_reservation_to_sales_order", { p_stock_reservation_id: reservationId, p_so_number: `SO-${suffix}` });
    expect(convertErr?.message).toMatch(/expired/);

    const { error: releaseErr } = await owner.client.rpc("release_stock_reservation", { p_stock_reservation_id: reservationId });
    expect(releaseErr).toBeNull();
  });

  test("rejection paths: unit-tracked products, insufficient stock, invalid hold_hours, wrong-status calls, missing so_number", async () => {
    const suffix = `${Date.now()}-REJ`;

    const unitId = await createDraftReservation(`${suffix}-UNIT`, [{ productId: unitProductId, quantity: 1, uomId: sqmUomId, unitPrice: 500 }]);
    const { error: unitErr } = await owner.client.rpc("activate_stock_reservation", { p_stock_reservation_id: unitId, p_hold_hours: 24 });
    expect(unitErr?.message).toMatch(/not reservable through Showroom Reservation/);

    const shortId = await createDraftReservation(`${suffix}-SHORT`, [{ productId: simpleProductId, quantity: 10000, uomId: pcsUomId, unitPrice: 20 }]);
    const { error: shortErr } = await owner.client.rpc("activate_stock_reservation", { p_stock_reservation_id: shortId, p_hold_hours: 24 });
    expect(shortErr?.message).toMatch(/Insufficient available stock/);

    const badHoldId = await createDraftReservation(`${suffix}-HOLD`, [{ productId: simpleProductId, quantity: 1, uomId: pcsUomId, unitPrice: 20 }]);
    const { error: holdErr } = await owner.client.rpc("activate_stock_reservation", { p_stock_reservation_id: badHoldId, p_hold_hours: 0 });
    expect(holdErr?.message).toMatch(/hold_hours must be greater than zero/);

    const activeId = await createDraftReservation(`${suffix}-ACTIVE`, [{ productId: simpleProductId, quantity: 1, uomId: pcsUomId, unitPrice: 20 }]);
    await owner.client.rpc("activate_stock_reservation", { p_stock_reservation_id: activeId, p_hold_hours: 24 });
    const { error: reActivateErr } = await owner.client.rpc("activate_stock_reservation", { p_stock_reservation_id: activeId, p_hold_hours: 24 });
    expect(reActivateErr?.message).toMatch(/not in draft status/);

    const { error: emptySoErr } = await owner.client.rpc("convert_reservation_to_sales_order", { p_stock_reservation_id: activeId, p_so_number: "" });
    expect(emptySoErr?.message).toMatch(/so_number is required/);
  });

  test("branch scoping: a Branch-B-scoped owner cannot activate, convert, or release a Branch-A reservation", async () => {
    const suffix = `${Date.now()}-BRANCH`;
    const draftId = await createDraftReservation(suffix, [{ productId: simpleProductId, quantity: 1, uomId: pcsUomId, unitPrice: 20 }]);
    const { error: activateErr } = await branchBUser.client.rpc("activate_stock_reservation", { p_stock_reservation_id: draftId, p_hold_hours: 24 });
    expect(activateErr?.message).toMatch(/do not have access to the branch/);

    const activeId = await createDraftReservation(`${suffix}-ACTIVE`, [{ productId: simpleProductId, quantity: 1, uomId: pcsUomId, unitPrice: 20 }]);
    await owner.client.rpc("activate_stock_reservation", { p_stock_reservation_id: activeId, p_hold_hours: 24 });

    const { error: convertErr } = await branchBUser.client.rpc("convert_reservation_to_sales_order", { p_stock_reservation_id: activeId, p_so_number: `SO-${suffix}` });
    expect(convertErr?.message).toMatch(/do not have access to the branch/);

    const { error: releaseErr } = await branchBUser.client.rpc("release_stock_reservation", { p_stock_reservation_id: activeId });
    expect(releaseErr?.message).toMatch(/do not have access to the branch/);
  });

  test("permission denial: a Viewer cannot activate, convert, or release a reservation", async () => {
    const suffix = `${Date.now()}-PERM`;
    const draftId = await createDraftReservation(suffix, [{ productId: simpleProductId, quantity: 1, uomId: pcsUomId, unitPrice: 20 }]);
    const { error: activateErr } = await viewer.client.rpc("activate_stock_reservation", { p_stock_reservation_id: draftId, p_hold_hours: 24 });
    expect(activateErr?.message).toMatch(/Missing permission: sales.edit/);

    const activeId = await createDraftReservation(`${suffix}-ACTIVE`, [{ productId: simpleProductId, quantity: 1, uomId: pcsUomId, unitPrice: 20 }]);
    await owner.client.rpc("activate_stock_reservation", { p_stock_reservation_id: activeId, p_hold_hours: 24 });

    const { error: convertErr } = await viewer.client.rpc("convert_reservation_to_sales_order", { p_stock_reservation_id: activeId, p_so_number: `SO-${suffix}` });
    expect(convertErr?.message).toMatch(/Missing permission: sales.edit/);

    const { error: releaseErr } = await viewer.client.rpc("release_stock_reservation", { p_stock_reservation_id: activeId });
    expect(releaseErr?.message).toMatch(/Missing permission: sales.edit/);
  });

  test("capability gate: activate and convert are blocked without showroom_reservation enabled; release is not", async () => {
    const suffix = `${Date.now()}-CAP`;
    const admin = adminClient();
    const { data: capability } = await admin.from("business_capabilities").select("id").eq("code", "showroom_reservation").single();

    const activeId = await createDraftReservation(`${suffix}-READY`, [{ productId: simpleProductId, quantity: 1, uomId: pcsUomId, unitPrice: 20 }]);
    await owner.client.rpc("activate_stock_reservation", { p_stock_reservation_id: activeId, p_hold_hours: 24 });

    await admin.from("tenant_capabilities").delete().eq("tenant_id", tenantId).eq("capability_id", capability!.id);

    const draftId = await createDraftReservation(suffix, [{ productId: simpleProductId, quantity: 1, uomId: pcsUomId, unitPrice: 20 }]);
    const { error: activateErr } = await owner.client.rpc("activate_stock_reservation", { p_stock_reservation_id: draftId, p_hold_hours: 24 });
    expect(activateErr?.message).toMatch(/Showroom Reservation capability is not enabled/);

    const { error: convertErr } = await owner.client.rpc("convert_reservation_to_sales_order", { p_stock_reservation_id: activeId, p_so_number: `SO-${suffix}` });
    expect(convertErr?.message).toMatch(/Showroom Reservation capability is not enabled/);

    const { error: releaseErr } = await owner.client.rpc("release_stock_reservation", { p_stock_reservation_id: activeId });
    expect(releaseErr).toBeNull(); // deliberately not capability-gated, matching cancel_production_batch/cancel_processing_job precedent

    await admin.from("tenant_capabilities").insert({ tenant_id: tenantId, capability_id: capability!.id, enabled_by: owner.userId });
  });

  test("regression: Phase 1's ordinary confirm_sales_order path is unaffected", async () => {
    const suffix = `${Date.now()}-REGRESSION`;
    const { data: so } = await owner.client
      .from("sales_orders").insert({ tenant_id: tenantId, branch_id: branchAId, customer_id: customerId, warehouse_id: warehouseAId, so_number: `SO-${suffix}`, status: "draft" }).select("id").single();
    await owner.client.from("sales_order_lines").insert({ tenant_id: tenantId, sales_order_id: so!.id, product_id: simpleProductId, quantity: 1, uom_id: pcsUomId, unit_price: 20 });
    const { error } = await owner.client.rpc("confirm_sales_order", { p_sales_order_id: so!.id });
    expect(error).toBeNull();
  });
});
