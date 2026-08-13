"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Catalogue } from "@/lib/backend";
import type { ProductSku } from "@/lib/domain/types";

/** Every kiosk screen guards its own prerequisites.
 *
 *  A kiosk is a device somebody hard-reloads, and a URL somebody lands on
 *  sideways. A screen that assumed the previous one had run would render half
 *  a garment and no way out; instead it sends the customer to the step that
 *  can actually be completed. Never a dead end, never an error page. */
export function useStageGuard(satisfied: boolean, fallback: string) {
  const router = useRouter();
  useEffect(() => {
    if (!satisfied) router.replace(fallback);
  }, [satisfied, fallback, router]);
}

/** Human words for a SKU. A customer does not read "TEE-BLK-REG-M". */
export function skuLabel(sku: ProductSku, catalogue: Catalogue | null): string {
  const color = catalogue?.colors.find((c) => c.id === sku.color_id)?.name;
  const fit = catalogue?.fits.find((f) => f.id === sku.fit_id)?.name;
  return [color, fit, sku.size].filter(Boolean).join(" · ") || sku.sku_code;
}

/** The ticket code a volunteer reads off a customer's screen at arm's length,
 *  derived from the order id. 32 symbols, no O/0 and no I/1 — those are the
 *  two pairs that get misread across a counter. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function ticketCode(orderId: string): string {
  const seed = orderId.replace(/-/g, "");
  let out = "";
  for (let i = 0; i < 4; i++) out += ALPHABET[seed.charCodeAt(i * 3 + 1) % ALPHABET.length];
  return out;
}
