"use client";
import { useMemo, useState } from "react";

/** Pure derivation off subtotal — no admin-PIN state in here. */
export function useDiscountGate(subtotal: number) {
  const [discountAmt, setDiscountAmt] = useState("");
  const [discountPct, setDiscountPct] = useState("");
  const [discountReason, setDiscountReason] = useState("volunteer_discretion");

  const discountAmount = useMemo(() => {
    const pct = Number(discountPct) || 0;
    const amt = Number(discountAmt) || 0;
    if (pct > 0) return Math.round((subtotal * pct) / 100);
    return amt;
  }, [discountAmt, discountPct, subtotal]);

  const discountPctEffective = subtotal > 0 ? (discountAmount / subtotal) * 100 : 0;
  const needsAdminGate = discountPctEffective > 10 && discountAmount > 0;

  function resetDiscount() {
    setDiscountAmt("");
    setDiscountPct("");
  }

  function restoreDiscount(amt: string, pct: string) {
    setDiscountAmt(amt);
    setDiscountPct(pct);
  }

  return {
    discountAmt,
    setDiscountAmt,
    discountPct,
    setDiscountPct,
    discountReason,
    setDiscountReason,
    discountAmount,
    discountPctEffective,
    needsAdminGate,
    resetDiscount,
    restoreDiscount,
  };
}
