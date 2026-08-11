"use client";
import { useState } from "react";

/** PRD §3.1 "Customer sheet" / §3.2 press mode. A custom sticker or a canvas
 *  (kiosk) placement on a collect-later shift means someone has to be
 *  reachable when the garment is ready, so contact capture stops being
 *  skippable in that one case. Shown as a gate before Charge (the order is
 *  written atomically — customer_id is set at insert time, so there is no
 *  later moment to attach a name/phone to an order that already exists). */
export function useCustomerSheet(cartHasFulfillmentTrigger: boolean, pressOnSite: boolean | undefined) {
  const [customerSheetOpen, setCustomerSheetOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerConsent, setCustomerConsent] = useState(false);
  const [promisedDate, setPromisedDate] = useState("");
  const [customerErr, setCustomerErr] = useState("");

  const collectLater = cartHasFulfillmentTrigger && pressOnSite === false;

  function resetCustomerSheet() {
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setCustomerConsent(false);
    setPromisedDate("");
    setCustomerErr("");
    setCustomerSheetOpen(false);
  }

  return {
    customerSheetOpen,
    setCustomerSheetOpen,
    customerName,
    setCustomerName,
    customerPhone,
    setCustomerPhone,
    customerEmail,
    setCustomerEmail,
    customerConsent,
    setCustomerConsent,
    promisedDate,
    setPromisedDate,
    customerErr,
    setCustomerErr,
    collectLater,
    resetCustomerSheet,
  };
}
