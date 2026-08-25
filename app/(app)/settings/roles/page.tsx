import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { PermissionGrid } from "./PermissionGrid";

export default async function RolesPage() {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const [{ data: roles }, { data: permissions }, { data: grants }] = await Promise.all([
    supabase.from("roles").select("id, code, name").eq("tenant_id", tenant.tenantId).order("name"),
    supabase.from("permissions").select("id, resource, action").order("resource").order("action"),
    supabase
      .from("role_permissions")
      .select("role_id, permission_id")
      .eq("tenant_id", tenant.tenantId),
  ]);

  const grantedKeys = new Set(
    (grants ?? []).map((g) => `${g.role_id}:${g.permission_id}`)
  );

  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Roles &amp; permissions
      </h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        Toggle a checkbox to grant or revoke a permission for a role. Financial
        columns (view_cost / view_profit / view_financial) control cost and margin
        visibility separately from ordinary view access.
      </p>
      <PermissionGrid
        roles={roles ?? []}
        permissions={permissions ?? []}
        grantedKeys={Array.from(grantedKeys)}
      />
    </div>
  );
}
