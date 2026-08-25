"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guard";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult = { error: string } | { success: true };

export async function updateTenantSettingsAction(formData: FormData): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "company_settings", "edit");

  const name = String(formData.get("name") ?? "").trim();
  const countryId = String(formData.get("countryId") ?? "") || null;
  const baseCurrencyId = String(formData.get("baseCurrencyId") ?? "") || null;
  const fiscalYearStartMonth = Number(formData.get("fiscalYearStartMonth") ?? 1);
  const timezone = String(formData.get("timezone") ?? "UTC");

  const supabase = await createClient();

  const { error: nameError } = await supabase
    .from("tenants")
    .update({ name })
    .eq("id", tenant.tenantId);
  if (nameError) return { error: nameError.message };

  const { error: settingsError } = await supabase
    .from("tenant_settings")
    .update({
      country_id: countryId,
      base_currency_id: baseCurrencyId,
      fiscal_year_start_month: fiscalYearStartMonth,
      timezone,
    })
    .eq("tenant_id", tenant.tenantId);
  if (settingsError) return { error: settingsError.message };

  revalidatePath("/settings/company");
  return { success: true };
}

export async function setTenantCapabilityAction(
  capabilityId: string,
  enable: boolean
): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "company_settings", "edit");

  const supabase = await createClient();
  if (enable) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("tenant_capabilities")
      .insert({ tenant_id: tenant.tenantId, capability_id: capabilityId, enabled_by: user?.id });
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("tenant_capabilities")
      .delete()
      .eq("tenant_id", tenant.tenantId)
      .eq("capability_id", capabilityId);
    if (error) return { error: error.message };
  }

  revalidatePath("/settings/capabilities");
  return { success: true };
}

export async function createBranchAction(formData: FormData): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "company_settings", "create");

  const code = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const isHeadOffice = formData.get("isHeadOffice") === "on";
  if (!code || !name) return { error: "Code and name are required" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("branches")
    .insert({ tenant_id: tenant.tenantId, code, name, is_head_office: isHeadOffice });
  if (error) return { error: error.message };

  revalidatePath("/settings/branches");
  return { success: true };
}

export async function createWarehouseAction(formData: FormData): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "warehouse", "create");

  const branchId = String(formData.get("branchId") ?? "");
  const code = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "warehouse");
  if (!branchId || !code || !name) return { error: "Branch, code and name are required" };

  const supabase = await createClient();
  const { error } = await supabase.from("warehouses").insert({
    tenant_id: tenant.tenantId,
    branch_id: branchId,
    code,
    name,
    type: type as "warehouse" | "yard" | "showroom",
  });
  if (error) return { error: error.message };

  revalidatePath("/settings/warehouses");
  return { success: true };
}

export async function toggleRolePermissionAction(
  roleId: string,
  permissionId: string,
  grant: boolean
): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "user_management", "edit");

  const supabase = await createClient();
  if (grant) {
    const { error } = await supabase
      .from("role_permissions")
      .insert({ role_id: roleId, permission_id: permissionId, tenant_id: tenant.tenantId });
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("role_permissions")
      .delete()
      .eq("role_id", roleId)
      .eq("permission_id", permissionId);
    if (error) return { error: error.message };
  }

  revalidatePath("/settings/roles");
  return { success: true };
}

export async function assignUserRoleAction(formData: FormData): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "user_management", "create");

  const userId = String(formData.get("userId") ?? "");
  const roleId = String(formData.get("roleId") ?? "");
  if (!userId || !roleId) return { error: "User and role are required" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_roles")
    .insert({ user_id: userId, tenant_id: tenant.tenantId, role_id: roleId });
  if (error) return { error: error.message };

  revalidatePath("/settings/users");
  return { success: true };
}

export async function removeUserRoleAction(userRoleId: string): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "user_management", "delete");

  const supabase = await createClient();
  const { error } = await supabase.from("user_roles").delete().eq("id", userRoleId);
  if (error) return { error: error.message };

  revalidatePath("/settings/users");
  return { success: true };
}

// Invites a brand-new person into the tenant by email. Creating the auth user
// itself requires the Supabase Admin API (service role) since there is no public
// self-serve signup path for an invite — everything after that (tenant membership,
// role grant) runs through the normal RLS-scoped client as the inviting user, who
// already holds user_management.create.
export async function inviteUserAction(formData: FormData): Promise<ActionResult> {
  const tenant = await requireActiveTenant();
  await requirePermission(tenant.tenantId, "user_management", "create");

  const email = String(formData.get("email") ?? "").trim();
  const roleId = String(formData.get("roleId") ?? "");
  if (!email || !roleId) return { error: "Email and role are required" };

  let invitedUserId: string;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email);
    if (error || !data.user) {
      return { error: error?.message ?? "Failed to invite user" };
    }
    invitedUserId = data.user.id;
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? `${e.message}. Set SUPABASE_SERVICE_ROLE_KEY to enable inviting new users.`
          : "Failed to invite user",
    };
  }

  const supabase = await createClient();
  const {
    data: { user: actingUser },
  } = await supabase.auth.getUser();

  const { error: membershipError } = await supabase
    .from("user_tenants")
    .insert({ user_id: invitedUserId, tenant_id: tenant.tenantId, invited_by: actingUser?.id });
  if (membershipError) return { error: membershipError.message };

  const { error: roleError } = await supabase
    .from("user_roles")
    .insert({ user_id: invitedUserId, tenant_id: tenant.tenantId, role_id: roleId });
  if (roleError) return { error: roleError.message };

  revalidatePath("/settings/users");
  return { success: true };
}
