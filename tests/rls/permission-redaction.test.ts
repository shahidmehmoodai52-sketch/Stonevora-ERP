import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { adminClient, createSignedInTestUser, deleteTestUser, hasServiceRoleKey } from "./helpers";

// Verifies products_secure redacts cost_price/standard_margin_pct per the viewer's
// own view_cost/view_profit grants (not per app-layer logic), and that the audit
// trigger captures accurate before/after snapshots. Requires SUPABASE_SERVICE_ROLE_KEY
// (test setup only, same as tenant-isolation.test.ts).
describe.skipIf(!hasServiceRoleKey)("permission-based column redaction & audit trail", () => {
  let owner: { userId: string; client: ReturnType<typeof adminClient> };
  let salesperson: { userId: string; client: ReturnType<typeof adminClient> };
  let tenantId: string;
  let productId: string;

  beforeAll(async () => {
    const suffix = Date.now();
    owner = await createSignedInTestUser(`redact-owner-${suffix}@stonevora.test`, "test-password-123");
    salesperson = await createSignedInTestUser(
      `redact-sales-${suffix}@stonevora.test`,
      "test-password-123"
    );

    const { data: tId, error: tError } = await owner.client.rpc("create_tenant_for_user", {
      p_tenant_name: `Redaction Test Tenant ${suffix}`,
      p_tenant_slug: `redaction-test-${suffix}`,
    });
    if (tError || !tId) throw tError;
    tenantId = tId;

    const admin = adminClient();
    const { data: salespersonRole } = await admin
      .from("roles")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("code", "salesperson")
      .single();

    await admin.from("user_tenants").insert({ user_id: salesperson.userId, tenant_id: tenantId });
    await admin
      .from("user_roles")
      .insert({ user_id: salesperson.userId, tenant_id: tenantId, role_id: salespersonRole!.id });

    const { data: uom } = await admin.from("uom").select("id").eq("code", "PCS").is("tenant_id", null).single();

    const { data: product, error: productError } = await owner.client
      .from("products")
      .insert({
        tenant_id: tenantId,
        sku: "REDACT-SKU",
        name: "Redaction test slab",
        base_uom_id: uom!.id,
        cost_price: 999.99,
        standard_margin_pct: 33.3,
      })
      .select("id")
      .single();
    if (productError || !product) throw productError;
    productId = product.id;
  });

  afterAll(async () => {
    const admin = adminClient();
    await admin.from("tenants").delete().eq("id", tenantId);
    await deleteTestUser(owner.userId);
    await deleteTestUser(salesperson.userId);
  });

  test("owner sees cost and margin", async () => {
    const { data } = await owner.client
      .from("products_secure")
      .select("cost_price, standard_margin_pct")
      .eq("id", productId)
      .single();
    expect(data?.cost_price).not.toBeNull();
    expect(data?.standard_margin_pct).not.toBeNull();
  });

  test("salesperson sees null cost and margin, but the row itself", async () => {
    const { data } = await salesperson.client
      .from("products_secure")
      .select("sku, cost_price, standard_margin_pct")
      .eq("id", productId)
      .single();
    expect(data?.sku).toBe("REDACT-SKU");
    expect(data?.cost_price).toBeNull();
    expect(data?.standard_margin_pct).toBeNull();
  });

  test("audit_log captures accurate before/after snapshots", async () => {
    await owner.client.from("products").update({ name: "Renamed slab" }).eq("id", productId);

    const admin = adminClient();
    const { data: auditRows } = await admin
      .from("audit_log")
      .select("action, old_data, new_data")
      .eq("table_name", "products")
      .eq("record_id", productId)
      .eq("action", "update")
      .order("changed_at", { ascending: false })
      .limit(1);

    expect(auditRows).toHaveLength(1);
    expect((auditRows![0].old_data as { name: string }).name).toBe("Redaction test slab");
    expect((auditRows![0].new_data as { name: string }).name).toBe("Renamed slab");
  });
});
