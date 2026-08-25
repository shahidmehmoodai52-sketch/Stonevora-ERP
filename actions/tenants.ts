"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_TENANT_COOKIE } from "@/lib/tenant/getActiveTenant";

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || "company"}-${suffix}`;
}

// Creates a brand-new tenant for the current user via the create_tenant_for_user
// security-definer RPC (see supabase/migrations/0012_tenant_onboarding.sql). This
// is the one legitimate way to write tenants/roles/user_tenants before any
// user_tenants row exists for this user — no service-role key involved.
export async function createTenantAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Company name is required" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tenantId, error } = await supabase.rpc("create_tenant_for_user", {
    p_tenant_name: name,
    p_tenant_slug: slugify(name),
  });

  if (error || !tenantId) {
    return { error: error?.message ?? "Failed to create company" };
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_TENANT_COOKIE, tenantId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  redirect("/products");
}

// Sets which of the user's own tenant memberships subsequent requests default to.
// Purely a UX convenience — see lib/tenant/getActiveTenant.ts for why this cookie
// is never the security boundary.
export async function selectTenantAction(tenantId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_TENANT_COOKIE, tenantId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  redirect("/products");
}
