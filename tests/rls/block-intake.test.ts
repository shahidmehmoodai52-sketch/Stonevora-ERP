import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { adminClient, createSignedInTestUser, deleteTestUser, hasServiceRoleKey } from "./helpers";

// Automated version of the live-database verification performed while
// building Factory Milestone 1 (Raw Block Intake). Requires
// SUPABASE_SERVICE_ROLE_KEY (test setup only, see tests/rls/helpers.ts).
describe.skipIf(!hasServiceRoleKey)("Factory Milestone 1: Raw Block Intake", () => {
  let owner: { userId: string; client: ReturnType<typeof adminClient> };
  let tenantId: string;
  let branchId: string;
  let warehouseId: string;
  let supplierId: string;
  let productId: string;
  let blockUomId: string;
  let cmUomId: string;
  let cftUomId: string;

  beforeAll(async () => {
    const suffix = Date.now();
    owner = await createSignedInTestUser(`bi-owner-${suffix}@stonevora.test`, "test-password-123");

    const { data: tId } = await owner.client.rpc("create_tenant_for_user", {
      p_tenant_name: `Block Intake Test ${suffix}`,
      p_tenant_slug: `block-intake-test-${suffix}`,
    });
    tenantId = tId!;

    const admin = adminClient();
    const { data: block } = await admin.from("uom").select("id").eq("code", "BLOCK").is("tenant_id", null).single();
    const { data: cm } = await admin.from("uom").select("id").eq("code", "CM").is("tenant_id", null).single();
    const { data: cft } = await admin.from("uom").select("id").eq("code", "CFT").is("tenant_id", null).single();
    blockUomId = block!.id;
    cmUomId = cm!.id;
    cftUomId = cft!.id;

    const { data: branch } = await owner.client
      .from("branches").insert({ tenant_id: tenantId, code: "HO", name: "Head Office", is_head_office: true }).select("id").single();
    branchId = branch!.id;
    const { data: warehouse } = await owner.client
      .from("warehouses").insert({ tenant_id: tenantId, branch_id: branchId, code: "YARD", name: "Yard" }).select("id").single();
    warehouseId = warehouse!.id;
    const { data: supplier } = await owner.client
      .from("suppliers").insert({ tenant_id: tenantId, code: "QUARRY1", name: "Test Quarry" }).select("id").single();
    supplierId = supplier!.id;

    const { data: product } = await owner.client
      .from("products")
      .insert({ tenant_id: tenantId, sku: "BLK-01", name: "Test Block", inventory_tracking_mode: "unit", base_uom_id: blockUomId })
      .select("id").single();
    productId = product!.id;
  });

  afterAll(async () => {
    const admin = adminClient();
    await admin.from("tenants").delete().eq("id", tenantId);
    await deleteTestUser(owner.userId);
  });

  async function makeGrnLine(overrides: Partial<{
    quantity: number; unitCode: string; length: number; width: number; height: number;
    dimensionUomId: string | null; volumeUomId: string | null; freight: number;
  }> = {}) {
    const suffix = Date.now() + Math.random();
    const { data: po } = await owner.client
      .from("purchase_orders")
      .insert({ tenant_id: tenantId, branch_id: branchId, supplier_id: supplierId, po_number: `PO-${suffix}`, status: "confirmed" })
      .select("id").single();
    const { data: poLine } = await owner.client
      .from("purchase_order_lines")
      .insert({ tenant_id: tenantId, purchase_order_id: po!.id, product_id: productId, quantity: overrides.quantity ?? 1, uom_id: blockUomId, unit_price: 50000 })
      .select("id").single();
    const { data: grn } = await owner.client
      .from("goods_receipts")
      .insert({ tenant_id: tenantId, branch_id: branchId, warehouse_id: warehouseId, purchase_order_id: po!.id, grn_number: `GRN-${suffix}`, freight_cost: overrides.freight ?? 0, landed_cost_basis: "value" })
      .select("id").single();
    await owner.client.from("goods_receipt_lines").insert({
      tenant_id: tenantId, goods_receipt_id: grn!.id, purchase_order_line_id: poLine!.id,
      product_id: productId, quantity: overrides.quantity ?? 1, uom_id: blockUomId, unit_cost: 50000,
      unit_code: overrides.unitCode ?? `BLK-${suffix}`,
      dimension_length: overrides.length ?? 200, dimension_width: overrides.width ?? 150, dimension_height: overrides.height ?? 180,
      dimension_uom_id: overrides.dimensionUomId === null ? null : overrides.dimensionUomId ?? cmUomId,
      volume_uom_id: overrides.volumeUomId === null ? null : overrides.volumeUomId ?? cftUomId,
      quarry_source: "Test Quarry Source", unit_quality_grade: "A",
    });
    return grn!.id;
  }

  test("rejects block intake when block_slab_factory capability is not enabled", async () => {
    const grnId = await makeGrnLine();
    const { error } = await owner.client.rpc("post_goods_receipt", { p_goods_receipt_id: grnId });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/Block\/Slab Factory capability is not enabled/);
  });

  test("full block intake: correct volume, preserved historical cost, capability-gated", async () => {
    const admin = adminClient();
    const { data: capability } = await admin.from("business_capabilities").select("id").eq("code", "block_slab_factory").single();
    await admin.from("tenant_capabilities").insert({ tenant_id: tenantId, capability_id: capability!.id });

    const grnId = await makeGrnLine({ length: 200, width: 150, height: 180, freight: 5000 });
    const { error } = await owner.client.rpc("post_goods_receipt", { p_goods_receipt_id: grnId });
    expect(error).toBeNull();

    const { data: grn } = await owner.client.from("goods_receipts").select("id").eq("id", grnId).single();
    const { data: line } = await owner.client.from("goods_receipt_lines").select("*").eq("goods_receipt_id", grn!.id).single();
    const { data: unit } = await owner.client.from("inventory_units").select("*").eq("goods_receipt_line_id", line!.id).single();

    // 200cm * 150cm * 180cm = 5,400,000 cm3; / 28316.846592 cm3 per cubic foot.
    expect(Number(unit?.volume)).toBeCloseTo(5400000 / 28316.846592, 4);
    expect(unit?.cost).toBe("55000.0000"); // 50000 purchase + 5000 freight, fully allocated (one line)
    expect(unit?.unit_type).toBe("block");
    expect(unit?.status).toBe("in_stock");
    expect(unit?.supplier_id).toBe(supplierId);
    // Original purchase cost preserved untouched, separate from the landed total.
    expect(line?.unit_cost).toBe("50000.0000");
    expect(line?.total_unit_cost).toBe("55000.0000");
  });

  test("rejects a unit-tracked GRN line with quantity != 1", async () => {
    const grnId = await makeGrnLine({ quantity: 2 });
    const { error } = await owner.client.rpc("post_goods_receipt", { p_goods_receipt_id: grnId });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/quantity = 1/);
  });

  test("rejects block intake missing required dimension fields", async () => {
    const grnId = await makeGrnLine({ dimensionUomId: null });
    const { error } = await owner.client.rpc("post_goods_receipt", { p_goods_receipt_id: grnId });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/requires unit_code/);
  });
});
