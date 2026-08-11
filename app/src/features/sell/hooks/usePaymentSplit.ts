"use client";
import { useState } from "react";
import type { PaymentMethod } from "../types";

export function usePaymentSplit(total: number) {
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [cashAmt, setCashAmt] = useState("");
  const [upiAmt, setUpiAmt] = useState("");

  const splitTotal = (Number(cashAmt) || 0) + (Number(upiAmt) || 0);
  const splitOk = payment !== "split" || Math.abs(splitTotal - total) < 1;

  function resetPayment() {
    setPayment("cash");
    setCashAmt("");
    setUpiAmt("");
  }

  return { payment, setPayment, cashAmt, setCashAmt, upiAmt, setUpiAmt, splitTotal, splitOk, resetPayment };
}
