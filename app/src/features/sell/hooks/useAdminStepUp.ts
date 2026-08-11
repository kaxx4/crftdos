"use client";
import { useEffect, useState } from "react";

/** Admin-PIN step-up for >10% discounts against /api/auth/verify. A 429 must
 *  read as a lockout, never as "Incorrect admin PIN". */
export function useAdminStepUp(needsAdminGate: boolean) {
  const [discountUnlocked, setDiscountUnlocked] = useState(false);
  const [adminPinPrompt, setAdminPinPrompt] = useState(false);
  const [adminPinValue, setAdminPinValue] = useState("");
  const [adminPinErr, setAdminPinErr] = useState("");

  useEffect(() => {
    // Intentional state sync: discountUnlocked is set true by a user action
    // (admin PIN entry) and must be reset once the gate that required it no
    // longer applies — it can't be derived purely from needsAdminGate.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!needsAdminGate) setDiscountUnlocked(false);
  }, [needsAdminGate]);

  async function submitAdminPin() {
    setAdminPinErr("");
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "admin", pin: adminPinValue }),
    });
    const j = await res.json().catch(() => ({}));
    if (j.ok) {
      // Kept (not cleared) so the order payload can carry it — /api/orders
      // re-verifies server-side. A client that skipped this prompt entirely
      // (or hit the API directly) must not be able to write a >10% discount
      // with no PIN at all.
      setDiscountUnlocked(true);
      setAdminPinPrompt(false);
    } else {
      // A lockout must not read as a wrong PIN, or the volunteer keeps
      // retyping a PIN that was correct and the queue keeps growing.
      setAdminPinErr(res.status === 429 ? j.error || "Too many tries — wait a couple of minutes and try again" : "Incorrect admin PIN");
    }
  }

  function resetAdminStepUp() {
    setDiscountUnlocked(false);
    setAdminPinValue("");
    setAdminPinErr("");
    setAdminPinPrompt(false);
  }

  return {
    discountUnlocked,
    adminPinPrompt,
    setAdminPinPrompt,
    adminPinValue,
    setAdminPinValue,
    adminPinErr,
    submitAdminPin,
    resetAdminStepUp,
  };
}
