import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { adminClient, createSignedInTestUser, deleteTestUser, hasServiceRoleKey } from "./helpers";

// Automated version of the live-database verification performed while building
// Factory Milestone 2 (Processing/Cutting). Includes a regression test for a
// real bug found during that verification: start_processing_job/
// cancel_processing_job originally checked has_permission()/has_capability()
// but never has_branch_access() -- since both are SECURITY DEFINER, RLS on
// processing_jobs does not apply inside their body, so a branch-B-scoped user
// could start/cancel a branch-A job outright (only blocked from *seeing* it via
// a plain select). Fixed in migration 0040. Requires SUPABASE_SERVICE_ROLE_KEY
// (test setup only, see tests/rls/helpers.ts).
describe.skipIf(!hasServiceRoleKey)("Factory Milestone 2: Processing/Cutting", () => {
  let owner: { userId: string; client: ReturnType<typeof adminClient> };
  let branchBUser: { userId: string; client: ReturnType<typeof adminClient> };
  let tenantId: string;
  let branchAId: string;
  let branchBId: string;
  let warehouseAId: string;
  let productId: string;
  let blockUomId: string;

  async function makeBlock() {
    const admin = adminClient();
    const suffix = Date.now() + Math.random();
    const { data: unit } = await admin
      .from("inventory_units")
      .insert({
        tenant_id: tenantId, product_id: productId, unit_code: `BLK-${suffix}`,
        unit_type: "block", status: "in_stock",
      })
      .select("id").single();
    return unit!.id as string;
  }

  async function makeDraftJob(inputUnitId: string, branchId: string, warehouseId: string, jobNumber: string) {
    const { data: job, error } = await owner.client
      .from("processing_jobs")
      .insert({ tenant_id: tenantId, job_number: jobNumber, input_unit_id: inputUnitId, branch_id: branchId, warehouse_id: warehouseId, stage: "cutting" })
      .select("id").single();
    return { id: job?.id as string | undefined, error };
  }

  beforeAll(async () => {
    const suffix = Date.now();
    owner = await createSignedInTestUser(`pj-owner-${suffix}@stonevora.test`, "test-password-123");
    branchBUser = await createSignedInTestUser(`pj-branchB-${suffix}@stonevora.test`, "test-password-123");

    const { data: tId } = await owner.client.rpc("create_tenant_for_user", {
      p_tenant_name: `Processing Job Test ${suffix}`,
      p_tenant_slug: `processing-job-test-${suffix}`,
    });
    tenantId = tId!;

    const admin = adminClient();
    const { data: capability } = await admin.from("business_capabilities").select("id").eq("code", "block_slab_factory").single();
    await admin.from("tenant_capabilities").insert({ tenant_id: tenantId, capability_id: capability!.id });

    const { data: block } = await admin.from("uom").select("id").eq("code", "BLOCK").is("tenant_id", null).single();
    blockUomId = block!.id;

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
      .insert({ tenant_id: tenantId, sku: "BLK-PJ-01", name: "Test Block", inventory_tracking_mode: "unit", base_uom_id: blockUomId })
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

  test("start_processing_job: moves job to in_progress and input block to processing", async () => {
    const blockId = await makeBlock();
    const { id: jobId, error: insertError } = await makeDraftJob(blockId, branchAId, warehouseAId, "JOB-START");
    expect(insertError).toBeNull();

    const { error } = await owner.client.rpc("start_processing_job", { p_processing_job_id: jobId! });
    expect(error).toBeNull();

    const { data: job } = await owner.client.from("processing_jobs").select("status, started_at").eq("id", jobId!).single();
    expect(job?.status).toBe("in_progress");
    expect(job?.started_at).not.toBeNull();

    const { data: unit } = await owner.client.from("inventory_units").select("status").eq("id", blockId).single();
    expect(unit?.status).toBe("processing");
  });

  test("cancel_processing_job: restores input block to in_stock when cancelling an in_progress job", async () => {
    const blockId = await makeBlock();
    const { id: jobId } = await makeDraftJob(blockId, branchAId, warehouseAId, "JOB-CANCEL");
    await owner.client.rpc("start_processing_job", { p_processing_job_id: jobId! });

    const { error } = await owner.client.rpc("cancel_processing_job", { p_processing_job_id: jobId! });
    expect(error).toBeNull();

    const { data: job } = await owner.client.from("processing_jobs").select("status, cancelled_at").eq("id", jobId!).single();
    expect(job?.status).toBe("cancelled");
    expect(job?.cancelled_at).not.toBeNull();

    const { data: unit } = await owner.client.from("inventory_units").select("status").eq("id", blockId).single();
    expect(unit?.status).toBe("in_stock");
  });

  test("a second draft/in_progress job cannot be created against the same block (partial unique index)", async () => {
    const blockId = await makeBlock();
    const first = await makeDraftJob(blockId, branchAId, warehouseAId, "JOB-DUP-1");
    expect(first.error).toBeNull();

    const second = await makeDraftJob(blockId, branchAId, warehouseAId, "JOB-DUP-2");
    expect(second.error).not.toBeNull();
  });

  test("start_processing_job rejects when block_slab_factory capability is disabled", async () => {
    const admin = adminClient();
    const { data: capability } = await admin.from("business_capabilities").select("id").eq("code", "block_slab_factory").single();
    await admin.from("tenant_capabilities").delete().eq("tenant_id", tenantId).eq("capability_id", capability!.id);

    const blockId = await makeBlock();
    const { id: jobId } = await makeDraftJob(blockId, branchAId, warehouseAId, "JOB-NOCAP");
    const { error } = await owner.client.rpc("start_processing_job", { p_processing_job_id: jobId! });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/Block\/Slab Factory capability is not enabled/);

    await admin.from("tenant_capabilities").insert({ tenant_id: tenantId, capability_id: capability!.id });
  });

  // Regression test for the branch-scoping bug found live during Milestone 2
  // verification and fixed in migration 0040.
  test("branch scoping: a branch-B-scoped user cannot start or cancel a branch-A job", async () => {
    const blockId = await makeBlock();
    const { id: jobId } = await makeDraftJob(blockId, branchAId, warehouseAId, "JOB-BRANCH-SCOPE");

    // Correctly invisible via RLS on a plain select.
    const { data: seenByBranchB } = await branchBUser.client.from("processing_jobs").select("id").eq("id", jobId!);
    expect(seenByBranchB).toEqual([]);

    // The bug: the RPC itself must independently reject this, not rely on RLS.
    const { error: startError } = await branchBUser.client.rpc("start_processing_job", { p_processing_job_id: jobId! });
    expect(startError).not.toBeNull();
    expect(startError?.message).toMatch(/do not have access to the branch/);

    const { error: startOk } = await owner.client.rpc("start_processing_job", { p_processing_job_id: jobId! });
    expect(startOk).toBeNull();

    const { error: cancelError } = await branchBUser.client.rpc("cancel_processing_job", { p_processing_job_id: jobId! });
    expect(cancelError).not.toBeNull();
    expect(cancelError?.message).toMatch(/do not have access to the branch/);
  });
});
