import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { adminClient, createSignedInTestUser, deleteTestUser, hasServiceRoleKey } from "./helpers";

// Automated version of the live-database verification performed while building
// Factory Milestone 5 (QC). Requires SUPABASE_SERVICE_ROLE_KEY (test setup
// only, see tests/rls/helpers.ts).
describe.skipIf(!hasServiceRoleKey)("Factory Milestone 5: QC", () => {
  let owner: { userId: string; client: ReturnType<typeof adminClient> };
  let operatorUser: { userId: string; client: ReturnType<typeof adminClient> };
  let qcManagerUser: { userId: string; client: ReturnType<typeof adminClient> };
  let branchBQcUser: { userId: string; client: ReturnType<typeof adminClient> };
  let tenantId: string;
  let branchAId: string;
  let branchBId: string;
  let warehouseAId: string;
  let productId: string;
  let blockUomId: string;
  let cmUomId: string;
  let sqftUomId: string;
  let m3UomId: string;

  async function makeBlock(unitCode: string) {
    const admin = adminClient();
    const { data: unit } = await admin
      .from("inventory_units")
      .insert({ tenant_id: tenantId, product_id: productId, unit_code: unitCode, unit_type: "block", status: "in_stock", volume: 1, volume_uom_id: m3UomId })
      .select("id").single();
    return unit!.id as string;
  }

  async function makePendingQcSlab(jobNumberSuffix: string) {
    const blockId = await makeBlock(`BLK-${Date.now()}-${jobNumberSuffix}`);
    const { data: job } = await owner.client
      .from("processing_jobs")
      .insert({ tenant_id: tenantId, job_number: `JOB-${Date.now()}-${jobNumberSuffix}`, input_unit_id: blockId, branch_id: branchAId, warehouse_id: warehouseAId, stage: "cutting" })
      .select("id").single();
    await owner.client.rpc("start_processing_job", { p_processing_job_id: job!.id });
    const { data: ids } = await owner.client.rpc("complete_processing_job", {
      p_processing_job_id: job!.id,
      p_slabs: [{ length: 100, width: 100, thickness: 2, dimension_uom_id: cmUomId, area_uom_id: sqftUomId, quality_grade: "B" }],
    });
    return (ids as string[])[0];
  }

  beforeAll(async () => {
    const suffix = Date.now();
    owner = await createSignedInTestUser(`qc-owner-${suffix}@stonevora.test`, "test-password-123");
    operatorUser = await createSignedInTestUser(`qc-operator-${suffix}@stonevora.test`, "test-password-123");
    qcManagerUser = await createSignedInTestUser(`qc-manager-${suffix}@stonevora.test`, "test-password-123");
    branchBQcUser = await createSignedInTestUser(`qc-branchb-${suffix}@stonevora.test`, "test-password-123");

    const { data: tId } = await owner.client.rpc("create_tenant_for_user", {
      p_tenant_name: `QC Test ${suffix}`,
      p_tenant_slug: `qc-test-${suffix}`,
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
      .insert({ tenant_id: tenantId, sku: "BLK-QC-01", name: "Test Block", inventory_tracking_mode: "unit", base_uom_id: blockUomId })
      .select("id").single();
    productId = product!.id;

    const { data: operatorRole } = await admin.from("roles").select("id").eq("tenant_id", tenantId).eq("code", "production_operator").single();
    await admin.from("user_tenants").insert({ user_id: operatorUser.userId, tenant_id: tenantId });
    await admin.from("user_roles").insert({ user_id: operatorUser.userId, tenant_id: tenantId, role_id: operatorRole!.id, branch_id: branchAId });

    const { data: qcRole } = await admin.from("roles").select("id").eq("tenant_id", tenantId).eq("code", "qc_manager").single();
    await admin.from("user_tenants").insert({ user_id: qcManagerUser.userId, tenant_id: tenantId });
    await admin.from("user_roles").insert({ user_id: qcManagerUser.userId, tenant_id: tenantId, role_id: qcRole!.id, branch_id: branchAId });

    await admin.from("user_tenants").insert({ user_id: branchBQcUser.userId, tenant_id: tenantId });
    await admin.from("user_roles").insert({ user_id: branchBQcUser.userId, tenant_id: tenantId, role_id: qcRole!.id, branch_id: branchBId });
  });

  afterAll(async () => {
    const admin = adminClient();
    await admin.from("audit_log").delete().in("changed_by", [owner.userId, operatorUser.userId, qcManagerUser.userId, branchBQcUser.userId]);
    await admin.from("tenants").delete().eq("id", tenantId);
    await deleteTestUser(owner.userId);
    await deleteTestUser(operatorUser.userId);
    await deleteTestUser(qcManagerUser.userId);
    await deleteTestUser(branchBQcUser.userId);
  });

  test("complete_processing_job now lands output units in pending_qc, not in_stock", async () => {
    const blockId = await makeBlock(`BLK-${Date.now()}-DEFAULT`);
    const { data: job } = await owner.client
      .from("processing_jobs")
      .insert({ tenant_id: tenantId, job_number: `JOB-${Date.now()}-DEFAULT`, input_unit_id: blockId, branch_id: branchAId, warehouse_id: warehouseAId, stage: "cutting" })
      .select("id").single();
    await owner.client.rpc("start_processing_job", { p_processing_job_id: job!.id });
    const { data: ids } = await owner.client.rpc("complete_processing_job", {
      p_processing_job_id: job!.id,
      p_slabs: [{ length: 100, width: 100, thickness: 2, dimension_uom_id: cmUomId, area_uom_id: sqftUomId }],
    });
    const { data: unit } = await owner.client.from("inventory_units").select("status").eq("id", (ids as string[])[0]).single();
    expect(unit?.status).toBe("pending_qc");
  });

  test("passing QC moves the unit to in_stock and lets the confirmed grade override the operator's grade", async () => {
    const slabId = await makePendingQcSlab("PASS");
    const { data: inspectionId, error } = await owner.client.rpc("record_qc_inspection", {
      p_inventory_unit_id: slabId,
      p_outcome: "passed",
      p_confirmed_grade: "A+",
      p_notes: "No visible defects",
    });
    expect(error).toBeNull();
    expect(inspectionId).toBeTruthy();

    const { data: unit } = await owner.client.from("inventory_units").select("status, quality_grade").eq("id", slabId).single();
    expect(unit?.status).toBe("in_stock");
    expect(unit?.quality_grade).toBe("A+");

    const { data: inspection } = await owner.client.from("qc_inspections").select("outcome, confirmed_grade, notes, inspected_by").eq("id", inspectionId as string).single();
    expect(inspection?.outcome).toBe("passed");
    expect(inspection?.confirmed_grade).toBe("A+");
    expect(inspection?.inspected_by).toBe(owner.userId);
  });

  test("rejecting QC moves the unit to rejected -- excluded from in_stock -- and preserves the original grade", async () => {
    const slabId = await makePendingQcSlab("REJECT");
    const { error } = await owner.client.rpc("record_qc_inspection", {
      p_inventory_unit_id: slabId,
      p_outcome: "rejected",
      p_confirmed_grade: "D",
      p_defects: "Visible crack across full width",
    });
    expect(error).toBeNull();

    const { data: unit } = await owner.client.from("inventory_units").select("status, quality_grade").eq("id", slabId).single();
    expect(unit?.status).toBe("rejected");
    expect(unit?.quality_grade).toBe("B"); // operator's original grade, unchanged by rejection
  });

  test("a unit already resolved (in_stock/rejected) cannot be re-inspected", async () => {
    const slabId = await makePendingQcSlab("DOUBLE");
    await owner.client.rpc("record_qc_inspection", { p_inventory_unit_id: slabId, p_outcome: "passed" });

    const { error } = await owner.client.rpc("record_qc_inspection", { p_inventory_unit_id: slabId, p_outcome: "passed" });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/not pending QC/);
  });

  test("a block cannot be QC-inspected", async () => {
    const blockId = await makeBlock(`BLK-${Date.now()}-NOQC`);
    const { error } = await owner.client.rpc("record_qc_inspection", { p_inventory_unit_id: blockId, p_outcome: "passed" });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/Only a slab or remnant can be QC-inspected/);
  });

  test("permission: production_operator (no production.approve) is rejected; qc_manager (has approve) succeeds", async () => {
    const slabId = await makePendingQcSlab("PERM");

    const { error: operatorError } = await operatorUser.client.rpc("record_qc_inspection", { p_inventory_unit_id: slabId, p_outcome: "passed" });
    expect(operatorError).not.toBeNull();
    expect(operatorError?.message).toMatch(/Missing permission: production.approve/);

    const { error: qcError } = await qcManagerUser.client.rpc("record_qc_inspection", { p_inventory_unit_id: slabId, p_outcome: "passed" });
    expect(qcError).toBeNull();
  });

  test("branch scoping: a branch-B-scoped qc_manager cannot inspect a branch-A unit", async () => {
    const slabId = await makePendingQcSlab("BRANCH");
    const { error } = await branchBQcUser.client.rpc("record_qc_inspection", { p_inventory_unit_id: slabId, p_outcome: "passed" });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/do not have access to the branch/);
  });

  test("rejects QC when block_slab_factory capability is disabled", async () => {
    const slabId = await makePendingQcSlab("NOCAP");

    const admin = adminClient();
    const { data: capability } = await admin.from("business_capabilities").select("id").eq("code", "block_slab_factory").single();
    await admin.from("tenant_capabilities").delete().eq("tenant_id", tenantId).eq("capability_id", capability!.id);

    const { error } = await owner.client.rpc("record_qc_inspection", { p_inventory_unit_id: slabId, p_outcome: "passed" });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/Block\/Slab Factory capability is not enabled/);

    await admin.from("tenant_capabilities").insert({ tenant_id: tenantId, capability_id: capability!.id });
  });
});
