"use client";

import { useState, useTransition } from "react";
import { toggleRolePermissionAction } from "@/actions/settings";

type Role = { id: string; code: string; name: string };
type Permission = { id: string; resource: string; action: string };

export function PermissionGrid({
  roles,
  permissions,
  grantedKeys,
}: {
  roles: Role[];
  permissions: Permission[];
  grantedKeys: string[];
}) {
  const [granted, setGranted] = useState(new Set(grantedKeys));
  const [pending, startTransition] = useTransition();
  const [activeRoleId, setActiveRoleId] = useState(roles[0]?.id ?? "");

  const resources = Array.from(new Set(permissions.map((p) => p.resource)));
  const actions = Array.from(new Set(permissions.map((p) => p.action)));

  function permissionFor(resource: string, action: string) {
    return permissions.find((p) => p.resource === resource && p.action === action);
  }

  function toggle(permissionId: string, checked: boolean) {
    const key = `${activeRoleId}:${permissionId}`;
    setGranted((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
    startTransition(async () => {
      await toggleRolePermissionAction(activeRoleId, permissionId, checked);
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {roles.map((r) => (
          <button
            key={r.id}
            onClick={() => setActiveRoleId(r.id)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              r.id === activeRoleId
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "border border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
            }`}
          >
            {r.name}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-4">Resource</th>
              {actions.map((a) => (
                <th key={a} className="py-2 px-2 text-center">{a}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resources.map((resource) => (
              <tr key={resource} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2 pr-4 font-medium text-zinc-700 dark:text-zinc-300">
                  {resource}
                </td>
                {actions.map((action) => {
                  const perm = permissionFor(resource, action);
                  if (!perm) return <td key={action} />;
                  const key = `${activeRoleId}:${perm.id}`;
                  return (
                    <td key={action} className="py-2 px-2 text-center">
                      <input
                        type="checkbox"
                        disabled={pending}
                        checked={granted.has(key)}
                        onChange={(e) => toggle(perm.id, e.target.checked)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
