"use client";

import { useTransition, useState } from "react";
import type { ActionResult } from "@/actions/settings";

type Capability = {
  id: string;
  code: string;
  name: string;
  description: string;
  enabled: boolean;
};

const BUILT_CODES = new Set(["trading_distribution"]);
const LOCKED_CODES = new Set(["trading_distribution"]);

export function CapabilityToggleList({
  capabilities,
  action,
}: {
  capabilities: Capability[];
  action: (capabilityId: string, enable: boolean) => Promise<ActionResult>;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(capabilityId: string, next: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await action(capabilityId, next);
      if ("error" in result) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {capabilities.map((c) => {
        const locked = LOCKED_CODES.has(c.code);
        const built = BUILT_CODES.has(c.code);
        return (
          <label
            key={c.id}
            className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
          >
            <input
              type="checkbox"
              checked={c.enabled}
              disabled={isPending || locked}
              onChange={(e) => toggle(c.id, e.target.checked)}
              className="mt-1"
            />
            <span className="flex flex-col">
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {c.name}
                {locked && (
                  <span className="ml-2 text-xs font-normal text-zinc-500">core, always on</span>
                )}
                {!built && (
                  <span className="ml-2 text-xs font-normal text-zinc-500">module UI not yet built</span>
                )}
              </span>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">{c.description}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
