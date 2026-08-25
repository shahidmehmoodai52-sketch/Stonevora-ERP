import { createClient } from "@/lib/supabase/server";
import { requireActiveTenant } from "@/lib/tenant/getActiveTenant";
import { assignUserRoleAction, inviteUserAction, removeUserRoleAction } from "@/actions/settings";
import { ActionForm } from "@/components/ActionForm";
import { RemoveRoleButton } from "./RemoveRoleButton";

export default async function UsersPage() {
  const tenant = await requireActiveTenant();
  const supabase = await createClient();

  const [{ data: memberships }, { data: userRoles }, { data: roles }] = await Promise.all([
    supabase
      .from("user_tenants")
      .select("user_id, profiles!user_tenants_user_id_fkey(full_name, email)")
      .eq("tenant_id", tenant.tenantId),
    supabase
      .from("user_roles")
      .select("id, user_id, roles(name)")
      .eq("tenant_id", tenant.tenantId),
    supabase.from("roles").select("id, name").eq("tenant_id", tenant.tenantId).order("name"),
  ]);

  const rolesByUser = new Map<string, { id: string; roleName: string }[]>();
  for (const ur of userRoles ?? []) {
    const list = rolesByUser.get(ur.user_id) ?? [];
    list.push({ id: ur.id, roleName: ur.roles?.name ?? "" });
    rolesByUser.set(ur.user_id, list);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Users</h1>
      <div className="-mx-4 mb-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-3">Name</th>
              <th className="py-3">Email</th>
              <th className="py-3">Roles</th>
            </tr>
          </thead>
          <tbody>
            {(memberships ?? []).map((m) => (
              <tr key={m.user_id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="whitespace-nowrap py-3">{m.profiles?.full_name || "—"}</td>
                <td className="py-3">{m.profiles?.email}</td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-2">
                    {(rolesByUser.get(m.user_id) ?? []).map((r) => (
                      <span
                        key={r.id}
                        className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800"
                      >
                        {r.roleName}
                        <RemoveRoleButton userRoleId={r.id} action={removeUserRoleAction} />
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        Assign a role to an existing member
      </h2>
      <ActionForm action={assignUserRoleAction} submitLabel="Assign role" className="mb-8 flex flex-col gap-4 max-w-sm">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Member</label>
          <select name="userId" required className="input">
            <option value="">—</option>
            {(memberships ?? []).map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.profiles?.full_name || m.profiles?.email}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Role</label>
          <select name="roleId" required className="input">
            <option value="">—</option>
            {(roles ?? []).map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      </ActionForm>

      <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        Invite a new user
      </h2>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        Requires <code>SUPABASE_SERVICE_ROLE_KEY</code> to be configured for this
        environment.
      </p>
      <ActionForm action={inviteUserAction} submitLabel="Send invite" className="flex flex-col gap-4 max-w-sm">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Email</label>
          <input name="email" type="email" required className="input" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Role</label>
          <select name="roleId" required className="input">
            <option value="">—</option>
            {(roles ?? []).map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      </ActionForm>
    </div>
  );
}
