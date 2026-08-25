import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const ACTIVE_TENANT_COOKIE = "active_tenant_id";

export type TenantMembership = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
};

// Lists every tenant the signed-in user actually belongs to (RLS-scoped: this is
// exactly the set is_tenant_member() would say yes to, never a foreign tenant).
export async function listUserTenants(): Promise<TenantMembership[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_tenants")
    .select("tenant_id, tenants!inner(id, name, slug)")
    .eq("is_active", true);

  if (error || !data) return [];

  return data.map((row) => ({
    tenantId: row.tenants.id,
    tenantName: row.tenants.name,
    tenantSlug: row.tenants.slug,
  }));
}

// Resolves which tenant the current request should operate against.
//
// The active_tenant_id cookie is a UX convenience only — it picks *which* of the
// user's real memberships to default to. It is never trusted as the security
// boundary: every downstream query still runs through the RLS-scoped server client
// and is independently checked by is_tenant_member()/has_permission() in Postgres,
// so a stale or tampered cookie value can at most cause a wrong "no tenant selected"
// redirect, never cross-tenant data access.
export async function getActiveTenant(): Promise<TenantMembership | null> {
  const memberships = await listUserTenants();
  if (memberships.length === 0) return null;

  const cookieStore = await cookies();
  const cookieTenantId = cookieStore.get(ACTIVE_TENANT_COOKIE)?.value;

  const match = cookieTenantId
    ? memberships.find((m) => m.tenantId === cookieTenantId)
    : undefined;

  if (match) return match;
  if (memberships.length === 1) return memberships[0];

  return null; // ambiguous — caller should redirect to /select-tenant
}

// For use at the top of (app) pages/layouts: resolves the active tenant or redirects
// to /login (no session), /onboarding (zero memberships), or /select-tenant
// (ambiguous — more than one membership and no cookie match).
export async function requireActiveTenant(): Promise<TenantMembership> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const memberships = await listUserTenants();
  if (memberships.length === 0) redirect("/onboarding");

  const tenant = await getActiveTenant();
  if (!tenant) redirect("/select-tenant");

  return tenant;
}
