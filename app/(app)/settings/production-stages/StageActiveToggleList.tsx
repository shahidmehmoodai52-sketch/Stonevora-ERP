"use client";

import { useTransition, useState } from "react";
import type { ActionResult } from "@/actions/settings";

type Stage = { id: string; code: string; name: string; sort_order: number; is_active: boolean };

export function StageActiveToggleList({
  stages,
  action,
}: {
  stages: Stage[];
  action: (stageId: string, active: boolean) => Promise<ActionResult>;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(stageId: string, next: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await action(stageId, next);
      if ("error" in result) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {stages.map((s) => (
        <label
          key={s.id}
          className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
        >
          <input
            type="checkbox"
            checked={s.is_active}
            disabled={isPending}
            onChange={(e) => toggle(s.id, e.target.checked)}
          />
          <span className="flex-1 text-sm font-medium text-zinc-900 dark:text-zinc-50">{s.name}</span>
          <span className="text-xs text-zinc-500">{s.code} · order {s.sort_order}</span>
        </label>
      ))}
      {stages.length === 0 && <p className="text-sm text-zinc-500">No production stages yet.</p>}
    </div>
  );
}
