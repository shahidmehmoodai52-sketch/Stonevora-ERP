"use client";

import { useTransition } from "react";

export function RemoveRoleButton({
  userRoleId,
  action,
}: {
  userRoleId: string;
  action: (userRoleId: string) => Promise<{ error: string } | { success: true }>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => { await action(userRoleId); })}
      className="text-zinc-400 hover:text-red-600 disabled:opacity-50"
      aria-label="Remove role"
    >
      ×
    </button>
  );
}
