import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { adminClient, createSignedInTestUser, deleteTestUser, hasServiceRoleKey } from "./helpers";

// Automated version of the live-database verification performed while building
// Phase 3 (Stone Fabrication/Projects mode). Requires SUPABASE_SERVICE_ROLE_KEY
// (test setup only, see tests/rls/helpers.ts).
describe.skipIf(!hasServiceRoleKey)("Phase 3: Stone Fabrication/Projects", () => {
  let owner: { userId: string; client: ReturnType<typeof adminClient> };
  let branchBUser: { userId: string; client: ReturnType<typeof adminClient> };
  let factoryManager: { userId: string; client: ReturnType<typeof adminClient> };
  let salesperson: { userId: string; client: ReturnType<typeof adminClient> };
  let tenantId: string;
  let branchAId: string;
  let branchBId: string;
  let warehouseAId: string;
  let customerId: string;
  let productId: string;
  let blockUomId: string;
  let cmUomId: string;
  let sqftUomId: string;
  let m3UomId: string;

  async function makeCostedSlab(suffix: string, blockCost = 10000): Promise<{ slabId: string; area: number; cost: number }> {
    const admin = adminClient();
    const { data: block } = await admin
      .from("inventory_units")
      .insert({ tenant_id: tenantId, product_id: productId, unit_code: `BLK-${suffix}`, unit_type: "block", status: "in_stock", volume: 5, volume_uom_id: m3UomId, cost: blockCost })
      .select("id").single();

    const { data: job } = await owner.client
      .from("processing_jobs")
      .insert({ tenant_id: tenantId, job_number: `JOB-${suffix}`, input_unit_id: block!.id, branch_id: branchAId, warehouse_id: warehouseAId, stage: "cutting" })
      .select("id").single();
    await owner.client.rpc("start_processing_job", { p_processing_job_id: job!.id });
    const { data: ids } = await owner.client.rpc("complete_processing_job", {
      p_processing_job_id: job!.id,
      p_slabs: [{ length: 200, width: 150, thickness: 2, dimension_uom_id: cmUomId, area_uom_id: sqftUomId }] as never,
    });
    const slabId = ids![0] as string;
    await owner.client.rpc("record_qc_inspection", { p_inventory_unit_id: slabId, p_outcome: "passed" });
    await owner.client.rpc("record_processing_costs", { p_processing_job_id: job!.id, p_processing_cost: 0, p_overhead_cost: 0 });

    const { data: unit } = await owner.client.from("inventory_units").select("actual_area, cost").eq("id", slabId).single();
    return { slabId, area: Number(unit!.actual_area), cost: Number(unit!.cost) };
  }

  async function makeProject(suffix: string, branchId = branchAId) {
    const { data: project } = await owner.client
      .from("projects")
      .insert({ tenant_id: tenantId, branch_id: branchId, project_number: `PROJ-${suffix}`, customer_id: customerId, warehouse_id: warehouseAId })
      .select("id").single();
    return project!.id as string;
  }

  beforeAll(async () => {
    const suffix = Date.now();
    owner = await createSignedInTestUser(`p3-owner-${suffix}@stonevora.test`, "test-password-123");
    branchBUser = await createSignedInTestUser(`p3-branchb-${suffix}@stonevora.test`, "test-password-123");
    factoryManager = await createSignedInTestUser(`p3-factorymgr-${suffix}@stonevora.test`, "test-password-123");
    salesperson = await createSignedInTestUser(`p3-salesperson-${suffix}@stonevora.test`, "test-password-123");

    const { data: tId } = await owner.client.rpc("create_tenant_for_user", {
      p_tenant_name: `Phase3 Test ${suffix}`,
      p_tenant_slug: `phase3-test-${suffix}`,
    });
    tenantId = tId!;

    const admin = adminClient();
    const { data: capabilities } = await admin.from("business_capabilities").select("id, code").in("code", ["stone_fabrication", "block_slab_factory"]);
    await admin.from("tenant_capabilities").insert(capabilities!.map((c) => ({ tenant_id: tenantId, capability_id: c.id })));

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

    const { data: customer } = await owner.client
      .from("customers").insert({ tenant_id: tenantId, code: "CUST1", name: "Test Homeowner" }).select("id").single();
    customerId = customer!.id;

    const { data: product } = await owner.client
      .from("products")
      .insert({ tenant_id: tenantId, sku: "GRANITE-P3-01", name: "Test Granite Block", inventory_tracking_mode: "unit", base_uom_id: blockUomId })
      .select("id").single();
    productId = product!.id;

    const { data: salesManagerRole } = await admin.from("roles").select("id").eq("tenant_id", tenantId).eq("code", "sales_manager").single();
    const { data: factoryManagerRole } = await admin.from("roles").select("id").eq("tenant_id", tenantId).eq("code", "factory_manager").single();
    const { data: salespersonRole } = await admin.from("roles").select("id").eq("tenant_id", tenantId).eq("code", "salesperson").single();
    await admin.from("user_tenants").insert([
      { user_id: branchBUser.userId, tenant_id: tenantId },
      { user_id: factoryManager.userId, tenant_id: tenantId },
      { user_id: salesperson.userId, tenant_id: tenantId },
    ]);
    await admin.from("user_roles").insert([
      { user_id: branchBUser.userId, tenant_id: tenantId, role_id: salesManagerRole!.id, branch_id: branchBId },
      { user_id: factoryManager.userId, tenant_id: tenantId, role_id: factoryManagerRole!.id },
      { user_id: salesperson.userId, tenant_id: tenantId, role_id: salespersonRole!.id },
    ]);
  });

  afterAll(async () => {
    const admin = adminClient();
    await admin.from("audit_log").delete().in("changed_by", [owner.userId, branchBUser.userId, factoryManager.userId, salesperson.userId]);
    await admin.from("tenants").delete().eq("id", tenantId);
    await deleteTestUser(owner.userId);
    await deleteTestUser(branchBUser.userId);
    await deleteTestUser(factoryManager.userId);
    await deleteTestUser(salesperson.userId);
  });

  test("full lifecycle: add materials, complete with labor/overhead, invoice by area, redact margin per role", async () => {
    const slab1 = await makeCostedSlab(`${Date.now()}-A`, 10000);
    const slab2 = await makeCostedSlab(`${Date.now()}-B`, 8000);
    const projectId = await makeProject(`${Date.now()}-FULL`);

    const { error: add1 } = await owner.client.rpc("add_project_material", { p_project_id: projectId, p_inventory_unit_id: slab1.slabId });
    expect(add1).toBeNull();
    const { error: add2 } = await owner.client.rpc("add_project_material", { p_project_id: projectId, p_inventory_unit_id: slab2.slabId });
    expect(add2).toBeNull();

    const { data: afterAdd } = await owner.client.from("projects").select("material_cost").eq("id", projectId).single();
    expect(Number(afterAdd?.material_cost)).toBeCloseTo(slab1.cost + slab2.cost, 4);

    const { error: completeErr } = await owner.client.rpc("complete_project", { p_project_id: projectId, p_labor_cost: 1000, p_overhead_cost: 200 });
    expect(completeErr).toBeNull();

    const { data: completed } = await owner.client.from("projects").select("total_cost, status").eq("id", projectId).single();
    const expectedTotal = slab1.cost + slab2.cost + 1000 + 200;
    expect(Number(completed?.total_cost)).toBeCloseTo(expectedTotal, 4);
    expect(completed?.status).toBe("completed");

    const { data: invoiceId, error: invoiceErr } = await owner.client.rpc("generate_project_invoice", {
      p_project_id: projectId,
      p_invoice_number: `INV-${Date.now()}`,
      p_material_prices: [
        { inventory_unit_id: slab1.slabId, unit_price: 100 },
        { inventory_unit_id: slab2.slabId, unit_price: 90 },
      ] as never,
    });
    expect(invoiceErr).toBeNull();

    const totalArea = slab1.area + slab2.area;
    const expectedCostPerArea = expectedTotal / totalArea;
    const { data: lines } = await owner.client.from("sales_invoice_lines").select("quantity, unit_price, unit_cost, line_total").eq("sales_invoice_id", invoiceId!);
    expect(lines).toHaveLength(2);
    for (const line of lines!) {
      expect(Number(line.unit_cost)).toBeCloseTo(expectedCostPerArea, 2);
      expect(Number(line.line_total)).toBeCloseTo(Number(line.quantity) * Number(line.unit_price), 4);
    }

    // Margin is visible to the owner, redacted for a role without view_cost/view_profit.
    const { data: ownerLines } = await owner.client.from("sales_invoice_lines_secure").select("margin").eq("sales_invoice_id", invoiceId!);
    expect(ownerLines!.every((l) => l.margin !== null)).toBe(true);
    const { data: salespersonLines } = await salesperson.client.from("sales_invoice_lines_secure").select("margin, unit_cost").eq("sales_invoice_id", invoiceId!);
    expect(salespersonLines!.every((l) => l.margin === null && l.unit_cost === null)).toBe(true);
  });

  test("add_project_material rejects a block, a non-in_stock unit, and an uncosted unit; remove_project_material undoes cleanly", async () => {
    const projectId = await makeProject(`${Date.now()}-VALID`);
    const slab = await makeCostedSlab(`${Date.now()}-VALID`, 5000);

    const admin = adminClient();
    const { data: block } = await admin
      .from("inventory_units")
      .insert({ tenant_id: tenantId, product_id: productId, unit_code: `BLK-VALID-${Date.now()}`, unit_type: "block", status: "in_stock", cost: 1000 })
      .select("id").single();
    const { error: blockErr } = await owner.client.rpc("add_project_material", { p_project_id: projectId, p_inventory_unit_id: block!.id });
    expect(blockErr?.message).toMatch(/Only a slab or remnant/);

    const { data: uncostedSlab } = await admin
      .from("inventory_units")
      .insert({ tenant_id: tenantId, product_id: productId, unit_code: `SLAB-NOCOST-${Date.now()}`, unit_type: "slab", status: "in_stock", cost: null })
      .select("id").single();
    const { error: noCostErr } = await owner.client.rpc("add_project_material", { p_project_id: projectId, p_inventory_unit_id: uncostedSlab!.id });
    expect(noCostErr?.message).toMatch(/no recorded cost/);

    const { error: addErr } = await owner.client.rpc("add_project_material", { p_project_id: projectId, p_inventory_unit_id: slab.slabId });
    expect(addErr).toBeNull();
    const { error: reAddErr } = await owner.client.rpc("add_project_material", { p_project_id: projectId, p_inventory_unit_id: slab.slabId });
    expect(reAddErr?.message).toMatch(/not available to consume/);

    const { error: removeErr } = await owner.client.rpc("remove_project_material", { p_project_id: projectId, p_inventory_unit_id: slab.slabId });
    expect(removeErr).toBeNull();
    const { data: released } = await owner.client.from("inventory_units").select("status, consumed_by_project_id").eq("id", slab.slabId).single();
    expect(released?.status).toBe("in_stock");
    expect(released?.consumed_by_project_id).toBeNull();
    const { data: afterRemove } = await owner.client.from("projects").select("material_cost").eq("id", projectId).single();
    expect(Number(afterRemove?.material_cost)).toBeCloseTo(0, 4);
  });

  test("branch scoping: a Branch-B-scoped user cannot add materials to, complete, or cancel a Branch-A project", async () => {
    const projectId = await makeProject(`${Date.now()}-BRANCH`);
    const slab = await makeCostedSlab(`${Date.now()}-BRANCH`, 3000);

    const { error: addErr } = await branchBUser.client.rpc("add_project_material", { p_project_id: projectId, p_inventory_unit_id: slab.slabId });
    expect(addErr?.message).toMatch(/do not have access to the branch/);

    const { error: completeErr } = await branchBUser.client.rpc("complete_project", { p_project_id: projectId, p_labor_cost: 100, p_overhead_cost: 0 });
    expect(completeErr?.message).toMatch(/do not have access to the branch/);

    const { error: cancelErr } = await branchBUser.client.rpc("cancel_project", { p_project_id: projectId });
    expect(cancelErr?.message).toMatch(/do not have access to the branch/);
  });

  test("cancel_project releases consumed materials back to in_stock and is blocked once completed", async () => {
    const projectId = await makeProject(`${Date.now()}-CANCEL`);
    const slab = await makeCostedSlab(`${Date.now()}-CANCEL`, 4000);
    await owner.client.rpc("add_project_material", { p_project_id: projectId, p_inventory_unit_id: slab.slabId });

    const { error: cancelErr } = await owner.client.rpc("cancel_project", { p_project_id: projectId });
    expect(cancelErr).toBeNull();
    const { data: released } = await owner.client.from("inventory_units").select("status, consumed_by_project_id").eq("id", slab.slabId).single();
    expect(released?.status).toBe("in_stock");
    expect(released?.consumed_by_project_id).toBeNull();

    const completedProjectId = await makeProject(`${Date.now()}-NOCANCEL`);
    const slab2 = await makeCostedSlab(`${Date.now()}-NOCANCEL`, 4000);
    await owner.client.rpc("add_project_material", { p_project_id: completedProjectId, p_inventory_unit_id: slab2.slabId });
    await owner.client.rpc("complete_project", { p_project_id: completedProjectId, p_labor_cost: 0, p_overhead_cost: 0 });
    const { error: noCancelErr } = await owner.client.rpc("cancel_project", { p_project_id: completedProjectId });
    expect(noCancelErr?.message).toMatch(/completed project cannot be cancelled/);
  });

  test("generate_project_invoice rejects an incomplete project, double-invoicing, and a missing unit_price; separates production from billing", async () => {
    const projectId = await makeProject(`${Date.now()}-INV`);
    const slab = await makeCostedSlab(`${Date.now()}-INV`, 5000);

    // factory_manager has 'project'.'edit' (can add materials/complete) but not
    // 'sales'.'create' -- deliberately unable to invoice their own completed job.
    const { error: fmAddErr } = await factoryManager.client.rpc("add_project_material", { p_project_id: projectId, p_inventory_unit_id: slab.slabId });
    expect(fmAddErr).toBeNull();

    const { error: draftInvoiceErr } = await owner.client.rpc("generate_project_invoice", {
      p_project_id: projectId, p_invoice_number: "INV-DRAFT-REJECT", p_material_prices: [] as never,
    });
    expect(draftInvoiceErr?.message).toMatch(/must be completed before it can be invoiced/);

    const { error: fmCompleteErr } = await factoryManager.client.rpc("complete_project", { p_project_id: projectId, p_labor_cost: 500, p_overhead_cost: 0 });
    expect(fmCompleteErr).toBeNull();

    const { error: fmInvoiceErr } = await factoryManager.client.rpc("generate_project_invoice", {
      p_project_id: projectId, p_invoice_number: "INV-FM-REJECT", p_material_prices: [{ inventory_unit_id: slab.slabId, unit_price: 80 }] as never,
    });
    expect(fmInvoiceErr?.message).toMatch(/Missing permission: sales.create/);

    const { error: missingPriceErr } = await owner.client.rpc("generate_project_invoice", {
      p_project_id: projectId, p_invoice_number: "INV-NOPRICE", p_material_prices: [] as never,
    });
    expect(missingPriceErr?.message).toMatch(/A unit_price must be supplied/);

    const { data: invoiceId, error: invoiceErr } = await owner.client.rpc("generate_project_invoice", {
      p_project_id: projectId, p_invoice_number: `INV-${Date.now()}`, p_material_prices: [{ inventory_unit_id: slab.slabId, unit_price: 80 }] as never,
    });
    expect(invoiceErr).toBeNull();
    expect(invoiceId).toBeTruthy();

    const { error: dupErr } = await owner.client.rpc("generate_project_invoice", {
      p_project_id: projectId, p_invoice_number: "INV-DUP", p_material_prices: [{ inventory_unit_id: slab.slabId, unit_price: 80 }] as never,
    });
    expect(dupErr?.message).toMatch(/already been invoiced/);
  });

  test("rejects project actions when the stone_fabrication capability is disabled", async () => {
    const projectId = await makeProject(`${Date.now()}-NOCAP`);
    const slab = await makeCostedSlab(`${Date.now()}-NOCAP`, 2000);

    const admin = adminClient();
    const { data: capability } = await admin.from("business_capabilities").select("id").eq("code", "stone_fabrication").single();
    await admin.from("tenant_capabilities").delete().eq("tenant_id", tenantId).eq("capability_id", capability!.id);

    const { error: addErr } = await owner.client.rpc("add_project_material", { p_project_id: projectId, p_inventory_unit_id: slab.slabId });
    expect(addErr?.message).toMatch(/Stone Fabrication capability is not enabled/);

    await admin.from("tenant_capabilities").insert({ tenant_id: tenantId, capability_id: capability!.id });
  });
});
