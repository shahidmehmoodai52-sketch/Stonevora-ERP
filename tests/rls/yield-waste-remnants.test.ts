import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { adminClient, createSignedInTestUser, deleteTestUser, hasServiceRoleKey } from "./helpers";

// Automated version of the live-database verification performed while building
// Factory Milestone 4 (Yield + Waste + Remnants). Requires
// SUPABASE_SERVICE_ROLE_KEY (test setup only, see tests/rls/helpers.ts).
describe.skipIf(!hasServiceRoleKey)("Factory Milestone 4: Yield + Waste + Remnants", () => {
  let owner: { userId: string; client: ReturnType<typeof adminClient> };
  let tenantId: string;
  let branchAId: string;
  let warehouseAId: string;
  let productId: string;
  let blockUomId: string;
  let cmUomId: string;
  let sqftUomId: string;
  let sqmUomId: string;
  let m3UomId: string;
  let cftUomId: string;

  async function makeBlock(unitCode: string, volume: number, volumeUomId: string) {
    const admin = adminClient();
    const { data: unit } = await admin
      .from("inventory_units")
      .insert({ tenant_id: tenantId, product_id: productId, unit_code: unitCode, unit_type: "block", status: "in_stock", volume, volume_uom_id: volumeUomId })
      .select("id").single();
    return unit!.id as string;
  }

  async function makeStartedJob(inputUnitId: string, jobNumber: string) {
    const { data: job } = await owner.client
      .from("processing_jobs")
      .insert({ tenant_id: tenantId, job_number: jobNumber, input_unit_id: inputUnitId, branch_id: branchAId, warehouse_id: warehouseAId, stage: "cutting" })
      .select("id").single();
    const { error } = await owner.client.rpc("start_processing_job", { p_processing_job_id: job!.id });
    expect(error).toBeNull();
    return job!.id as string;
  }

  beforeAll(async () => {
    const suffix = Date.now();
    owner = await createSignedInTestUser(`yield-owner-${suffix}@stonevora.test`, "test-password-123");

    const { data: tId } = await owner.client.rpc("create_tenant_for_user", {
      p_tenant_name: `Yield Test ${suffix}`,
      p_tenant_slug: `yield-test-${suffix}`,
    });
    tenantId = tId!;

    const admin = adminClient();
    const { data: capability } = await admin.from("business_capabilities").select("id").eq("code", "block_slab_factory").single();
    await admin.from("tenant_capabilities").insert({ tenant_id: tenantId, capability_id: capability!.id });

    const { data: uoms } = await admin.from("uom").select("id, code").in("code", ["BLOCK", "CM", "SQFT", "SQM", "M3", "CFT"]).is("tenant_id", null);
    blockUomId = uoms!.find((u) => u.code === "BLOCK")!.id;
    cmUomId = uoms!.find((u) => u.code === "CM")!.id;
    sqftUomId = uoms!.find((u) => u.code === "SQFT")!.id;
    sqmUomId = uoms!.find((u) => u.code === "SQM")!.id;
    m3UomId = uoms!.find((u) => u.code === "M3")!.id;
    cftUomId = uoms!.find((u) => u.code === "CFT")!.id;

    const { data: branchA } = await owner.client
      .from("branches").insert({ tenant_id: tenantId, code: "BA", name: "Branch A", is_head_office: true }).select("id").single();
    branchAId = branchA!.id;

    const { data: warehouseA } = await owner.client
      .from("warehouses").insert({ tenant_id: tenantId, branch_id: branchAId, code: "WA", name: "Warehouse A" }).select("id").single();
    warehouseAId = warehouseA!.id;

    const { data: product } = await owner.client
      .from("products")
      .insert({ tenant_id: tenantId, sku: "BLK-YIELD-01", name: "Test Block", inventory_tracking_mode: "unit", base_uom_id: blockUomId })
      .select("id").single();
    productId = product!.id;
  });

  afterAll(async () => {
    const admin = adminClient();
    await admin.from("audit_log").delete().eq("changed_by", owner.userId);
    await admin.from("tenants").delete().eq("id", tenantId);
    await deleteTestUser(owner.userId);
  });

  test("high yield: a single slab close to the block's own volume", async () => {
    // Block: 200cm x 150cm x 3cm = 90,000 cm3 = 0.09 m3.
    const blockId = await makeBlock(`BLK-${Date.now()}-HIGH`, 0.09, m3UomId);
    const jobId = await makeStartedJob(blockId, `JOB-${Date.now()}-HIGH`);

    const { error } = await owner.client.rpc("complete_processing_job", {
      p_processing_job_id: jobId,
      p_slabs: [{ length: 195, width: 145, thickness: 2.8, dimension_uom_id: cmUomId, area_uom_id: sqftUomId }],
    });
    expect(error).toBeNull();

    const { data: job } = await owner.client.from("processing_jobs").select("yield_percentage, waste_volume").eq("id", jobId).single();
    // 195*145*2.8 = 79170 cm3; / 90000 cm3 * 100.
    expect(Number(job?.yield_percentage)).toBeCloseTo((79170 / 90000) * 100, 2);
    expect(Number(job?.waste_volume)).toBeCloseTo((90000 - 79170) / 1000000, 6);
  });

  test("low yield: a small slab against a large CFT-denominated block", async () => {
    // Block: 200cm x 150cm x 180cm = 5,400,000 cm3 -> CFT.
    const blockVolumeCft = 5400000 / 28316.846592;
    const blockId = await makeBlock(`BLK-${Date.now()}-LOW`, blockVolumeCft, cftUomId);
    const jobId = await makeStartedJob(blockId, `JOB-${Date.now()}-LOW`);

    const { error } = await owner.client.rpc("complete_processing_job", {
      p_processing_job_id: jobId,
      p_slabs: [{ length: 50, width: 50, thickness: 2, dimension_uom_id: cmUomId, area_uom_id: sqmUomId }],
    });
    expect(error).toBeNull();

    const { data: job } = await owner.client.from("processing_jobs").select("yield_percentage").eq("id", jobId).single();
    // 50*50*2 = 5000 cm3; / 5,400,000 cm3 * 100.
    expect(Number(job?.yield_percentage)).toBeCloseTo((5000 / 5400000) * 100, 3);
  });

  test("zero yield: an empty output array is a fully-wasted block", async () => {
    const blockId = await makeBlock(`BLK-${Date.now()}-ZERO`, 1, m3UomId);
    const jobId = await makeStartedJob(blockId, `JOB-${Date.now()}-ZERO`);

    const { data, error } = await owner.client.rpc("complete_processing_job", { p_processing_job_id: jobId, p_slabs: [] });
    expect(error).toBeNull();
    expect(data).toEqual([]);

    const { data: job } = await owner.client.from("processing_jobs").select("status, yield_percentage, waste_volume, actual_slab_count, actual_remnant_count").eq("id", jobId).single();
    expect(job?.status).toBe("completed");
    expect(Number(job?.yield_percentage)).toBe(0);
    expect(Number(job?.waste_volume)).toBe(1);
    expect(job?.actual_slab_count).toBe(0);
    expect(job?.actual_remnant_count).toBe(0);

    const { data: block } = await owner.client.from("inventory_units").select("status").eq("id", blockId).single();
    expect(block?.status).toBe("consumed");
  });

  test("multiple slabs + a remnant + decimal dimensions all roll up correctly, distinguished by unit_type", async () => {
    const blockVolume = 300.5 * 155.25 * 190.75; // cm3
    const blockId = await makeBlock(`BLK-${Date.now()}-MULTI`, blockVolume / 1000000, m3UomId);
    const jobId = await makeStartedJob(blockId, `JOB-${Date.now()}-MULTI`);

    const { data: ids, error } = await owner.client.rpc("complete_processing_job", {
      p_processing_job_id: jobId,
      p_slabs: [
        { length: 295.3, width: 150.7, thickness: 2.05, dimension_uom_id: cmUomId, area_uom_id: sqftUomId, quality_grade: "A" },
        { length: 290.1, width: 148.2, thickness: 1.95, dimension_uom_id: cmUomId, area_uom_id: sqmUomId, quality_grade: "A" },
        { unit_type: "remnant", length: 60.4, width: 45.2, thickness: 180.75, dimension_uom_id: cmUomId, area_uom_id: sqftUomId, quality_grade: "C" },
      ],
    });
    expect(error).toBeNull();
    expect(ids).toHaveLength(3);

    const { data: units } = await owner.client.from("inventory_units").select("*").in("id", ids as string[]).order("sequence_number");
    expect(units![0].unit_type).toBe("slab");
    expect(units![1].unit_type).toBe("slab");
    expect(units![2].unit_type).toBe("remnant");
    expect(units!.every((u) => u.parent_unit_id === blockId)).toBe(true);
    expect(units!.every((u) => u.output_processing_job_id === jobId)).toBe(true);

    const { data: job } = await owner.client.from("processing_jobs").select("yield_percentage, actual_slab_count, actual_remnant_count").eq("id", jobId).single();
    expect(job?.actual_slab_count).toBe(2);
    expect(job?.actual_remnant_count).toBe(1);
    const outputVolume = 295.3 * 150.7 * 2.05 + 290.1 * 148.2 * 1.95 + 60.4 * 45.2 * 180.75;
    expect(Number(job?.yield_percentage)).toBeCloseTo((outputVolume / blockVolume) * 100, 2);
  });

  test("rejects total output volume exceeding the input block's recorded volume", async () => {
    const blockId = await makeBlock(`BLK-${Date.now()}-OVERFLOW`, 0.001, m3UomId);
    const jobId = await makeStartedJob(blockId, `JOB-${Date.now()}-OVERFLOW`);

    const { error } = await owner.client.rpc("complete_processing_job", {
      p_processing_job_id: jobId,
      p_slabs: [{ length: 50, width: 50, thickness: 2, dimension_uom_id: cmUomId, area_uom_id: sqmUomId }],
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/exceeds the input block's recorded volume/);

    // The failed attempt must not have corrupted the job's state.
    const { data: job } = await owner.client.from("processing_jobs").select("status").eq("id", jobId).single();
    expect(job?.status).toBe("in_progress");
  });

  test("rejects completion when the input block has no recorded volume", async () => {
    const admin = adminClient();
    const { data: unit } = await admin
      .from("inventory_units")
      .insert({ tenant_id: tenantId, product_id: productId, unit_code: `BLK-${Date.now()}-NOVOL`, unit_type: "block", status: "in_stock" })
      .select("id").single();
    const jobId = await makeStartedJob(unit!.id, `JOB-${Date.now()}-NOVOL`);

    const { error } = await owner.client.rpc("complete_processing_job", {
      p_processing_job_id: jobId,
      p_slabs: [{ length: 50, width: 50, thickness: 2, dimension_uom_id: cmUomId, area_uom_id: sqmUomId }],
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/has no recorded volume/);
  });

  test("rejects an output item missing thickness", async () => {
    const blockId = await makeBlock(`BLK-${Date.now()}-NOTHICK`, 1, m3UomId);
    const jobId = await makeStartedJob(blockId, `JOB-${Date.now()}-NOTHICK`);

    const { error } = await owner.client.rpc("complete_processing_job", {
      p_processing_job_id: jobId,
      p_slabs: [{ length: 50, width: 50, dimension_uom_id: cmUomId, area_uom_id: sqmUomId }],
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/requires length, width, thickness, dimension_uom_id, and area_uom_id/);
  });

  test("rejects an invalid unit_type", async () => {
    const blockId = await makeBlock(`BLK-${Date.now()}-BADTYPE`, 1, m3UomId);
    const jobId = await makeStartedJob(blockId, `JOB-${Date.now()}-BADTYPE`);

    const { error } = await owner.client.rpc("complete_processing_job", {
      p_processing_job_id: jobId,
      p_slabs: [{ unit_type: "block", length: 50, width: 50, thickness: 2, dimension_uom_id: cmUomId, area_uom_id: sqmUomId }],
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/unit_type slab or remnant/);
  });
});
