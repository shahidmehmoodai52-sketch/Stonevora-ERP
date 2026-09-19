"use client";

import { useState, useTransition } from "react";

type ActionResult = { error: string } | { success: true };

// Generic "commit this draft document" button -- stock adjustments and
// sales/purchase returns all follow the same draft-then-post lifecycle as
// sales orders (see ConfirmOrderButton.tsx), so this is the same pattern
// generalized instead of copy-pasted a third time.
export function PostButton({
  id,
  action,
  label = "Post",
  pendingLabel = "Posting…",
}: {
  id: string;
  action: (id: string) => Promise<ActionResult>;
  label?: string;
  pendingLabel?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await action(id);
            setError("error" in result ? result.error : null);
          })
        }
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? pendingLabel : label}
      </button>
      {error && <p className="max-w-xs text-sm text-red-600">{error}</p>}
    </div>
  );
}
