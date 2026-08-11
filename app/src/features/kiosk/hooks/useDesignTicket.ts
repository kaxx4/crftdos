import { useState } from "react";
import QRCode from "qrcode";
import { encodeTicket, type CompactTicket } from "@/lib/ticketPayload";
import { getSessionId } from "../session";
import type { Placement, Sku } from "../types";

export function useDesignTicket() {
  const [ticket, setTicket] = useState<{ code: string; expires_at: string } | null>(null);
  const [ticketQr, setTicketQr] = useState<string | null>(null);
  const [ticketError, setTicketError] = useState("");

  async function getTicket(sku: Sku, placements: Placement[], total: number): Promise<boolean> {
    setTicketError("");
    let res: Response;
    try {
      res = await fetch("/api/kiosk/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: "kiosk-" + getSessionId().slice(0, 6),
          quotedTotal: total,
          garments: [
            {
              product_sku_id: sku.id,
              sku_code: sku.sku_code,
              unit_price: sku.unit_price,
              unit_cost: sku.unit_cost,
              stickers: placements.map((p) => ({
                sticker_design_id: p.sticker_design_id,
                code: p.code,
                side: p.side,
                pos_x: p.xPct,
                pos_y: p.yPct,
                rotation: p.rotation,
                unit_price: p.unit_price,
                unit_cost: p.unit_cost,
                hold_id: p.holdId,
              })),
            },
          ],
        }),
      });
    } catch {
      setTicketError("Network error — check the connection and try again.");
      return false;
    }
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.ticket) {
      setTicket({ code: j.ticket.code, expires_at: j.ticket.expires_at });

      // PRD §10: the QR carries the WHOLE cart, not a lookup code, so the
      // till can redeem it with no network at all. The 4-character code
      // beneath it is the online-only fallback.
      const compact: CompactTicket = {
        v: 1,
        t: j.ticket.code,
        q: total,
        g: [
          {
            k: sku.id,
            c: sku.sku_code,
            p: sku.unit_price,
            o: sku.unit_cost,
            s: placements.map((p) => ({
              d: p.sticker_design_id,
              c: p.code,
              s: p.side === "back" ? (1 as const) : (0 as const),
              x: Math.round(p.xPct * 10) / 10,
              y: Math.round(p.yPct * 10) / 10,
              r: Math.round(p.rotation),
              p: p.unit_price,
              o: p.unit_cost,
              h: p.holdId,
            })),
          },
        ],
      };
      try {
        const encoded = await encodeTicket(compact);
        setTicketQr(
          await QRCode.toDataURL(encoded, {
            errorCorrectionLevel: "M",
            margin: 1,
            width: 512,
            color: { dark: "#0F0F10", light: "#F7F5F1" },
          })
        );
      } catch {
        // No QR just means the volunteer types the 4-character code.
        setTicketQr(null);
      }
      return true;
    }
    setTicketError(j.error || "Could not get a ticket — a reservation may have expired. Try again.");
    return false;
  }

  function resetTicket() {
    setTicket(null);
    setTicketQr(null);
    setTicketError("");
  }

  return { ticket, ticketQr, ticketError, getTicket, resetTicket };
}
