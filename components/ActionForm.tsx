"use client";

import { useActionState, useState } from "react";
import { useOfflineOptional } from "@/lib/offline/OfflineProvider";
import { enqueueOfflineAction, isNetworkError } from "@/lib/offline/sync";

export type SimpleActionResult = { error: string } | { success: true };

type Props = {
  action: (formData: FormData) => Promise<SimpleActionResult>;
  submitLabel: string;
  pendingLabel?: string;
  children: React.ReactNode;
  className?: string;
  onSuccess?: () => void;
  // Opt-in: when set, a network failure (offline, or the connection drops
  // mid-submit) queues this exact submission for later sync instead of
  // surfacing a hard error -- see lib/offline/actionRegistry.ts, which
  // resolves this key back to the same Server Action the online path
  // calls, so nothing about the request itself is duplicated or bypassed.
  // Omit for forms that shouldn't be queueable offline (most settings
  // screens: there's no realistic "no signal" scenario for them, and
  // silently deferring a permission/role change is the wrong default).
  offlineActionKey?: string;
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
  offlineActionKey,
}: Props) {
  const offline = useOfflineOptional();
  const [queued, setQueued] = useState(false);

  async function queueOffline(formData: FormData): Promise<SimpleActionResult> {
    await enqueueOfflineAction({
      tenantId: offline!.tenantId,
      actionKey: offlineActionKey!,
      description: submitLabel,
      formData,
    });
    offline!.refreshPendingCount();
    setQueued(true);
    onSuccess?.();
    return { success: true };
  }

  const [state, formAction, pending] = useActionState(
    async (_prevState: SimpleActionResult | null, formData: FormData): Promise<SimpleActionResult> => {
      setQueued(false);
      const alreadyOffline =
        offlineActionKey && offline && typeof navigator !== "undefined" && !navigator.onLine;
      if (alreadyOffline) return queueOffline(formData);

      try {
        const result = await action(formData);
        if ("success" in result) onSuccess?.();
        return result;
      } catch (err) {
        if (offlineActionKey && offline && isNetworkError(err)) return queueOffline(formData);
        throw err;
      }
    },
    null
  );

  return (
    <form action={formAction} className={className ?? "flex flex-col gap-4"}>
      {children}
      {state && "error" in state && <p className="text-sm text-red-600">{state.error}</p>}
      {state && "success" in state && queued && (
        <p className="text-sm text-amber-600">Saved offline — will sync when back online.</p>
      )}
      {state && "success" in state && !queued && <p className="text-sm text-emerald-600">Saved.</p>}
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
