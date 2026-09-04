import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { adminClient, createSignedInTestUser, deleteTestUser, hasServiceRoleKey } from "./helpers";

// Automated version of the live-database verification performed while
// building Phase 4 (Tile Manufacturing mode). Requires SUPABASE_SERVICE_ROLE_KEY
// (test setup only, see tests/rls/helpers.ts).
describe.skipIf(!hasServiceRoleKey)("Phase 4: Tile Manufacturing", () => {
  let owner: { userId: string; client: ReturnType<typeof adminClient> };
  let branchBUser: { userId: string; client: ReturnType<typeof adminClient> };
  let viewer: { userId: string; client: ReturnType<typeof adminClient> };
  let tenantId: string;
  let branchAId: string;
  let branchBId: string;
  let warehouseAId: string;
  let locationAId: string;
  let kgUomId: string;
  let sqmUomId: string;
  let clayProductId: string;
  let glazeProductId: string;
  let tileProductId: string;
  let bomId: string;

  beforeAll(async () => {
    const suffix = Date.now();
    owner = await createSignedInTestUser(`p4-owner-${suffix}@stonevora.test`, "test-password-123");
    branchBUser = await createSignedInTestUser(`p4-branchb-${suffix}@stonevora.test`, "test-password-123");
    viewer = await createSignedInTestUser(`p4-viewer-${suffix}@stonevora.test`, "test-password-123");

    const { data: tId } = await owner.client.rpc("create_tenant_for_user", {
      p_tenant_name: `Phase4 Test ${suffix}`,
      p_tenant_slug: `phase4-test-${suffix}`,
    });
    tenantId = tId!;

    const admin = adminClient();
    // Tile Manufacturing is an optional capability -- create_tenant_for_user
    // only auto-grants 'trading_distribution'.
    const { data: capability } = await admin.from("business_capabilities").select("id").eq("code", "tile_manufacturing").single();
    await admin.from("tenant_capabilities").insert({ tenant_id: tenantId, capability_id: capability!.id, enabled_by: owner.userId });

    const { data: kgUom } = await admin.from("uom").select("id").eq("code", "KG").is("tenant_id", null).single();
    kgUomId = kgUom!.id;
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

    const { data: clay } = await owner.client
      .from("products").insert({ tenant_id: tenantId, sku: "CLAY-01", name: "Clay (raw)", inventory_tracking_mode: "simple", base_uom_id: kgUomId }).select("id").single();
    clayProductId = clay!.id;
    const { data: glaze } = await owner.client
      .from("products").insert({ tenant_id: tenantId, sku: "GLAZE-01", name: "Glaze (raw)", inventory_tracking_mode: "batch", base_uom_id: kgUomId }).select("id").single();
    glazeProductId = glaze!.id;
    const { data: tile } = await owner.client
      .from("products").insert({ tenant_id: tenantId, sku: "TILE-01", name: "Finished Ceramic Tile", inventory_tracking_mode: "batch", base_uom_id: sqmUomId }).select("id").single();
    tileProductId = tile!.id;

    const { data: bom } = await owner.client
      .from("bill_of_materials").insert({ tenant_id: tenantId, product_id: tileProductId, bom_number: "BOM-01", output_quantity: 10, output_uom_id: sqmUomId, is_active: true }).select("id").single();
    bomId = bom!.id;
    await owner.client.from("bill_of_materials_lines").insert([
      { tenant_id: tenantId, bom_id: bomId, raw_material_product_id: clayProductId, quantity: 200, uom_id: kgUomId },
      { tenant_id: tenantId, bom_id: bomId, raw_material_product_id: glazeProductId, quantity: 20, uom_id: kgUomId },
    ]);

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

  async function receiveClay(suffix: string, quantity: number, unitCost: number) {
    const { data: supplier } = await owner.client
      .from("suppliers").insert({ tenant_id: tenantId, code: `SUP-${suffix}`, name: "Test Clay Supplier" }).select("id").single();
    const { data: po } = await owner.client
      .from("purchase_orders").insert({ tenant_id: tenantId, branch_id: branchAId, supplier_id: supplier!.id, po_number: `PO-${suffix}`, status: "confirmed" }).select("id").single();
    const { data: poLine } = await owner.client
      .from("purchase_order_lines").insert({ tenant_id: tenantId, purchase_order_id: po!.id, product_id: clayProductId, quantity, uom_id: kgUomId, unit_price: unitCost }).select("id").single();
    const { data: grn } = await owner.client
      .from("goods_receipts").insert({ tenant_id: tenantId, branch_id: branchAId, warehouse_id: warehouseAId, purchase_order_id: po!.id, grn_number: `GRN-${suffix}`, landed_cost_basis: "value" }).select("id").single();
    await owner.client
      .from("goods_receipt_lines").insert({ tenant_id: tenantId, goods_receipt_id: grn!.id, purchase_order_line_id: poLine!.id, product_id: clayProductId, quantity, uom_id: kgUomId, unit_cost: unitCost });
    await owner.client.rpc("post_goods_receipt", { p_goods_receipt_id: grn!.id });
  }

  async function addGlazeBatch(suffix: string, quantity: number, costPerUom: number) {
    const admin = adminClient();
    const { data: batch } = await admin
      .from("inventory_batches").insert({
        tenant_id: tenantId, product_id: glazeProductId, batch_number: `GLZ-${suffix}`,
        qty_on_hand: quantity, uom_id: kgUomId, cost_per_uom: costPerUom, current_location_id: locationAId,
      }).select("id").single();
    return batch!.id as string;
  }

  async function createDraftBatch(suffix: string, plannedOutput: number, bom: string = bomId) {
    const { data: pb } = await owner.client
      .from("production_batches").insert({
        tenant_id: tenantId, branch_id: branchAId, warehouse_id: warehouseAId, bom_id: bom,
        batch_number: `PB-${suffix}`, status: "draft", kiln_number: "K1", planned_output_quantity: plannedOutput,
      }).select("id").single();
    return pb!.id as string;
  }

  test("golden path: start consumes raw materials proportionally and rolls up cost, output batch is pending_qc and unsellable, QC pass makes it in_stock and sellable", async () => {
    const suffix = `${Date.now()}-GOLDEN`;
    await receiveClay(suffix, 1000, 2);
    await addGlazeBatch(suffix, 50, 5);

    const pbId = await createDraftBatch(suffix, 10);
    const { error: startErr } = await owner.client.rpc("start_production_batch", { p_production_batch_id: pbId });
    expect(startErr).toBeNull();

    const { data: afterStart } = await owner.client.from("production_batches").select("status, raw_material_cost").eq("id", pbId).single();
    expect(afterStart?.status).toBe("in_progress");
    // 200kg clay * $2 + 20kg glaze * $5 = 500
    expect(Number(afterStart?.raw_material_cost)).toBeCloseTo(500, 4);

    const { data: clayStock } = await owner.client.from("inventory_stock").select("qty_on_hand").eq("product_id", clayProductId).single();
    expect(Number(clayStock?.qty_on_hand)).toBeCloseTo(800, 4); // 1000 - 200

    const { error: completeErr, data: outputBatchId } = await owner.client.rpc("complete_production_batch", {
      p_production_batch_id: pbId, p_actual_output_quantity: 10, p_output_location_id: locationAId,
      p_shade_code: "A-Grade", p_caliber_code: "C1", p_labor_cost: 50, p_overhead_cost: 20,
    });
    expect(completeErr).toBeNull();

    const { data: outputBatch } = await owner.client.from("inventory_batches").select("status, cost_per_uom, qty_on_hand").eq("id", outputBatchId!).single();
    expect(outputBatch?.status).toBe("pending_qc");
    expect(Number(outputBatch?.cost_per_uom)).toBeCloseTo((500 + 50 + 20) / 10, 4); // 57.0

    // Unsellable while pending QC: confirm_sales_order must not find any stock.
    const { data: customer } = await owner.client.from("customers").insert({ tenant_id: tenantId, code: `CUST-${suffix}`, name: "Test Customer" }).select("id").single();
    const { data: so } = await owner.client
      .from("sales_orders").insert({ tenant_id: tenantId, branch_id: branchAId, customer_id: customer!.id, warehouse_id: warehouseAId, so_number: `SO-${suffix}`, status: "draft" }).select("id").single();
    await owner.client.from("sales_order_lines").insert({ tenant_id: tenantId, sales_order_id: so!.id, product_id: tileProductId, quantity: 5, uom_id: sqmUomId, unit_price: 100 });
    const { error: preQcErr } = await owner.client.rpc("confirm_sales_order", { p_sales_order_id: so!.id });
    expect(preQcErr?.message).toMatch(/Insufficient available stock|available stock/i);

    // QC pass flips it to in_stock and it becomes sellable.
    const { error: qcErr } = await owner.client.rpc("record_batch_qc_inspection", {
      p_inventory_batch_id: outputBatchId!, p_outcome: "passed", p_confirmed_grade: "A-Grade",
    });
    expect(qcErr).toBeNull();
    const { data: passedBatch } = await owner.client.from("inventory_batches").select("status").eq("id", outputBatchId!).single();
    expect(passedBatch?.status).toBe("in_stock");

    const { error: postQcErr } = await owner.client.rpc("confirm_sales_order", { p_sales_order_id: so!.id });
    expect(postQcErr).toBeNull();
    const { data: reservedBatch } = await owner.client.from("inventory_batches").select("reserved_qty, status").eq("id", outputBatchId!).single();
    expect(Number(reservedBatch?.reserved_qty)).toBeCloseTo(5, 4);
    expect(reservedBatch?.status).toBe("in_stock");
  });

  test("QC reject: batch is permanently excluded from available stock", async () => {
    const suffix = `${Date.now()}-REJECT`;
    await receiveClay(suffix, 200, 2);
    await addGlazeBatch(suffix, 10, 5);

    const pbId = await createDraftBatch(suffix, 5);
    await owner.client.rpc("start_production_batch", { p_production_batch_id: pbId });
    const { data: outputBatchId } = await owner.client.rpc("complete_production_batch", {
      p_production_batch_id: pbId, p_actual_output_quantity: 5, p_output_location_id: locationAId,
    });

    const { error: qcErr } = await owner.client.rpc("record_batch_qc_inspection", {
      p_inventory_batch_id: outputBatchId!, p_outcome: "rejected", p_defects: "Cracked tiles", p_notes: "Kiln temp too high",
    });
    expect(qcErr).toBeNull();

    const { data: rejectedBatch } = await owner.client.from("inventory_batches").select("status, qty_on_hand").eq("id", outputBatchId!).single();
    expect(rejectedBatch?.status).toBe("rejected");
    expect(Number(rejectedBatch?.qty_on_hand)).toBeCloseTo(5, 4); // quantity/cost preserved, just unsellable

    const { data: available } = await owner.client
      .from("inventory_batches").select("qty_on_hand, reserved_qty").eq("product_id", tileProductId).eq("status", "in_stock");
    const total = (available ?? []).reduce((sum, b) => sum + (Number(b.qty_on_hand) - Number(b.reserved_qty)), 0);
    expect(total).toBeCloseTo(0, 4);
  });

  test("cancel_production_batch: draft releases nothing, in_progress does not restore consumed materials", async () => {
    const suffix = `${Date.now()}-CANCEL`;
    await receiveClay(suffix, 500, 2);
    await addGlazeBatch(suffix, 50, 5);

    const draftId = await createDraftBatch(suffix, 5);
    const { error: cancelDraftErr } = await owner.client.rpc("cancel_production_batch", { p_production_batch_id: draftId });
    expect(cancelDraftErr).toBeNull();
    const { data: cancelledDraft } = await owner.client.from("production_batches").select("status").eq("id", draftId).single();
    expect(cancelledDraft?.status).toBe("cancelled");

    const inProgressId = await createDraftBatch(`${suffix}-IP`, 5);
    await owner.client.rpc("start_production_batch", { p_production_batch_id: inProgressId });
    const { data: clayBefore } = await owner.client.from("inventory_stock").select("qty_on_hand").eq("product_id", clayProductId).single();

    const { error: cancelIpErr } = await owner.client.rpc("cancel_production_batch", { p_production_batch_id: inProgressId });
    expect(cancelIpErr).toBeNull();
    const { data: cancelledIp } = await owner.client.from("production_batches").select("status").eq("id", inProgressId).single();
    expect(cancelledIp?.status).toBe("cancelled");

    const { data: clayAfter } = await owner.client.from("inventory_stock").select("qty_on_hand").eq("product_id", clayProductId).single();
    expect(Number(clayAfter?.qty_on_hand)).toBeCloseTo(Number(clayBefore?.qty_on_hand), 4); // no restoration
  });

  test("rejection paths: inactive BOM, insufficient stock, unit-tracked raw material, wrong-warehouse output, non-batch-tracked finished product", async () => {
    const suffix = `${Date.now()}-REJ`;
    await receiveClay(suffix, 1000, 2);
    await addGlazeBatch(suffix, 50, 5);

    // Inactive BOM.
    await adminClient().from("bill_of_materials").update({ is_active: false }).eq("id", bomId);
    const inactiveId = await createDraftBatch(`${suffix}-INACTIVE`, 5);
    const { error: inactiveErr } = await owner.client.rpc("start_production_batch", { p_production_batch_id: inactiveId });
    expect(inactiveErr?.message).toMatch(/not active/);
    await adminClient().from("bill_of_materials").update({ is_active: true }).eq("id", bomId);

    // Insufficient raw-material stock.
    const shortId = await createDraftBatch(`${suffix}-SHORT`, 10000);
    const { error: shortErr } = await owner.client.rpc("start_production_batch", { p_production_batch_id: shortId });
    expect(shortErr?.message).toMatch(/Insufficient available stock/);

    // Unit-tracked raw material.
    const { data: unitProduct } = await owner.client
      .from("products").insert({ tenant_id: tenantId, sku: `SLAB-${suffix}`, name: "Test Slab", inventory_tracking_mode: "unit", base_uom_id: kgUomId }).select("id").single();
    const { data: unitBom } = await owner.client
      .from("bill_of_materials").insert({ tenant_id: tenantId, product_id: tileProductId, bom_number: `BOM-UNIT-${suffix}`, output_quantity: 10, output_uom_id: sqmUomId, is_active: true }).select("id").single();
    await owner.client.from("bill_of_materials_lines").insert({ tenant_id: tenantId, bom_id: unitBom!.id, raw_material_product_id: unitProduct!.id, quantity: 1, uom_id: kgUomId });
    const unitBatchId = await createDraftBatch(`${suffix}-UNIT`, 1, unitBom!.id);
    const { error: unitErr } = await owner.client.rpc("start_production_batch", { p_production_batch_id: unitBatchId });
    expect(unitErr?.message).toMatch(/Unit-tracked products cannot be used/);

    // Non-batch-tracked finished product.
    const { data: simpleBom } = await owner.client
      .from("bill_of_materials").insert({ tenant_id: tenantId, product_id: clayProductId, bom_number: `BOM-SIMPLE-${suffix}`, output_quantity: 10, output_uom_id: kgUomId, is_active: true }).select("id").single();
    await owner.client.from("bill_of_materials_lines").insert({ tenant_id: tenantId, bom_id: simpleBom!.id, raw_material_product_id: glazeProductId, quantity: 1, uom_id: kgUomId });
    const simpleBatchId = await createDraftBatch(`${suffix}-SIMPLE`, 1, simpleBom!.id);
    await owner.client.rpc("start_production_batch", { p_production_batch_id: simpleBatchId });
    const { error: simpleErr } = await owner.client.rpc("complete_production_batch", { p_production_batch_id: simpleBatchId, p_actual_output_quantity: 1, p_output_location_id: locationAId });
    expect(simpleErr?.message).toMatch(/must be batch-tracked/);

    // Wrong-warehouse output location.
    const { data: warehouseB } = await owner.client
      .from("warehouses").insert({ tenant_id: tenantId, branch_id: branchAId, code: `WB-${suffix}`, name: "Warehouse B" }).select("id").single();
    const { data: locationB } = await owner.client
      .from("storage_locations").insert({ tenant_id: tenantId, warehouse_id: warehouseB!.id, location_type: "zone", code: `Z-${suffix}`, name: "Zone B" }).select("id").single();
    const wrongWhId = await createDraftBatch(`${suffix}-WRONGWH`, 5);
    await owner.client.rpc("start_production_batch", { p_production_batch_id: wrongWhId });
    const { error: wrongWhErr } = await owner.client.rpc("complete_production_batch", { p_production_batch_id: wrongWhId, p_actual_output_quantity: 5, p_output_location_id: locationB!.id });
    expect(wrongWhErr?.message).toMatch(/within this production batch's warehouse/);
  });

  test("branch scoping: a Branch-B-scoped owner cannot start, complete, cancel, or QC-inspect a Branch-A production batch", async () => {
    const suffix = `${Date.now()}-BRANCH`;
    await receiveClay(suffix, 500, 2);
    await addGlazeBatch(suffix, 50, 5);

    const draftId = await createDraftBatch(suffix, 5);
    const { error: startErr } = await branchBUser.client.rpc("start_production_batch", { p_production_batch_id: draftId });
    expect(startErr?.message).toMatch(/do not have access to the branch/);

    const inProgressId = await createDraftBatch(`${suffix}-IP`, 5);
    await owner.client.rpc("start_production_batch", { p_production_batch_id: inProgressId });
    const { error: completeErr } = await branchBUser.client.rpc("complete_production_batch", { p_production_batch_id: inProgressId, p_actual_output_quantity: 5, p_output_location_id: locationAId });
    expect(completeErr?.message).toMatch(/do not have access to the branch/);

    const { error: cancelErr } = await branchBUser.client.rpc("cancel_production_batch", { p_production_batch_id: inProgressId });
    expect(cancelErr?.message).toMatch(/do not have access to the branch/);

    const { data: outputBatchId } = await owner.client.rpc("complete_production_batch", { p_production_batch_id: inProgressId, p_actual_output_quantity: 5, p_output_location_id: locationAId });
    const { error: qcErr } = await branchBUser.client.rpc("record_batch_qc_inspection", { p_inventory_batch_id: outputBatchId!, p_outcome: "passed" });
    expect(qcErr?.message).toMatch(/do not have access to the branch/);
  });

  test("permission denial: a Viewer cannot start, complete, cancel, or QC-inspect a production batch", async () => {
    const suffix = `${Date.now()}-PERM`;
    await receiveClay(suffix, 500, 2);
    await addGlazeBatch(suffix, 50, 5);

    const draftId = await createDraftBatch(suffix, 5);
    const { error: startErr } = await viewer.client.rpc("start_production_batch", { p_production_batch_id: draftId });
    expect(startErr?.message).toMatch(/Missing permission: production.edit/);

    const inProgressId = await createDraftBatch(`${suffix}-IP`, 5);
    await owner.client.rpc("start_production_batch", { p_production_batch_id: inProgressId });
    const { error: completeErr } = await viewer.client.rpc("complete_production_batch", { p_production_batch_id: inProgressId, p_actual_output_quantity: 5, p_output_location_id: locationAId });
    expect(completeErr?.message).toMatch(/Missing permission: production.edit/);

    const { error: cancelErr } = await viewer.client.rpc("cancel_production_batch", { p_production_batch_id: inProgressId });
    expect(cancelErr?.message).toMatch(/Missing permission: production.edit/);

    const { data: outputBatchId } = await owner.client.rpc("complete_production_batch", { p_production_batch_id: inProgressId, p_actual_output_quantity: 5, p_output_location_id: locationAId });
    const { error: qcErr } = await viewer.client.rpc("record_batch_qc_inspection", { p_inventory_batch_id: outputBatchId!, p_outcome: "passed" });
    expect(qcErr?.message).toMatch(/Missing permission: production.approve/);
  });

  test("capability gate: start, complete, and QC-inspect are blocked without tile_manufacturing enabled; cancel is not", async () => {
    const suffix = `${Date.now()}-CAP`;
    await receiveClay(suffix, 1000, 2);
    await addGlazeBatch(suffix, 50, 5);

    const admin = adminClient();
    const { data: capability } = await admin.from("business_capabilities").select("id").eq("code", "tile_manufacturing").single();

    // Start (and complete) a batch to in_progress state while the capability
    // is still enabled, so complete/QC-inspect's own gates can be tested.
    const readyId = await createDraftBatch(`${suffix}-READY`, 5);
    await owner.client.rpc("start_production_batch", { p_production_batch_id: readyId });

    await admin.from("tenant_capabilities").delete().eq("tenant_id", tenantId).eq("capability_id", capability!.id);

    const draftId = await createDraftBatch(suffix, 5);
    const { error: startErr } = await owner.client.rpc("start_production_batch", { p_production_batch_id: draftId });
    expect(startErr?.message).toMatch(/Tile Manufacturing capability is not enabled/);

    const { error: completeErr } = await owner.client.rpc("complete_production_batch", { p_production_batch_id: readyId, p_actual_output_quantity: 5, p_output_location_id: locationAId });
    expect(completeErr?.message).toMatch(/Tile Manufacturing capability is not enabled/);

    const { error: cancelErr } = await owner.client.rpc("cancel_production_batch", { p_production_batch_id: draftId });
    expect(cancelErr).toBeNull(); // deliberately not capability-gated, matching cancel_processing_job precedent

    // Re-enable to complete the ready batch and prove QC-inspect's gate too.
    await admin.from("tenant_capabilities").insert({ tenant_id: tenantId, capability_id: capability!.id, enabled_by: owner.userId });
    const { data: outputBatchId } = await owner.client.rpc("complete_production_batch", { p_production_batch_id: readyId, p_actual_output_quantity: 5, p_output_location_id: locationAId });

    await admin.from("tenant_capabilities").delete().eq("tenant_id", tenantId).eq("capability_id", capability!.id);
    const { error: qcErr } = await owner.client.rpc("record_batch_qc_inspection", { p_inventory_batch_id: outputBatchId!, p_outcome: "passed" });
    expect(qcErr?.message).toMatch(/Tile Manufacturing capability is not enabled/);

    await admin.from("tenant_capabilities").insert({ tenant_id: tenantId, capability_id: capability!.id, enabled_by: owner.userId });
  });
});
