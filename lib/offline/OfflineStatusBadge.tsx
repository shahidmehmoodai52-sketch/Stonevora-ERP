"use client";

import { useOffline } from "./OfflineProvider";

// A small, always-visible indicator -- offline mode is silent plumbing
// otherwise, and a user who submitted a form while offline needs to see
// that it's queued, not lost, and later see it actually go through.
export function OfflineStatusBadge() {
  const { online, pendingCount } = useOffline();

  if (online && pendingCount === 0) return null;

  return (
    <span
      className={`flex min-h-11 items-center gap-1.5 rounded-md px-2 text-xs font-medium ${
        online
          ? "text-amber-700 dark:text-amber-400"
          : "text-red-700 dark:text-red-400"
      }`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${online ? "bg-amber-500" : "bg-red-500"}`}
      />
      {online
        ? `Syncing ${pendingCount} queued ${pendingCount === 1 ? "item" : "items"}…`
        : pendingCount > 0
          ? `Offline — ${pendingCount} queued`
          : "Offline"}
    </span>
  );
}
