"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { drainOutbox, pendingOutboxCount } from "./sync";

type OfflineContextValue = {
  tenantId: string;
  online: boolean;
  pendingCount: number;
  refreshPendingCount: () => void;
};

const OfflineContext = createContext<OfflineContextValue | null>(null);

// Mounted once per tenant in (app)/layout.tsx. Owns the one piece of state
// every offline-capable form and the status badge both need: are we online,
// and how many queued documents are waiting. Draining is triggered here --
// on mount (in case items were queued in a previous session and the tab was
// simply reopened already online) and on the browser's "online" event --
// rather than by each form, so a reconnect drains the whole outbox once,
// not once per mounted form.
export function OfflineProvider({ tenantId, children }: { tenantId: string; children: React.ReactNode }) {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPendingCount = useCallback(() => {
    pendingOutboxCount(tenantId).then(setPendingCount).catch(() => {});
  }, [tenantId]);

  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  useEffect(() => {
    async function goOnline() {
      setOnline(true);
      await drainOutbox(tenantId);
      refreshPendingCount();
    }
    function goOffline() {
      setOnline(false);
    }

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    if (navigator.onLine) void goOnline();

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [tenantId, refreshPendingCount]);

  return (
    <OfflineContext.Provider value={{ tenantId, online, pendingCount, refreshPendingCount }}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline(): OfflineContextValue {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error("useOffline must be used within an OfflineProvider");
  return ctx;
}

// For components (like ActionForm) that render both inside and outside the
// authenticated app -- returns null rather than throwing when there's no
// provider, so offline queueing is simply unavailable there instead of a
// hard crash.
export function useOfflineOptional(): OfflineContextValue | null {
  return useContext(OfflineContext);
}
