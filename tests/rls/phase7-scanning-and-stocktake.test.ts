import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { adminClient, createSignedInTestUser, deleteTestUser, hasServiceRoleKey } from "./helpers";

// Automated version of the live-database verification performed while
// building Phase 7 (QR/Mobile/barcode: stocktake, barcode/QR generator,
// scan-code resolver). Requires SUPABASE_SERVICE_ROLE_KEY (test setup
// only, see tests/rls/helpers.ts).
describe.skipIf(!hasServiceRoleKey)("Phase 7: Scanning and Stocktake", () => {
  let owner: { userId: string; client: ReturnType<typeof adminClient> };
  let branchBUser: { userId: string; client: ReturnType<typeof adminClient> };
  let viewer: { userId: string; client: ReturnType<typeof adminClient> };
  let tenantId: string;
  let branchAId: string;
  let branchBId: string;
  let warehouseAId: string;
  let locationAId: string;
  let pcsUomId: string;
  let simpleProductId: string;
  let batchProductId: string;
  let unitProductId: string;
  let simpleStockId: string;
  let batchId: string;
  let unitId: string;

  beforeAll(async () => {
    const suffix = Date.now();
    owner = await createSignedInTestUser(`p7-owner-${suffix}@stonevora.test`, "test-password-123");
    branchBUser = await createSignedInTestUser(`p7-branchb-${suffix}@stonevora.test`, "test-password-123");
    viewer = await createSignedInTestUser(`p7-viewer-${suffix}@stonevora.test`, "test-password-123");

    const { data: tId } = await owner.client.rpc("create_tenant_for_user", {
      p_tenant_name: `Phase7 Test ${suffix}`,
      p_tenant_slug: `phase7-test-${suffix}`,
    });
    tenantId = tId!;

    const admin = adminClient();
    const { data: pcsUom } = await admin.from("uom").select("id").eq("code", "PCS").is("tenant_id", null).single();
    pcsUomId = pcsUom!.id;

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

    const { data: simpleProduct } = await owner.client
      .from("products").insert({ tenant_id: tenantId, sku: "TILE-SIMPLE-01", name: "Simple Tile", inventory_tracking_mode: "simple", base_uom_id: pcsUomId }).select("id").single();
    simpleProductId = simpleProduct!.id;
    const { data: batchProduct } = await owner.client
      .from("products").insert({ tenant_id: tenantId, sku: "TILE-BATCH-01", name: "Batch Tile", inventory_tracking_mode: "batch", base_uom_id: pcsUomId }).select("id").single();
    batchProductId = batchProduct!.id;
    const { data: unitProduct } = await owner.client
      .from("products").insert({ tenant_id: tenantId, sku: "SLAB-UNIT-01", name: "Granite Slab", inventory_tracking_mode: "unit", base_uom_id: pcsUomId }).select("id").single();
    unitProductId = unitProduct!.id;

    const { data: stock } = await admin.from("inventory_stock").insert({ tenant_id: tenantId, product_id: simpleProductId, location_id: locationAId, qty_on_hand: 100, avg_cost: 10, uom_id: pcsUomId }).select("id").single();
    simpleStockId = stock!.id;
    const { data: batch } = await admin.from("inventory_batches").insert({ tenant_id: tenantId, product_id: batchProductId, batch_number: "BATCH-01", qty_on_hand: 50, uom_id: pcsUomId, current_location_id: locationAId, cost_per_uom: 20, status: "in_stock" }).select("id").single();
    batchId = batch!.id;
    const { data: unit } = await admin.from("inventory_units").insert({ tenant_id: tenantId, product_id: unitProductId, unit_code: "SLAB-001", status: "in_stock", current_location_id: locationAId }).select("id").single();
    unitId = unit!.id;

    const { data: viewerRole } = await admin.from("roles").select("id").eq("tenant_id", tenantId).eq("code", "viewer").single();
    const { data: ownerRole } = await admin.from("roles").select("id").eq("tenant_id", tenantId).eq("code", "owner").single();
    await admin.from("user_tenants").insert([
      { user_id: branchBUser.userId, tenant_id: tenantId },
      { user_id: viewer.userId, tenant_id: tenantId },
    ]);
    await admin.from("user_roles").insert([
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

  function isValidEan13(code: string): boolean {
    if (!/^\d{13}$/.test(code)) return false;
    const digits = code.split("").map(Number);
    const sum = digits.slice(0, 12).reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0);
    const check = (10 - (sum % 10)) % 10;
    return check === digits[12];
  }

  async function createDraftStocktake(suffix: string) {
    const { data } = await owner.client
      .from("stocktakes").insert({ tenant_id: tenantId, branch_id: branchAId, warehouse_id: warehouseAId, stocktake_number: `ST-${suffix}`, status: "draft" }).select("id").single();
    return data!.id as string;
  }

  test("generate_product_barcode assigns a valid, checksum-correct EAN-13 code, mirrors it into qr_code_value, and is idempotent", async () => {
    const { data: code, error } = await owner.client.rpc("generate_product_barcode", { p_product_id: simpleProductId });
    expect(error).toBeNull();
    expect(isValidEan13(code!)).toBe(true);

    const { data: product } = await owner.client.from("products").select("barcode, qr_code_value").eq("id", simpleProductId).single();
    expect(product?.barcode).toBe(code);
    expect(product?.qr_code_value).toBe(code);

    const { data: codeAgain } = await owner.client.rpc("generate_product_barcode", { p_product_id: simpleProductId });
    expect(codeAgain).toBe(code); // idempotent, never overwrites
  });

  test("generate_inventory_unit_qr_code assigns a valid checksum QR code and is idempotent", async () => {
    const { data: code, error } = await owner.client.rpc("generate_inventory_unit_qr_code", { p_inventory_unit_id: unitId });
    expect(error).toBeNull();
    expect(isValidEan13(code!)).toBe(true);

    const { data: codeAgain } = await owner.client.rpc("generate_inventory_unit_qr_code", { p_inventory_unit_id: unitId });
    expect(codeAgain).toBe(code);
  });

  test("resolve_scanned_code finds a product by SKU/barcode, a batch by batch_number, a unit by unit_code, a location by code, and nothing for a garbage code", async () => {
    const { data: bySku } = await owner.client.rpc("resolve_scanned_code", { p_tenant_id: tenantId, p_code: "TILE-SIMPLE-01" });
    expect(bySku?.[0]?.match_type).toBe("product");
    expect(bySku?.[0]?.id).toBe(simpleProductId);

    const { data: byBatch } = await owner.client.rpc("resolve_scanned_code", { p_tenant_id: tenantId, p_code: "BATCH-01" });
    expect(byBatch?.[0]?.match_type).toBe("inventory_batch");
    expect(byBatch?.[0]?.id).toBe(batchId);

    const { data: byUnit } = await owner.client.rpc("resolve_scanned_code", { p_tenant_id: tenantId, p_code: "SLAB-001" });
    expect(byUnit?.[0]?.match_type).toBe("inventory_unit");
    expect(byUnit?.[0]?.id).toBe(unitId);

    const { data: byLocation } = await owner.client.rpc("resolve_scanned_code", { p_tenant_id: tenantId, p_code: "Z1" });
    expect(byLocation?.[0]?.match_type).toBe("storage_location");
    expect(byLocation?.[0]?.id).toBe(locationAId);

    const { data: noMatch } = await owner.client.rpc("resolve_scanned_code", { p_tenant_id: tenantId, p_code: "NOTHING-MATCHES-THIS" });
    expect(noMatch).toHaveLength(0);
  });

  test("golden path: a stocktake with variances in both directions posts exactly one stock_adjustment via the existing engine and corrects inventory correctly", async () => {
    const suffix = `${Date.now()}-GOLDEN`;
    const stocktakeId = await createDraftStocktake(suffix);

    const { data: simpleLine } = await owner.client
      .from("stocktake_lines").insert({ tenant_id: tenantId, stocktake_id: stocktakeId, product_id: simpleProductId, location_id: locationAId, uom_id: pcsUomId }).select("id").single();
    const { data: batchLine } = await owner.client
      .from("stocktake_lines").insert({ tenant_id: tenantId, stocktake_id: stocktakeId, product_id: batchProductId, batch_id: batchId, uom_id: pcsUomId }).select("id").single();

    const { error: startErr } = await owner.client.rpc("start_stocktake_count", { p_stocktake_id: stocktakeId });
    expect(startErr).toBeNull();

    const { data: lines } = await owner.client.from("stocktake_lines").select("id, system_quantity").eq("stocktake_id", stocktakeId);
    expect(lines?.find((l) => l.id === simpleLine!.id)?.system_quantity).toBe("100.0000");
    expect(lines?.find((l) => l.id === batchLine!.id)?.system_quantity).toBe("50.0000");

    await owner.client.rpc("record_stocktake_count", { p_stocktake_line_id: simpleLine!.id, p_counted_quantity: 95 }); // shrinkage of 5
    await owner.client.rpc("record_stocktake_count", { p_stocktake_line_id: batchLine!.id, p_counted_quantity: 52 }); // found 2 extra

    const { data: adjustmentId, error: postErr } = await owner.client.rpc("post_stocktake", { p_stocktake_id: stocktakeId });
    expect(postErr).toBeNull();
    expect(adjustmentId).not.toBeNull();

    const { data: adjustment } = await owner.client.from("stock_adjustments").select("status, reason_code, adjustment_number").eq("id", adjustmentId!).single();
    expect(adjustment?.status).toBe("posted");
    expect(adjustment?.reason_code).toBe("count_correction");
    expect(adjustment?.adjustment_number).toBe(`STK-ST-${suffix}`);

    const { data: simpleStock } = await owner.client.from("inventory_stock").select("qty_on_hand").eq("id", simpleStockId).single();
    expect(Number(simpleStock?.qty_on_hand)).toBeCloseTo(95, 4);
    const { data: batchAfter } = await owner.client.from("inventory_batches").select("qty_on_hand").eq("id", batchId).single();
    expect(Number(batchAfter?.qty_on_hand)).toBeCloseTo(52, 4);

    const { data: stocktake } = await owner.client.from("stocktakes").select("status, stock_adjustment_id").eq("id", stocktakeId).single();
    expect(stocktake?.status).toBe("posted");
    expect(stocktake?.stock_adjustment_id).toBe(adjustmentId);
  });

  test("a perfect count (no variance) posts without creating any stock_adjustment", async () => {
    const suffix = `${Date.now()}-PERFECT`;
    const stocktakeId = await createDraftStocktake(suffix);
    const { data: line } = await owner.client
      .from("stocktake_lines").insert({ tenant_id: tenantId, stocktake_id: stocktakeId, product_id: simpleProductId, location_id: locationAId, uom_id: pcsUomId }).select("id").single();

    await owner.client.rpc("start_stocktake_count", { p_stocktake_id: stocktakeId });
    const { data: lineAfterStart } = await owner.client.from("stocktake_lines").select("system_quantity").eq("id", line!.id).single();
    await owner.client.rpc("record_stocktake_count", { p_stocktake_line_id: line!.id, p_counted_quantity: Number(lineAfterStart?.system_quantity) });

    const { data: adjustmentId, error } = await owner.client.rpc("post_stocktake", { p_stocktake_id: stocktakeId });
    expect(error).toBeNull();
    expect(adjustmentId).toBeNull();
  });

  test("cancel_stocktake works from draft and counting, but not from posted", async () => {
    const draftId = await createDraftStocktake(`${Date.now()}-CANCEL-DRAFT`);
    const { error: cancelDraftErr } = await owner.client.rpc("cancel_stocktake", { p_stocktake_id: draftId });
    expect(cancelDraftErr).toBeNull();

    const countingId = await createDraftStocktake(`${Date.now()}-CANCEL-COUNTING`);
    await owner.client.from("stocktake_lines").insert({ tenant_id: tenantId, stocktake_id: countingId, product_id: simpleProductId, location_id: locationAId, uom_id: pcsUomId });
    await owner.client.rpc("start_stocktake_count", { p_stocktake_id: countingId });
    const { error: cancelCountingErr } = await owner.client.rpc("cancel_stocktake", { p_stocktake_id: countingId });
    expect(cancelCountingErr).toBeNull();

    const postedId = await createDraftStocktake(`${Date.now()}-CANCEL-POSTED`);
    const { data: postedLine } = await owner.client.from("stocktake_lines").insert({ tenant_id: tenantId, stocktake_id: postedId, product_id: simpleProductId, location_id: locationAId, uom_id: pcsUomId }).select("id").single();
    await owner.client.rpc("start_stocktake_count", { p_stocktake_id: postedId });
    await owner.client.rpc("record_stocktake_count", { p_stocktake_line_id: postedLine!.id, p_counted_quantity: 95 });
    await owner.client.rpc("post_stocktake", { p_stocktake_id: postedId });
    const { error: cancelPostedErr } = await owner.client.rpc("cancel_stocktake", { p_stocktake_id: postedId });
    expect(cancelPostedErr?.message).toMatch(/can be cancelled/);
  });

  test("rejection paths: empty stocktake, unit-tracked product, negative count, uncounted lines at post, wrong status", async () => {
    const suffix = `${Date.now()}-REJ`;

    const emptyId = await createDraftStocktake(`${suffix}-EMPTY`);
    const { error: emptyErr } = await owner.client.rpc("start_stocktake_count", { p_stocktake_id: emptyId });
    expect(emptyErr?.message).toMatch(/at least one line/);

    const unitTrackedId = await createDraftStocktake(`${suffix}-UNIT`);
    await owner.client.from("stocktake_lines").insert({ tenant_id: tenantId, stocktake_id: unitTrackedId, product_id: unitProductId, location_id: locationAId, uom_id: pcsUomId });
    const { error: unitErr } = await owner.client.rpc("start_stocktake_count", { p_stocktake_id: unitTrackedId });
    expect(unitErr?.message).toMatch(/not countable through this workflow/);

    const negId = await createDraftStocktake(`${suffix}-NEG`);
    const { data: negLine } = await owner.client.from("stocktake_lines").insert({ tenant_id: tenantId, stocktake_id: negId, product_id: simpleProductId, location_id: locationAId, uom_id: pcsUomId }).select("id").single();
    await owner.client.rpc("start_stocktake_count", { p_stocktake_id: negId });
    const { error: negErr } = await owner.client.rpc("record_stocktake_count", { p_stocktake_line_id: negLine!.id, p_counted_quantity: -5 });
    expect(negErr?.message).toMatch(/must be zero or greater/);

    const { error: uncountedErr } = await owner.client.rpc("post_stocktake", { p_stocktake_id: negId });
    expect(uncountedErr?.message).toMatch(/still uncounted/);

    const { error: startTwiceErr } = await owner.client.rpc("start_stocktake_count", { p_stocktake_id: negId });
    expect(startTwiceErr?.message).toMatch(/not in draft status/);

    const { error: postDraftErr } = await owner.client.rpc("post_stocktake", { p_stocktake_id: emptyId });
    expect(postDraftErr?.message).toMatch(/not in counting status/);
  });

  test("branch scoping: a Branch-B-scoped owner cannot start, record, post, or cancel a Branch-A stocktake", async () => {
    const suffix = `${Date.now()}-BRANCH`;
    const stocktakeId = await createDraftStocktake(suffix);
    const { data: line } = await owner.client.from("stocktake_lines").insert({ tenant_id: tenantId, stocktake_id: stocktakeId, product_id: simpleProductId, location_id: locationAId, uom_id: pcsUomId }).select("id").single();

    const { error: startErr } = await branchBUser.client.rpc("start_stocktake_count", { p_stocktake_id: stocktakeId });
    expect(startErr?.message).toMatch(/do not have access to the branch/);

    await owner.client.rpc("start_stocktake_count", { p_stocktake_id: stocktakeId });
    const { error: recordErr } = await branchBUser.client.rpc("record_stocktake_count", { p_stocktake_line_id: line!.id, p_counted_quantity: 90 });
    expect(recordErr?.message).toMatch(/do not have access to the branch/);

    const { error: postErr } = await branchBUser.client.rpc("post_stocktake", { p_stocktake_id: stocktakeId });
    expect(postErr?.message).toMatch(/do not have access to the branch/);

    const { error: cancelErr } = await branchBUser.client.rpc("cancel_stocktake", { p_stocktake_id: stocktakeId });
    expect(cancelErr?.message).toMatch(/do not have access to the branch/);
  });

  test("permission denial: a Viewer cannot start, record, post, cancel, or generate codes, but can still resolve a scanned code", async () => {
    const suffix = `${Date.now()}-PERM`;
    const stocktakeId = await createDraftStocktake(suffix);
    const { data: line } = await owner.client.from("stocktake_lines").insert({ tenant_id: tenantId, stocktake_id: stocktakeId, product_id: simpleProductId, location_id: locationAId, uom_id: pcsUomId }).select("id").single();

    const { error: startErr } = await viewer.client.rpc("start_stocktake_count", { p_stocktake_id: stocktakeId });
    expect(startErr?.message).toMatch(/Missing permission: warehouse.edit/);

    await owner.client.rpc("start_stocktake_count", { p_stocktake_id: stocktakeId });
    const { error: recordErr } = await viewer.client.rpc("record_stocktake_count", { p_stocktake_line_id: line!.id, p_counted_quantity: 90 });
    expect(recordErr?.message).toMatch(/Missing permission: warehouse.edit/);

    const { error: postErr } = await viewer.client.rpc("post_stocktake", { p_stocktake_id: stocktakeId });
    expect(postErr?.message).toMatch(/Missing permission: warehouse.edit/);

    const { error: cancelErr } = await viewer.client.rpc("cancel_stocktake", { p_stocktake_id: stocktakeId });
    expect(cancelErr?.message).toMatch(/Missing permission: warehouse.edit/);

    const { error: barcodeErr } = await viewer.client.rpc("generate_product_barcode", { p_product_id: batchProductId });
    expect(barcodeErr?.message).toMatch(/Missing permission: product.edit/);

    const { error: qrErr } = await viewer.client.rpc("generate_inventory_unit_qr_code", { p_inventory_unit_id: unitId });
    expect(qrErr?.message).toMatch(/Missing permission: product.edit/);

    const { data: resolved, error: resolveErr } = await viewer.client.rpc("resolve_scanned_code", { p_tenant_id: tenantId, p_code: "TILE-SIMPLE-01" });
    expect(resolveErr).toBeNull();
    expect(resolved?.[0]?.id).toBe(simpleProductId);
  });

  test("regression: post_stock_adjustment still works for an ordinary, manually-created adjustment (not stocktake-driven)", async () => {
    const { data: adj } = await owner.client
      .from("stock_adjustments").insert({ tenant_id: tenantId, branch_id: branchAId, warehouse_id: warehouseAId, adjustment_number: `ADJ-${Date.now()}`, reason_code: "found" }).select("id").single();
    await owner.client.from("stock_adjustment_lines").insert({ tenant_id: tenantId, stock_adjustment_id: adj!.id, product_id: simpleProductId, quantity_change: 3, uom_id: pcsUomId, unit_cost: 10, location_id: locationAId });
    const { error } = await owner.client.rpc("post_stock_adjustment", { p_stock_adjustment_id: adj!.id });
    expect(error).toBeNull();
  });
});
