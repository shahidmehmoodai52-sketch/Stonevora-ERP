"use client";

import { useTransition } from "react";

export function DeleteProductButton({
  productId,
  action,
}: {
  productId: string;
  action: (productId: string) => Promise<{ error: string } | { success: true }>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm("Delete this product? This cannot be undone.")) {
          startTransition(async () => { await action(productId); });
        }
      }}
      className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-950"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
