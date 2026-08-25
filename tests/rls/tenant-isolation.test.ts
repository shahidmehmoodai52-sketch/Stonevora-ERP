import { describe, test, expect, beforeAll, afterAll } from "vitest";
import {
  adminClient,
  createSignedInTestUser,
  deleteTestUser,
  hasServiceRoleKey,
} from "./helpers";

// Verifies tenant isolation is enforced by Postgres Row-Level Security itself, not
// just by the app's own query filters. Setup uses the admin (service-role) client
// only to create real confirmed auth users; every assertion below runs through an
// anon-key client signed in as that real user — using the service-role client for
// assertions would trivially bypass RLS and prove nothing.
//
// Requires SUPABASE_SERVICE_ROLE_KEY to be set (test setup only — the app itself
// never needs it for this flow, see actions/tenants.ts).
describe.skipIf(!hasServiceRoleKey)("tenant isolation (RLS)", () => {
  let userA: { userId: string; client: ReturnType<typeof adminClient> };
  let userB: { userId: string; client: ReturnType<typeof adminClient> };
  let tenantAId: string;
  let tenantBId: string;
  let productBId: string;

  beforeAll(async () => {
    const suffix = Date.now();
    userA = await createSignedInTestUser(`rls-a-${suffix}@stonevora.test`, "test-password-123");
    userB = await createSignedInTestUser(`rls-b-${suffix}@stonevora.test`, "test-password-123");

    const { data: aId, error: aError } = await userA.client.rpc("create_tenant_for_user", {
      p_tenant_name: `RLS Test Tenant A ${suffix}`,
      p_tenant_slug: `rls-test-a-${suffix}`,
    });
    if (aError || !aId) throw aError;
    tenantAId = aId;

    const { data: bId, error: bError } = await userB.client.rpc("create_tenant_for_user", {
      p_tenant_name: `RLS Test Tenant B ${suffix}`,
      p_tenant_slug: `rls-test-b-${suffix}`,
    });
    if (bError || !bId) throw bError;
    tenantBId = bId;

    const { data: uom } = await adminClient()
      .from("uom")
      .select("id")
      .eq("code", "PCS")
      .is("tenant_id", null)
      .single();

    const { data: product, error: productError } = await userB.client
      .from("products")
      .insert({ tenant_id: tenantBId, sku: "RLS-B-SKU", name: "Tenant B secret", base_uom_id: uom!.id })
      .select("id")
      .single();
    if (productError || !product) throw productError;
    productBId = product.id;
  });

  afterAll(async () => {
    const admin = adminClient();
    await admin.from("tenants").delete().in("id", [tenantAId, tenantBId]);
    await deleteTestUser(userA.userId);
    await deleteTestUser(userB.userId);
  });

  test("cross-tenant insert is rejected", async () => {
    const { error } = await userA.client
      .from("products")
      .insert({ tenant_id: tenantBId, sku: "HACK-SKU", name: "Hacked", base_uom_id: null as never });
    expect(error).not.toBeNull();
  });

  test("cross-tenant select returns no rows, even though the row exists", async () => {
    const { data: asA } = await userA.client
      .from("products")
      .select("id")
      .eq("tenant_id", tenantBId);
    expect(asA ?? []).toHaveLength(0);

    const { data: viaAdmin } = await adminClient()
      .from("products")
      .select("id")
      .eq("id", productBId);
    expect(viaAdmin).toHaveLength(1);
  });

  test("cross-tenant update by known id affects zero rows", async () => {
    const { data } = await userA.client
      .from("products")
      .update({ name: "HACKED" })
      .eq("id", productBId)
      .select("id");
    expect(data ?? []).toHaveLength(0);
  });

  test("cross-tenant delete by known id affects zero rows", async () => {
    const { data } = await userA.client
      .from("products")
      .delete()
      .eq("id", productBId)
      .select("id");
    expect(data ?? []).toHaveLength(0);

    const { data: stillExists } = await adminClient()
      .from("products")
      .select("name")
      .eq("id", productBId)
      .single();
    expect(stillExists?.name).toBe("Tenant B secret");
  });
});
