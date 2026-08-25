import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { adminClient, createSignedInTestUser, deleteTestUser, hasServiceRoleKey } from "./helpers";

// Automated version of the live-database verification performed while building
// Factory Milestone 3 (Slab Output + Genealogy). Requires
// SUPABASE_SERVICE_ROLE_KEY (test setup only, see tests/rls/helpers.ts).
describe.skipIf(!hasServiceRoleKey)("Factory Milestone 3: Slab Output + Genealogy", () => {
  let owner: { userId: string; client: ReturnType<typeof adminClient> };
  let branchBUser: { userId: string; client: ReturnType<typeof adminClient> };
  let tenantId: string;
  let branchAId: string;
  let branchBId: string;
  let warehouseAId: string;
  let productId: string;
  let blockUomId: string;
  let cmUomId: string;
  let inchUomId: string;
  let sqftUomId: string;
  let sqmUomId: string;
  let m3UomId: string;

  async function makeBlock(unitCode: string) {
    const admin = adminClient();
    // volume is required as of Milestone 4 (complete_processing_job needs it
    // for yield/waste math) -- an arbitrary non-zero value works fine here
    // since these tests don't assert on yield.
    const { data: unit } = await admin
      .from("inventory_units")
      .insert({ tenant_id: tenantId, product_id: productId, unit_code: unitCode, unit_type: "block", status: "in_stock", volume: 10, volume_uom_id: m3UomId })
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
    owner = await createSignedInTestUser(`slab-owner-${suffix}@stonevora.test`, "test-password-123");
    branchBUser = await createSignedInTestUser(`slab-branchB-${suffix}@stonevora.test`, "test-password-123");

    const { data: tId } = await owner.client.rpc("create_tenant_for_user", {
      p_tenant_name: `Slab Output Test ${suffix}`,
      p_tenant_slug: `slab-output-test-${suffix}`,
    });
    tenantId = tId!;

    const admin = adminClient();
    const { data: capability } = await admin.from("business_capabilities").select("id").eq("code", "block_slab_factory").single();
    await admin.from("tenant_capabilities").insert({ tenant_id: tenantId, capability_id: capability!.id });

    const { data: uoms } = await admin.from("uom").select("id, code").in("code", ["BLOCK", "CM", "INCH", "SQFT", "SQM", "M3"]).is("tenant_id", null);
    blockUomId = uoms!.find((u) => u.code === "BLOCK")!.id;
    cmUomId = uoms!.find((u) => u.code === "CM")!.id;
    inchUomId = uoms!.find((u) => u.code === "INCH")!.id;
    sqftUomId = uoms!.find((u) => u.code === "SQFT")!.id;
    sqmUomId = uoms!.find((u) => u.code === "SQM")!.id;
    m3UomId = uoms!.find((u) => u.code === "M3")!.id;

    const { data: branchA } = await owner.client
      .from("branches").insert({ tenant_id: tenantId, code: "BA", name: "Branch A", is_head_office: true }).select("id").single();
    branchAId = branchA!.id;
    const { data: branchB } = await owner.client
      .from("branches").insert({ tenant_id: tenantId, code: "BB", name: "Branch B" }).select("id").single();
    branchBId = branchB!.id;

    const { data: warehouseA } = await owner.client
      .from("warehouses").insert({ tenant_id: tenantId, branch_id: branchAId, code: "WA", name: "Warehouse A" }).select("id").single();
    warehouseAId = warehouseA!.id;

    const { data: product } = await owner.client
      .from("products")
      .insert({ tenant_id: tenantId, sku: "BLK-SLAB-01", name: "Test Block", inventory_tracking_mode: "unit", base_uom_id: blockUomId })
      .select("id").single();
    productId = product!.id;

    const { data: operatorRole } = await admin
      .from("roles").select("id").eq("tenant_id", tenantId).eq("code", "production_operator").single();
    await admin.from("user_tenants").insert({ user_id: branchBUser.userId, tenant_id: tenantId });
    await admin.from("user_roles").insert({ user_id: branchBUser.userId, tenant_id: tenantId, role_id: operatorRole!.id, branch_id: branchBId });
  });

  afterAll(async () => {
    const admin = adminClient();
    await admin.from("audit_log").delete().in("changed_by", [owner.userId, branchBUser.userId]);
    await admin.from("tenants").delete().eq("id", tenantId);
    await deleteTestUser(owner.userId);
    await deleteTestUser(branchBUser.userId);
  });

  test("produces slabs with correct genealogy, area math (SQFT + SQM), consumes the block, and completes the job", async () => {
    const blockId = await makeBlock(`BLK-${Date.now()}-A`);
    const jobId = await makeStartedJob(blockId, `JOB-${Date.now()}-A`);

    const { data: slabIds, error } = await owner.client.rpc("complete_processing_job", {
      p_processing_job_id: jobId,
      p_slabs: [
        { length: 120, width: 60, thickness: 2, dimension_uom_id: cmUomId, area_uom_id: sqftUomId, quality_grade: "A" },
        { length: 100, width: 50, thickness: 2, dimension_uom_id: inchUomId, area_uom_id: sqmUomId, quality_grade: "B", usable_area: 3.0 },
      ],
    });
    expect(error).toBeNull();
    expect(slabIds).toHaveLength(2);

    const { data: slabs } = await owner.client
      .from("inventory_units")
      .select("*")
      .in("id", slabIds as string[])
      .order("sequence_number");

    // 120cm * 60cm = 7200 cm2; / 929.0304 cm2 per sqft.
    expect(Number(slabs![0].actual_area)).toBeCloseTo(7200 / 929.0304, 3);
    expect(slabs![0].unit_type).toBe("slab");
    expect(slabs![0].parent_unit_id).toBe(blockId);
    expect(slabs![0].output_processing_job_id).toBe(jobId);
    expect(slabs![0].sequence_number).toBe(1);
    // Milestone 5 (QC) changed the post-completion default: a freshly
    // produced slab/remnant now lands 'pending_qc', not 'in_stock', until a
    // QC inspection passes it.
    expect(slabs![0].status).toBe("pending_qc");
    // usable_area defaults to the gross area when not supplied.
    expect(Number(slabs![0].usable_area)).toBeCloseTo(Number(slabs![0].actual_area), 4);

    // 100in * 2.54 = 254cm; 50in * 2.54 = 127cm; 254*127 = 32258 cm2; /10000 per sqm.
    expect(Number(slabs![1].actual_area)).toBeCloseTo(32258 / 10000, 4);
    expect(Number(slabs![1].usable_area)).toBe(3);
    expect(slabs![1].parent_unit_id).toBe(blockId);
    expect(slabs![1].sequence_number).toBe(2);

    const { data: block } = await owner.client.from("inventory_units").select("status").eq("id", blockId).single();
    expect(block?.status).toBe("consumed");

    const { data: job } = await owner.client.from("processing_jobs").select("status, actual_slab_count, completed_at").eq("id", jobId).single();
    expect(job?.status).toBe("completed");
    expect(job?.actual_slab_count).toBe(2);
    expect(job?.completed_at).not.toBeNull();
  });

  test("rejects usable_area greater than the computed gross area", async () => {
    const blockId = await makeBlock(`BLK-${Date.now()}-B`);
    const jobId = await makeStartedJob(blockId, `JOB-${Date.now()}-B`);

    const { error } = await owner.client.rpc("complete_processing_job", {
      p_processing_job_id: jobId,
      p_slabs: [{ length: 100, width: 100, thickness: 2, dimension_uom_id: cmUomId, area_uom_id: sqmUomId, usable_area: 2.0 }],
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/usable_area must be between 0 and the gross area/);
  });

  // An empty output array is valid as of Milestone 4 (Yield + Waste +
  // Remnants) -- it represents a block that turned out fully unusable
  // (0% yield, 100% waste), not an error.
  test("accepts an empty slabs array as a fully-wasted block, and rejects missing required per-slab fields", async () => {
    const blockId = await makeBlock(`BLK-${Date.now()}-C`);
    const jobId = await makeStartedJob(blockId, `JOB-${Date.now()}-C`);

    const { data: emptyResult, error: emptyError } = await owner.client.rpc("complete_processing_job", { p_processing_job_id: jobId, p_slabs: [] });
    expect(emptyError).toBeNull();
    expect(emptyResult).toEqual([]);
    const { data: job } = await owner.client.from("processing_jobs").select("status, yield_percentage, actual_slab_count").eq("id", jobId).single();
    expect(job?.status).toBe("completed");
    expect(Number(job?.yield_percentage)).toBe(0);
    expect(job?.actual_slab_count).toBe(0);

    const blockId2 = await makeBlock(`BLK-${Date.now()}-C2`);
    const jobId2 = await makeStartedJob(blockId2, `JOB-${Date.now()}-C2`);
    const { error: missingFieldsError } = await owner.client.rpc("complete_processing_job", {
      p_processing_job_id: jobId2,
      p_slabs: [{ length: 100, width: 100, dimension_uom_id: cmUomId }],
    });
    expect(missingFieldsError).not.toBeNull();
    expect(missingFieldsError?.message).toMatch(/requires length, width, thickness, dimension_uom_id, and area_uom_id/);
  });

  test("branch scoping: a branch-B-scoped user cannot complete a branch-A job", async () => {
    const blockId = await makeBlock(`BLK-${Date.now()}-D`);
    const jobId = await makeStartedJob(blockId, `JOB-${Date.now()}-D`);

    const { error } = await branchBUser.client.rpc("complete_processing_job", {
      p_processing_job_id: jobId,
      p_slabs: [{ length: 100, width: 100, thickness: 2, dimension_uom_id: cmUomId, area_uom_id: sqmUomId }],
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/do not have access to the branch/);
  });

  test("rejects completion when block_slab_factory capability is disabled", async () => {
    const admin = adminClient();
    const { data: capability } = await admin.from("business_capabilities").select("id").eq("code", "block_slab_factory").single();
    await admin.from("tenant_capabilities").delete().eq("tenant_id", tenantId).eq("capability_id", capability!.id);

    const blockId = await makeBlock(`BLK-${Date.now()}-E`);
    const jobId = await makeStartedJob(blockId, `JOB-${Date.now()}-E`);

    const { error } = await owner.client.rpc("complete_processing_job", {
      p_processing_job_id: jobId,
      p_slabs: [{ length: 100, width: 100, thickness: 2, dimension_uom_id: cmUomId, area_uom_id: sqmUomId }],
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/Block\/Slab Factory capability is not enabled/);

    await admin.from("tenant_capabilities").insert({ tenant_id: tenantId, capability_id: capability!.id });
  });
});
