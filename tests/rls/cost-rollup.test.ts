import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { adminClient, createSignedInTestUser, deleteTestUser, hasServiceRoleKey } from "./helpers";

// Automated version of the live-database verification performed while building
// Factory Milestone 6 (Cost Roll-up). Requires SUPABASE_SERVICE_ROLE_KEY (test
// setup only, see tests/rls/helpers.ts).
describe.skipIf(!hasServiceRoleKey)("Factory Milestone 6: Cost Roll-up", () => {
  let owner: { userId: string; client: ReturnType<typeof adminClient> };
  let branchBUser: { userId: string; client: ReturnType<typeof adminClient> };
  let tenantId: string;
  let branchAId: string;
  let branchBId: string;
  let warehouseAId: string;
  let productId: string;
  let blockUomId: string;
  let cmUomId: string;
  let sqftUomId: string;
  let m3UomId: string;

  async function makeBlock(unitCode: string, cost: number | null, volume = 1) {
    const admin = adminClient();
    const { data: unit } = await admin
      .from("inventory_units")
      .insert({ tenant_id: tenantId, product_id: productId, unit_code: unitCode, unit_type: "block", status: "in_stock", volume, volume_uom_id: m3UomId, cost })
      .select("id").single();
    return unit!.id as string;
  }

  async function makeCompletedJob(inputUnitId: string, jobNumber: string, slabs: Record<string, unknown>[]) {
    const { data: job } = await owner.client
      .from("processing_jobs")
      .insert({ tenant_id: tenantId, job_number: jobNumber, input_unit_id: inputUnitId, branch_id: branchAId, warehouse_id: warehouseAId, stage: "cutting" })
      .select("id").single();
    await owner.client.rpc("start_processing_job", { p_processing_job_id: job!.id });
    const { data: ids } = await owner.client.rpc("complete_processing_job", { p_processing_job_id: job!.id, p_slabs: slabs as never });
    return { jobId: job!.id as string, unitIds: (ids ?? []) as string[] };
  }

  beforeAll(async () => {
    const suffix = Date.now();
    owner = await createSignedInTestUser(`cost-owner-${suffix}@stonevora.test`, "test-password-123");
    branchBUser = await createSignedInTestUser(`cost-branchb-${suffix}@stonevora.test`, "test-password-123");

    const { data: tId } = await owner.client.rpc("create_tenant_for_user", {
      p_tenant_name: `Cost Rollup Test ${suffix}`,
      p_tenant_slug: `cost-rollup-test-${suffix}`,
    });
    tenantId = tId!;

    const admin = adminClient();
    const { data: capability } = await admin.from("business_capabilities").select("id").eq("code", "block_slab_factory").single();
    await admin.from("tenant_capabilities").insert({ tenant_id: tenantId, capability_id: capability!.id });

    const { data: uoms } = await admin.from("uom").select("id, code").in("code", ["BLOCK", "CM", "SQFT", "M3"]).is("tenant_id", null);
    blockUomId = uoms!.find((u) => u.code === "BLOCK")!.id;
    cmUomId = uoms!.find((u) => u.code === "CM")!.id;
    sqftUomId = uoms!.find((u) => u.code === "SQFT")!.id;
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
      .insert({ tenant_id: tenantId, sku: "BLK-COST-01", name: "Test Block", inventory_tracking_mode: "unit", base_uom_id: blockUomId })
      .select("id").single();
    productId = product!.id;

    const { data: operatorRole } = await admin.from("roles").select("id").eq("tenant_id", tenantId).eq("code", "production_operator").single();
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

  test("allocates block + processing + overhead cost across outputs proportional to volume, summing back to the total", async () => {
    const blockId = await makeBlock(`BLK-${Date.now()}-A`, 55000, 190.6992);
    const { jobId, unitIds } = await makeCompletedJob(blockId, `JOB-${Date.now()}-A`, [
      { length: 195, width: 145, thickness: 2, dimension_uom_id: cmUomId, area_uom_id: sqftUomId },
      { length: 190, width: 140, thickness: 2.5, dimension_uom_id: cmUomId, area_uom_id: sqftUomId },
      { unit_type: "remnant", length: 60, width: 45, thickness: 10, dimension_uom_id: cmUomId, area_uom_id: sqftUomId },
    ]);
    expect(unitIds).toHaveLength(3);

    const { error } = await owner.client.rpc("record_processing_costs", { p_processing_job_id: jobId, p_processing_cost: 8000, p_overhead_cost: 2000 });
    expect(error).toBeNull();

    const { data: job } = await owner.client.from("processing_jobs").select("processing_cost, overhead_cost, total_cost, costs_recorded_at").eq("id", jobId).single();
    expect(Number(job?.total_cost)).toBeCloseTo(65000, 4); // 55000 block cost + 8000 processing + 2000 overhead
    expect(job?.costs_recorded_at).not.toBeNull();

    const { data: units } = await owner.client.from("inventory_units").select("cost, volume").in("id", unitIds).order("sequence_number");
    const totalVolume = units!.reduce((sum, u) => sum + Number(u.volume), 0);
    const totalAllocated = units!.reduce((sum, u) => sum + Number(u.cost), 0);
    expect(totalAllocated).toBeCloseTo(Number(job?.total_cost), 2);
    // Each unit's cost matches its volume share of the total.
    for (const unit of units!) {
      const expectedShare = (Number(unit.volume) / totalVolume) * Number(job?.total_cost);
      expect(Number(unit.cost)).toBeCloseTo(expectedShare, 2);
    }
  });

  test("a 100%-waste job (zero output) still records job-level costs with nothing to allocate", async () => {
    const blockId = await makeBlock(`BLK-${Date.now()}-WASTE`, 20000);
    const { jobId, unitIds } = await makeCompletedJob(blockId, `JOB-${Date.now()}-WASTE`, []);
    expect(unitIds).toHaveLength(0);

    const { error } = await owner.client.rpc("record_processing_costs", { p_processing_job_id: jobId, p_processing_cost: 3000, p_overhead_cost: 500 });
    expect(error).toBeNull();

    const { data: job } = await owner.client.from("processing_jobs").select("total_cost").eq("id", jobId).single();
    expect(Number(job?.total_cost)).toBeCloseTo(23500, 4);
  });

  test("rejects recording costs twice for the same job", async () => {
    const blockId = await makeBlock(`BLK-${Date.now()}-DOUBLE`, 10000);
    const { jobId } = await makeCompletedJob(blockId, `JOB-${Date.now()}-DOUBLE`, [
      { length: 50, width: 50, thickness: 2, dimension_uom_id: cmUomId, area_uom_id: sqftUomId },
    ]);
    await owner.client.rpc("record_processing_costs", { p_processing_job_id: jobId, p_processing_cost: 100, p_overhead_cost: 0 });

    const { error } = await owner.client.rpc("record_processing_costs", { p_processing_job_id: jobId, p_processing_cost: 200, p_overhead_cost: 0 });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/already been recorded/);
  });

  test("rejects recording costs before the job is completed", async () => {
    const blockId = await makeBlock(`BLK-${Date.now()}-DRAFT`, 10000);
    const { data: job } = await owner.client
      .from("processing_jobs")
      .insert({ tenant_id: tenantId, job_number: `JOB-${Date.now()}-DRAFT`, input_unit_id: blockId, branch_id: branchAId, warehouse_id: warehouseAId, stage: "cutting" })
      .select("id").single();

    const { error } = await owner.client.rpc("record_processing_costs", { p_processing_job_id: job!.id, p_processing_cost: 100, p_overhead_cost: 0 });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/not completed/);
  });

  test("rejects a negative processing_cost or overhead_cost", async () => {
    const blockId = await makeBlock(`BLK-${Date.now()}-NEG`, 10000);
    const { jobId } = await makeCompletedJob(blockId, `JOB-${Date.now()}-NEG`, [
      { length: 50, width: 50, thickness: 2, dimension_uom_id: cmUomId, area_uom_id: sqftUomId },
    ]);

    const { error } = await owner.client.rpc("record_processing_costs", { p_processing_job_id: jobId, p_processing_cost: -50, p_overhead_cost: 0 });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/processing_cost must be zero or greater/);
  });

  test("rejects cost roll-up when the input block has no recorded cost", async () => {
    const blockId = await makeBlock(`BLK-${Date.now()}-NOCOST`, null);
    const { jobId } = await makeCompletedJob(blockId, `JOB-${Date.now()}-NOCOST`, [
      { length: 50, width: 50, thickness: 2, dimension_uom_id: cmUomId, area_uom_id: sqftUomId },
    ]);

    const { error } = await owner.client.rpc("record_processing_costs", { p_processing_job_id: jobId, p_processing_cost: 100, p_overhead_cost: 0 });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/has no recorded cost/);
  });

  test("branch scoping: a branch-B-scoped user cannot record costs for a branch-A job", async () => {
    const blockId = await makeBlock(`BLK-${Date.now()}-BRANCH`, 10000);
    const { jobId } = await makeCompletedJob(blockId, `JOB-${Date.now()}-BRANCH`, [
      { length: 50, width: 50, thickness: 2, dimension_uom_id: cmUomId, area_uom_id: sqftUomId },
    ]);

    const { error } = await branchBUser.client.rpc("record_processing_costs", { p_processing_job_id: jobId, p_processing_cost: 100, p_overhead_cost: 0 });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/do not have access to the branch/);
  });

  test("rejects cost roll-up when block_slab_factory capability is disabled", async () => {
    const blockId = await makeBlock(`BLK-${Date.now()}-NOCAP`, 10000);
    const { jobId } = await makeCompletedJob(blockId, `JOB-${Date.now()}-NOCAP`, [
      { length: 50, width: 50, thickness: 2, dimension_uom_id: cmUomId, area_uom_id: sqftUomId },
    ]);

    const admin = adminClient();
    const { data: capability } = await admin.from("business_capabilities").select("id").eq("code", "block_slab_factory").single();
    await admin.from("tenant_capabilities").delete().eq("tenant_id", tenantId).eq("capability_id", capability!.id);

    const { error } = await owner.client.rpc("record_processing_costs", { p_processing_job_id: jobId, p_processing_cost: 100, p_overhead_cost: 0 });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/Block\/Slab Factory capability is not enabled/);

    await admin.from("tenant_capabilities").insert({ tenant_id: tenantId, capability_id: capability!.id });
  });
});
