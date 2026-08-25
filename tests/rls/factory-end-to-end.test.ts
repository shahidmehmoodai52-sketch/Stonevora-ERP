import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { adminClient, createSignedInTestUser, deleteTestUser, hasServiceRoleKey } from "./helpers";

// Automated version of the Milestone 7 (End-to-End Verification) live-database
// walkthrough: the full Block/Slab Factory lifecycle in one continuous story
// -- real block intake through Milestone 1's actual Supplier -> PO -> GRN ->
// post_goods_receipt flow (not a manually inserted test block), Milestone 2
// processing, Milestone 3 slab/remnant output with genealogy, Milestone 4
// yield/waste, Milestone 5 QC (one pass, one reject), Milestone 6 cost
// roll-up, and a final traceability query chaining all the way from a
// sellable slab back to its supplier and quarry. The per-milestone test
// files (block-intake, processing-jobs, slab-output-genealogy,
// yield-waste-remnants, qc, cost-rollup) already cover each RPC's edge cases
// in isolation; this file is the composed, whole-chain story plus the
// capability gate re-verified at every stage. Requires
// SUPABASE_SERVICE_ROLE_KEY (test setup only, see tests/rls/helpers.ts).
describe.skipIf(!hasServiceRoleKey)("Factory Milestone 7: End-to-End Verification", () => {
  let owner: { userId: string; client: ReturnType<typeof adminClient> };
  let tenantId: string;
  let branchId: string;
  let warehouseId: string;
  let supplierId: string;
  let productId: string;
  let blockUomId: string;
  let cmUomId: string;
  let m3UomId: string;
  let sqftUomId: string;
  let sqmUomId: string;

  beforeAll(async () => {
    const suffix = Date.now();
    owner = await createSignedInTestUser(`e2e-owner-${suffix}@stonevora.test`, "test-password-123");

    const { data: tId } = await owner.client.rpc("create_tenant_for_user", {
      p_tenant_name: `E2E Factory Test ${suffix}`,
      p_tenant_slug: `e2e-factory-test-${suffix}`,
    });
    tenantId = tId!;

    const admin = adminClient();
    const { data: capability } = await admin.from("business_capabilities").select("id").eq("code", "block_slab_factory").single();
    await admin.from("tenant_capabilities").insert({ tenant_id: tenantId, capability_id: capability!.id });

    const { data: uoms } = await admin.from("uom").select("id, code").in("code", ["BLOCK", "CM", "M3", "SQFT", "SQM"]).is("tenant_id", null);
    blockUomId = uoms!.find((u) => u.code === "BLOCK")!.id;
    cmUomId = uoms!.find((u) => u.code === "CM")!.id;
    m3UomId = uoms!.find((u) => u.code === "M3")!.id;
    sqftUomId = uoms!.find((u) => u.code === "SQFT")!.id;
    sqmUomId = uoms!.find((u) => u.code === "SQM")!.id;

    const { data: branch } = await owner.client
      .from("branches").insert({ tenant_id: tenantId, code: "HO", name: "Head Office", is_head_office: true }).select("id").single();
    branchId = branch!.id;
    const { data: warehouse } = await owner.client
      .from("warehouses").insert({ tenant_id: tenantId, branch_id: branchId, code: "FAC", name: "Factory" }).select("id").single();
    warehouseId = warehouse!.id;
    const { data: supplier } = await owner.client
      .from("suppliers").insert({ tenant_id: tenantId, code: "QUARRY1", name: "E2E Test Quarry" }).select("id").single();
    supplierId = supplier!.id;
    const { data: product } = await owner.client
      .from("products")
      .insert({ tenant_id: tenantId, sku: "BLK-E2E-01", name: "E2E Test Block", inventory_tracking_mode: "unit", base_uom_id: blockUomId })
      .select("id").single();
    productId = product!.id;
  });

  afterAll(async () => {
    const admin = adminClient();
    await admin.from("audit_log").delete().eq("changed_by", owner.userId);
    await admin.from("tenants").delete().eq("id", tenantId);
    await deleteTestUser(owner.userId);
  });

  test("full lifecycle: intake -> processing -> output/genealogy -> QC -> cost roll-up -> traceability", async () => {
    // --- Milestone 1: real block intake via Supplier -> PO -> GRN -> post_goods_receipt ---
    const { data: po } = await owner.client
      .from("purchase_orders")
      .insert({ tenant_id: tenantId, branch_id: branchId, supplier_id: supplierId, po_number: "PO-E2E-1", status: "confirmed" })
      .select("id").single();
    const { data: poLine } = await owner.client
      .from("purchase_order_lines")
      .insert({ tenant_id: tenantId, purchase_order_id: po!.id, product_id: productId, quantity: 1, uom_id: blockUomId, unit_price: 60000 })
      .select("id").single();
    const { data: grn } = await owner.client
      .from("goods_receipts")
      .insert({ tenant_id: tenantId, branch_id: branchId, warehouse_id: warehouseId, purchase_order_id: po!.id, grn_number: "GRN-E2E-1", freight_cost: 6000, landed_cost_basis: "value" })
      .select("id").single();
    await owner.client.from("goods_receipt_lines").insert({
      tenant_id: tenantId, goods_receipt_id: grn!.id, purchase_order_line_id: poLine!.id,
      product_id: productId, quantity: 1, uom_id: blockUomId, unit_cost: 60000,
      unit_code: "BLK-E2E-1", dimension_length: 210, dimension_width: 160, dimension_height: 180,
      dimension_uom_id: cmUomId, volume_uom_id: m3UomId, quarry_source: "Deep Quarry Site 7", unit_quality_grade: "A",
    });
    const { error: intakeError } = await owner.client.rpc("post_goods_receipt", { p_goods_receipt_id: grn!.id });
    expect(intakeError).toBeNull();

    const { data: block } = await owner.client.from("inventory_units").select("*").eq("unit_code", "BLK-E2E-1").single();
    expect(block?.cost).toBe("66000.0000"); // 60000 + 6000 freight
    expect(Number(block?.volume)).toBeCloseTo(6.048, 6); // 210*160*180 / 1e6
    expect(block?.status).toBe("in_stock");
    expect(block?.quarry_source).toBe("Deep Quarry Site 7");

    // --- Milestone 2: processing job ---
    const { data: job } = await owner.client
      .from("processing_jobs")
      .insert({ tenant_id: tenantId, job_number: "JOB-E2E-1", input_unit_id: block!.id, branch_id: branchId, warehouse_id: warehouseId, stage: "cutting", machine: "Gangsaw #2" })
      .select("id").single();
    const { error: startError } = await owner.client.rpc("start_processing_job", { p_processing_job_id: job!.id });
    expect(startError).toBeNull();
    const { data: blockAfterStart } = await owner.client.from("inventory_units").select("status").eq("id", block!.id).single();
    expect(blockAfterStart?.status).toBe("processing");

    // --- Milestone 3 + 4: complete with 2 slabs + 1 remnant, verifying genealogy + yield ---
    const { data: outputIds, error: completeError } = await owner.client.rpc("complete_processing_job", {
      p_processing_job_id: job!.id,
      p_slabs: [
        { length: 205, width: 155, thickness: 2, dimension_uom_id: cmUomId, area_uom_id: sqftUomId, quality_grade: "A" },
        { length: 200, width: 150, thickness: 2.5, dimension_uom_id: cmUomId, area_uom_id: sqmUomId, quality_grade: "A" },
        { unit_type: "remnant", length: 80, width: 60, thickness: 15, dimension_uom_id: cmUomId, area_uom_id: sqftUomId, quality_grade: "C" },
      ] as never,
    });
    expect(completeError).toBeNull();
    const slabIds = outputIds as string[];
    expect(slabIds).toHaveLength(3);

    const { data: outputUnits } = await owner.client.from("inventory_units").select("*").in("id", slabIds).order("sequence_number");
    for (const unit of outputUnits!) {
      expect(unit.parent_unit_id).toBe(block!.id);
      expect(unit.output_processing_job_id).toBe(job!.id);
      expect(unit.status).toBe("pending_qc"); // Milestone 5 gate: not sellable yet
    }

    const { data: jobAfterComplete } = await owner.client.from("processing_jobs").select("status, yield_percentage, actual_slab_count, actual_remnant_count").eq("id", job!.id).single();
    expect(jobAfterComplete?.status).toBe("completed");
    expect(jobAfterComplete?.actual_slab_count).toBe(2);
    expect(jobAfterComplete?.actual_remnant_count).toBe(1);
    // (205*155*2 + 200*150*2.5 + 80*60*15) / (210*160*180) * 100
    const expectedYield = ((205 * 155 * 2 + 200 * 150 * 2.5 + 80 * 60 * 15) / (210 * 160 * 180)) * 100;
    expect(Number(jobAfterComplete?.yield_percentage)).toBeCloseTo(expectedYield, 2);

    const { data: blockAfterComplete } = await owner.client.from("inventory_units").select("status").eq("id", block!.id).single();
    expect(blockAfterComplete?.status).toBe("consumed"); // input must not remain available after consumption

    // --- Milestone 5: QC -- pass the two slabs, reject the remnant ---
    const [slabAId, slabBId, remnantId] = slabIds;
    await owner.client.rpc("record_qc_inspection", { p_inventory_unit_id: slabAId, p_outcome: "passed", p_confirmed_grade: "A" });
    await owner.client.rpc("record_qc_inspection", { p_inventory_unit_id: slabBId, p_outcome: "passed", p_confirmed_grade: "A" });
    await owner.client.rpc("record_qc_inspection", { p_inventory_unit_id: remnantId, p_outcome: "rejected", p_confirmed_grade: "D", p_defects: "Chipped corner" });

    const { data: unitsAfterQc } = await owner.client.from("inventory_units").select("id, status").in("id", slabIds);
    expect(unitsAfterQc!.find((u) => u.id === slabAId)?.status).toBe("in_stock");
    expect(unitsAfterQc!.find((u) => u.id === slabBId)?.status).toBe("in_stock");
    expect(unitsAfterQc!.find((u) => u.id === remnantId)?.status).toBe("rejected"); // never sellable

    // --- Milestone 6: cost roll-up -- allocated by volume, including the rejected piece ---
    const { error: costError } = await owner.client.rpc("record_processing_costs", { p_processing_job_id: job!.id, p_processing_cost: 9000, p_overhead_cost: 1500 });
    expect(costError).toBeNull();

    const { data: jobWithCost } = await owner.client.from("processing_jobs").select("total_cost").eq("id", job!.id).single();
    expect(Number(jobWithCost?.total_cost)).toBeCloseTo(76500, 4); // 66000 + 9000 + 1500

    const { data: costedUnits } = await owner.client.from("inventory_units").select("id, cost, volume").in("id", slabIds);
    const totalAllocated = costedUnits!.reduce((sum, u) => sum + Number(u.cost), 0);
    expect(totalAllocated).toBeCloseTo(76500, 2);
    // The rejected remnant still carries a real cost -- it consumed material and processing time.
    expect(Number(costedUnits!.find((u) => u.id === remnantId)?.cost)).toBeGreaterThan(0);

    // --- Full traceability: from a sellable slab back to supplier and quarry ---
    const { data: trace } = await owner.client
      .from("inventory_units")
      .select(`
        unit_code, status, cost, quality_grade,
        parent:inventory_units!inventory_units_parent_unit_id_fkey(unit_code, quarry_source, status, supplier_id)
      `)
      .eq("id", slabAId)
      .single();
    expect(trace?.status).toBe("in_stock");
    // @ts-expect-error -- Supabase nested-select typing doesn't infer the FK relation name here.
    expect(trace?.parent?.quarry_source).toBe("Deep Quarry Site 7");
    // @ts-expect-error -- see above.
    expect(trace?.parent?.status).toBe("consumed");
  });

  test("capability gate holds at every stage of the pipeline (start, complete, QC, cost roll-up)", async () => {
    const admin = adminClient();
    const { data: capability } = await admin.from("business_capabilities").select("id").eq("code", "block_slab_factory").single();

    const { data: block } = await owner.client
      .from("inventory_units")
      .insert({ tenant_id: tenantId, product_id: productId, unit_code: `BLK-E2E-CAP-${Date.now()}`, unit_type: "block", status: "in_stock", volume: 1, volume_uom_id: m3UomId, cost: 10000 })
      .select("id").single();
    const { data: job } = await owner.client
      .from("processing_jobs")
      .insert({ tenant_id: tenantId, job_number: `JOB-E2E-CAP-${Date.now()}`, input_unit_id: block!.id, branch_id: branchId, warehouse_id: warehouseId, stage: "cutting" })
      .select("id").single();

    async function withCapabilityDisabled<T>(fn: () => PromiseLike<T>): Promise<T> {
      await admin.from("tenant_capabilities").delete().eq("tenant_id", tenantId).eq("capability_id", capability!.id);
      try {
        return await fn();
      } finally {
        await admin.from("tenant_capabilities").insert({ tenant_id: tenantId, capability_id: capability!.id });
      }
    }

    const startBlocked = await withCapabilityDisabled(() => owner.client.rpc("start_processing_job", { p_processing_job_id: job!.id }));
    expect(startBlocked.error?.message).toMatch(/Block\/Slab Factory capability is not enabled/);

    await owner.client.rpc("start_processing_job", { p_processing_job_id: job!.id });

    const slab = { length: 100, width: 100, thickness: 2, dimension_uom_id: cmUomId, area_uom_id: sqftUomId };
    const completeBlocked = await withCapabilityDisabled(() =>
      owner.client.rpc("complete_processing_job", { p_processing_job_id: job!.id, p_slabs: [slab] as never }));
    expect(completeBlocked.error?.message).toMatch(/Block\/Slab Factory capability is not enabled/);

    const { data: ids } = await owner.client.rpc("complete_processing_job", { p_processing_job_id: job!.id, p_slabs: [slab] as never });
    const unitId = (ids as string[])[0];

    const qcBlocked = await withCapabilityDisabled(() => owner.client.rpc("record_qc_inspection", { p_inventory_unit_id: unitId, p_outcome: "passed" }));
    expect(qcBlocked.error?.message).toMatch(/Block\/Slab Factory capability is not enabled/);

    await owner.client.rpc("record_qc_inspection", { p_inventory_unit_id: unitId, p_outcome: "passed" });

    const costBlocked = await withCapabilityDisabled(() =>
      owner.client.rpc("record_processing_costs", { p_processing_job_id: job!.id, p_processing_cost: 100, p_overhead_cost: 0 }));
    expect(costBlocked.error?.message).toMatch(/Block\/Slab Factory capability is not enabled/);
  });

  test("Phase 1 (Trading/Distribution) is unaffected: a full simple-tracked PO->GRN->SO->delivery->invoice cycle still works", async () => {
    const { data: pcsUom } = await adminClient().from("uom").select("id").eq("code", "PCS").is("tenant_id", null).single();
    const { data: product } = await owner.client
      .from("products")
      .insert({ tenant_id: tenantId, sku: "TILE-E2E-REGR", name: "Regression Tile", inventory_tracking_mode: "simple", base_uom_id: pcsUom!.id })
      .select("id").single();
    const { data: customer } = await owner.client
      .from("customers").insert({ tenant_id: tenantId, code: "CUST-E2E", name: "Regression Customer" }).select("id").single();

    const { data: po } = await owner.client
      .from("purchase_orders")
      .insert({ tenant_id: tenantId, branch_id: branchId, supplier_id: supplierId, po_number: "PO-E2E-REGR", status: "confirmed" })
      .select("id").single();
    const { data: poLine } = await owner.client
      .from("purchase_order_lines")
      .insert({ tenant_id: tenantId, purchase_order_id: po!.id, product_id: product!.id, quantity: 100, uom_id: pcsUom!.id, unit_price: 20 })
      .select("id").single();
    const { data: grn } = await owner.client
      .from("goods_receipts")
      .insert({ tenant_id: tenantId, branch_id: branchId, warehouse_id: warehouseId, purchase_order_id: po!.id, grn_number: "GRN-E2E-REGR", freight_cost: 0, landed_cost_basis: "value" })
      .select("id").single();
    await owner.client.from("goods_receipt_lines").insert({
      tenant_id: tenantId, goods_receipt_id: grn!.id, purchase_order_line_id: poLine!.id,
      product_id: product!.id, quantity: 100, uom_id: pcsUom!.id, unit_cost: 20,
    });
    const { error: receiptError } = await owner.client.rpc("post_goods_receipt", { p_goods_receipt_id: grn!.id });
    expect(receiptError).toBeNull();

    const { data: so } = await owner.client
      .from("sales_orders")
      .insert({ tenant_id: tenantId, branch_id: branchId, customer_id: customer!.id, warehouse_id: warehouseId, so_number: "SO-E2E-REGR", status: "draft" })
      .select("id").single();
    const { data: soLine } = await owner.client
      .from("sales_order_lines")
      .insert({ tenant_id: tenantId, sales_order_id: so!.id, product_id: product!.id, quantity: 40, uom_id: pcsUom!.id, unit_price: 35 })
      .select("id").single();
    const { error: confirmError } = await owner.client.rpc("confirm_sales_order", { p_sales_order_id: so!.id });
    expect(confirmError).toBeNull();

    const { data: delivery } = await owner.client
      .from("deliveries")
      .insert({ tenant_id: tenantId, branch_id: branchId, warehouse_id: warehouseId, sales_order_id: so!.id, delivery_number: "DEL-E2E-REGR" })
      .select("id").single();
    await owner.client.from("delivery_lines").insert({
      tenant_id: tenantId, delivery_id: delivery!.id, sales_order_line_id: soLine!.id, product_id: product!.id, quantity: 40,
    });
    const { error: dispatchError } = await owner.client.rpc("dispatch_delivery", { p_delivery_id: delivery!.id });
    expect(dispatchError).toBeNull();

    const { data: invoiceId, error: invoiceError } = await owner.client.rpc("generate_sales_invoice_from_delivery", {
      p_delivery_id: delivery!.id, p_invoice_number: "INV-E2E-REGR",
    });
    expect(invoiceError).toBeNull();

    const { data: invoiceLine } = await owner.client
      .from("sales_invoice_lines_secure")
      .select("unit_price, unit_cost, quantity, line_total, margin")
      .eq("sales_invoice_id", invoiceId!)
      .single();
    expect(invoiceLine?.unit_price).toBe("35.0000");
    expect(invoiceLine?.unit_cost).toBe("20.0000");
    expect(invoiceLine?.line_total).toBe("1400.0000");
    expect(Number(invoiceLine?.margin)).toBeCloseTo(600, 4); // (35-20)*40

    const { data: stock } = await owner.client.from("inventory_stock").select("qty_on_hand, reserved_qty").eq("product_id", product!.id).single();
    expect(stock?.qty_on_hand).toBe("60.0000"); // 100 - 40
    expect(stock?.reserved_qty).toBe("0.0000"); // released on dispatch
  });
});
