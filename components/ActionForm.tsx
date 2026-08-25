"use client";

import { useActionState } from "react";

export type SimpleActionResult = { error: string } | { success: true };

type Props = {
  action: (formData: FormData) => Promise<SimpleActionResult>;
  submitLabel: string;
  pendingLabel?: string;
  children: React.ReactNode;
  className?: string;
  onSuccess?: () => void;
};

// Shared wrapper for the common "form posts to a Server Action returning
// {error} | {success}" shape, so individual settings/product forms only need to
// supply their own fields.
export function ActionForm({
  action,
  submitLabel,
  pendingLabel,
  children,
  className,
  onSuccess,
}: Props) {
  const [state, formAction, pending] = useActionState(
    async (_prevState: SimpleActionResult | null, formData: FormData) => {
      const result = await action(formData);
      if ("success" in result) onSuccess?.();
      return result;
    },
    null
  );

  return (
    <form action={formAction} className={className ?? "flex flex-col gap-4"}>
      {children}
      {state && "error" in state && <p className="text-sm text-red-600">{state.error}</p>}
      {state && "success" in state && <p className="text-sm text-emerald-600">Saved.</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? (pendingLabel ?? "Saving…") : submitLabel}
      </button>
    </form>
  );
}
