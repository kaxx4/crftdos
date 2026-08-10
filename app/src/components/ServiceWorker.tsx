"use client";
import { useEffect } from "react";

/** Registers /sw.js once the page is interactive.
 *
 *  Registration is deliberately deferred to `load`: on stall mobile data the
 *  service worker's precache would otherwise compete with the catalogue fetch
 *  the volunteer is actually waiting for.
 *
 *  Disabled in development, where a stale cached shell is a debugging trap
 *  rather than a feature. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // No service worker means no offline shell. The outbox and the
        // IndexedDB catalogue cache still work, so this degrades rather
        // than breaks — not worth surfacing to a volunteer mid-shift.
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
