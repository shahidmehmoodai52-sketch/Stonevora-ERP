import { createClient } from "@/lib/supabase/server";

export type PermissionKey = `${string}:${string}`;
export type PermissionSet = Set<PermissionKey>;

function toKey(resource: string, action: string): PermissionKey {
  return `${resource}:${action}`;
}

// Fetches every (resource, action) permission the current user holds for a tenant,
// as a single Set — meant to be loaded once per page (Server Component) and passed
// down to Client Components for conditional rendering only. This is never the
// enforcement point: hiding a button here does not stop a direct Server Action
// call, which is why every mutation still runs requirePermission() (lib/auth/guard)
// backed by the same has_permission() Postgres function and RLS policies.
export async function fetchPermissionSet(tenantId: string): Promise<PermissionSet> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_roles")
    .select("roles!inner(role_permissions!inner(permissions!inner(resource, action)))")
    .eq("tenant_id", tenantId);

  const set: PermissionSet = new Set();
  for (const userRole of data ?? []) {
    for (const rolePermission of userRole.roles.role_permissions) {
      set.add(toKey(rolePermission.permissions.resource, rolePermission.permissions.action));
    }
  }
  return set;
}

export function hasPermission(
  permissionSet: PermissionSet,
  resource: string,
  action: string
): boolean {
  return permissionSet.has(toKey(resource, action));
}
