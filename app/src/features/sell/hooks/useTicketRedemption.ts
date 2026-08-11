"use client";
import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { decodeTicket, expandTicket } from "@/lib/ticketPayload";
import type { CartGarment } from "../types";

/** Ticket code field: accepts a typed 4-char code (needs network) or a
 *  scanned QR carrying the whole compressed cart (works fully offline).
 *  `redeemedTicketCodes` is a list — a cart can legitimately hold two
 *  DIFFERENT tickets — and doubles as the duplicate-load guard. Guarded
 *  twice: once on the raw typed field before any network call (stops a
 *  double-tap from racing), and again on the resolved code after decode,
 *  because a scanned QR carries its own code which may differ from what was
 *  typed. */
export function useTicketRedemption(onGarments: (garments: CartGarment[]) => void) {
  const [ticketCode, setTicketCode] = useState("");
  const [ticketErr, setTicketErr] = useState("");
  const [redeemedTicketCodes, setRedeemedTicketCodes] = useState<string[]>([]);
  const [loadingTicket, setLoadingTicket] = useState(false);

  async function redeemTicket() {
    setTicketErr("");
    const raw = ticketCode.trim();
    if (!raw) return;

    const typedCode = raw.toUpperCase();
    if (redeemedTicketCodes.includes(typedCode)) {
      setTicketErr(`Ticket ${typedCode} is already in this cart.`);
      setTicketCode("");
      return;
    }
    if (loadingTicket) return;
    setLoadingTicket(true);

    try {
      const scanned = await decodeTicket(raw);
      let j: { ticket: { code: string; payload: unknown } };
      let code: string;

      if (scanned) {
        const expanded = expandTicket(scanned);
        code = expanded.code;
        j = { ticket: expanded };
      } else {
        code = raw.toUpperCase();
        const res = await fetch(`/api/tickets/${code}`).catch(() => null);
        if (!res) {
          setTicketErr("Offline — scan the QR on the kiosk screen instead of typing the code.");
          return;
        }
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setTicketErr(body.error || "No open ticket with that code.");
          return;
        }
        j = body;
      }
      type TicketSticker = {
        sticker_design_id: string;
        code: string;
        side?: "front" | "back";
        pos_x?: number;
        pos_y?: number;
        rotation?: number;
        unit_price: number;
        unit_cost: number;
      };
      type TicketGarment = {
        product_sku_id: string;
        sku_code: string;
        unit_price: number;
        unit_cost: number;
        stickers: TicketSticker[];
      };
      const payload = j.ticket.payload as { garments: TicketGarment[] };
      const newGarments: CartGarment[] = payload.garments.map((g) => ({
        key: uuidv4(),
        product_sku_id: g.product_sku_id,
        label: `${g.sku_code} (from ticket ${code})`,
        stockNote: "from design ticket",
        unit_price: Number(g.unit_price),
        unit_cost: Number(g.unit_cost),
        stickers: g.stickers.map((s) => ({
          key: uuidv4(),
          sticker_design_id: s.sticker_design_id,
          code: s.code,
          unit_price: Number(s.unit_price),
          unit_cost: Number(s.unit_cost),
          side: s.side ?? "front",
          pos_x: s.pos_x,
          pos_y: s.pos_y,
          rotation: s.rotation,
        })),
      }));
      // Guard again on the resolved code: a scanned QR carries its own code,
      // which may differ from whatever was in the field.
      let duplicate = false;
      setRedeemedTicketCodes((prev) => {
        if (prev.includes(code)) {
          duplicate = true;
          return prev;
        }
        return [...prev, code];
      });
      if (duplicate) {
        setTicketErr(`Ticket ${code} is already in this cart.`);
        setTicketCode("");
        return;
      }
      onGarments(newGarments);
      setTicketCode("");
    } finally {
      setLoadingTicket(false);
    }
  }

  function resetTicketState() {
    setRedeemedTicketCodes([]);
  }

  return {
    ticketCode,
    setTicketCode,
    ticketErr,
    redeemedTicketCodes,
    loadingTicket,
    redeemTicket,
    resetTicketState,
  };
}
