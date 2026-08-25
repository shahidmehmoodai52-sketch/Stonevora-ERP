"use client";

import { useState, useTransition } from "react";

type ActionResult = { error: string } | { success: true };

export function ConfirmOrderButton({
  salesOrderId,
  action,
}: {
  salesOrderId: string;
  action: (salesOrderId: string) => Promise<ActionResult>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await action(salesOrderId);
            setError("error" in result ? result.error : null);
          })
        }
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "Confirming…" : "Confirm order"}
      </button>
      {error && <p className="max-w-xs text-right text-sm text-red-600">{error}</p>}
    </div>
  );
}
