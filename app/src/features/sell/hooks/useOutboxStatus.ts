"use client";
import { useCallback, useEffect, useState } from "react";
import { flushOutbox, outboxCount } from "@/lib/outbox";

/** Online flag + pending-outbox count, kept fresh across visibility/online
 *  events. Generic enough to serve other screens later; Sell is the only
 *  current consumer. */
export function useOutboxStatus() {
  const [online, setOnline] = useState(true);
  const [pendingOutbox, setPendingOutbox] = useState(0);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const refreshOutboxCount = useCallback(() => {
    outboxCount().then(setPendingOutbox);
  }, []);

  useEffect(() => {
    refreshOutboxCount();
    const onVis = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        flushOutbox(() => refreshOutboxCount()).then(refreshOutboxCount);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onVis);
    };
  }, [refreshOutboxCount]);

  return { online, pendingOutbox, refreshOutboxCount };
}
