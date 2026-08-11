"use client";
import { useEffect, useMemo, useState } from "react";
import { BigButton, Mono } from "./ui";
import { renderPressSheet, placementList, type PressPlacement, type PrintArea } from "@/lib/pressSheet";

/** Shape of a pending order as /api/orders returns it, with the press-sheet
 *  relations joined. Only the fields this view reads are modelled. */
export type PressOrder = {
  id: string;
  receipt_no: string;
  created_at: string;
  promised_date: string | null;
  pressed_at: string | null;
  stall_order_items: {
    stall_product_skus: {
      sku_code: string;
      mockup_front: string | null;
      mockup_back: string | null;
      print_area: { front?: PrintArea; back?: PrintArea } | null;
    } | null;
    stall_order_item_stickers: {
      side: "front" | "back" | null;
      pos_x: number | null;
      pos_y: number | null;
      rotation: number | null;
      stall_sticker_designs: {
        code: string;
        cutout_path: string | null;
        print_w_cm: number | null;
        print_h_cm: number | null;
      } | null;
      stall_custom_stickers: { code: string; description: string } | null;
    }[];
  }[];
};

function waitedFor(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} hr ${mins % 60} min`;
}

function GarmentSheet({
  item,
  receiptNo,
}: {
  item: PressOrder["stall_order_items"][number];
  receiptNo: string;
}) {
  const sku = item.stall_product_skus;

  const placements: PressPlacement[] = useMemo(
    () =>
      item.stall_order_item_stickers.map((s) => ({
        code: s.stall_sticker_designs?.code ?? s.stall_custom_stickers?.code ?? "CUSTOM",
        side: s.side ?? "front",
        pos_x: s.pos_x,
        pos_y: s.pos_y,
        rotation: s.rotation,
        print_w_cm: s.stall_sticker_designs?.print_w_cm ?? null,
        print_h_cm: s.stall_sticker_designs?.print_h_cm ?? null,
        cutout_path: s.stall_sticker_designs?.cutout_path ?? null,
      })),
    [item.stall_order_item_stickers]
  );

  const sides = useMemo(
    () => (["front", "back"] as const).filter((sd) => placements.some((p) => p.side === sd)),
    [placements]
  );

  const [sheets, setSheets] = useState<Record<string, string | null>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const side of sides) {
        const area = sku?.print_area?.[side];
        const mockup = side === "front" ? sku?.mockup_front : sku?.mockup_back;
        if (!area || !mockup) {
          if (!cancelled) setSheets((p) => ({ ...p, [side]: null }));
          continue;
        }
        const url = await renderPressSheet({
          mockupSrc: mockup,
          printArea: area,
          placements,
          side,
          caption: `${receiptNo} · ${sku?.sku_code ?? ""}`,
        });
        if (!cancelled) setSheets((p) => ({ ...p, [side]: url }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sides, sku, placements, receiptNo]);

  if (!placements.length) return null;

  return (
    <div className="flex flex-col gap-2.5">
      {sides.map((side) => {
        const rows = placementList(placements, side);
        return (
          <div key={side} className="flex flex-col gap-1.5">
            <div className="font-extrabold text-[13px] tracking-[0.14em] uppercase">
              {sku?.sku_code ?? "Garment"} · {side}
            </div>

            {sheets[side] === undefined && (
              <div className="h-40 border-2 border-hairline flex items-center justify-center">
                <Mono>Rendering press sheet…</Mono>
              </div>
            )}
            {sheets[side] === null && (
              // Honest failure: the numbers below are still correct and still
              // pressable, so say what is missing rather than showing nothing.
              <div className="border-2 border-signal p-2.5">
                <Mono className="text-signal">
                  No mockup or print area on file for this SKU — use the placement list below.
                </Mono>
              </div>
            )}
            {sheets[side] && (
              <img
                src={sheets[side] as string}
                alt={`Press sheet, ${side} of ${sku?.sku_code ?? "garment"}, order ${receiptNo}`}
                className="w-full max-w-[320px] border-2 border-ink bg-white"
              />
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-[13px] border-2 border-ink bg-white">
                <thead>
                  <tr className="bg-ink text-cream text-left">
                    <th className="p-1.5 font-extrabold">CODE</th>
                    <th className="p-1.5 font-extrabold">X</th>
                    <th className="p-1.5 font-extrabold">Y</th>
                    <th className="p-1.5 font-extrabold">ROT</th>
                    <th className="p-1.5 font-extrabold">SIZE</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={`${r.code}-${i}`} className="border-t border-hairline">
                      <td className="p-1.5 font-mono font-bold">{r.code}</td>
                      <td className="p-1.5 font-mono">{r.x}</td>
                      <td className="p-1.5 font-mono">{r.y}</td>
                      <td className="p-1.5 font-mono">{r.rotation}</td>
                      <td className="p-1.5 font-mono">{r.size}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** The pending-press queue (PRD §3.2): oldest first, with a live wait timer,
 *  the press sheet for each garment, and one-tap Pressed / Handed Over. */
export function PressQueue({
  orders,
  onPress,
  onHandOver,
  busyId,
}: {
  orders: PressOrder[];
  onPress: (id: string) => void;
  onHandOver: (id: string) => void;
  /** `${orderId}${step}` of an in-flight request, so the tapped button can
   *  show it is working. Without this a slow network looks like a dead
   *  button and the volunteer taps it repeatedly. */
  busyId?: string | null;
}) {
  // Re-render once a minute so the wait timers stay honest without a timer
  // per order.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!orders.length) return null;

  const oldestFirst = [...orders].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <section className="flex flex-col gap-2.5" aria-label="Pending press queue">
      <h2 className="bg-signal text-cream p-2.5 font-extrabold text-[12px] tracking-[0.1em] uppercase flex justify-between">
        <span>{orders.length} pending press</span>
        <span>oldest {waitedFor(oldestFirst[0].created_at)}</span>
      </h2>

      {oldestFirst.map((o) => (
        <div key={o.id} className="border-2 border-ink bg-white p-2.5 flex flex-col gap-2.5">
          <div className="flex justify-between gap-2 items-start">
            <div>
              <div className="font-extrabold text-[16px]">{o.receipt_no}</div>
              <Mono>
                waiting {waitedFor(o.created_at)}
                {o.promised_date ? ` · promised ${o.promised_date}` : ""}
                {o.pressed_at ? " · pressed" : ""}
              </Mono>
            </div>
          </div>
          {o.stall_order_items.map((item, i) => (
            <GarmentSheet key={i} item={item} receiptNo={o.receipt_no} />
          ))}
          <div className="grid grid-cols-2 gap-2">
            <BigButton
              variant={o.pressed_at ? "ghost" : "blue"}
              disabled={!!o.pressed_at || busyId === o.id + "press"}
              onClick={() => onPress(o.id)}
            >
              {o.pressed_at ? "PRESSED" : "MARK PRESSED"}
            </BigButton>
            <BigButton
              variant="ink"
              disabled={busyId === o.id + "handover"}
              onClick={() => onHandOver(o.id)}
            >
              HANDED OVER
            </BigButton>
          </div>
        </div>
      ))}
    </section>
  );
}
