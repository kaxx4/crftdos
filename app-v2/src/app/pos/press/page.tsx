"use client";

/** The press sheet queue (PRD §4.4): every prepped-not-yet-pressed order,
 *  oldest first, rendered as a composite press sheet per garment side, with a
 *  one-tap "mark pressed" once the operator has physically pressed it.
 *
 *  Distinct from the single-ticket prep/print/handover flow in
 *  `features/pos/Board.tsx` — this is the multi-order batch view a volunteer
 *  works through at the heat press table, ported from v1's
 *  `components/PressQueue.tsx` + `lib/pressSheet.ts`.
 *
 *  `Order`/`OrderItem`/`OrderSticker` don't carry mockup images, print areas,
 *  or sticker cutout/print-size — those live on the catalogue (`ProductSku`,
 *  `StickerDesign`), snapshotted at order time only for price/cost. So this
 *  page loads the catalogue once and joins each order's items/stickers back
 *  onto it by id to get what the renderer needs. Custom stickers have no
 *  catalogue design to join against; the renderer falls back to drawing the
 *  code, same as v1 does for any sticker missing a cutout. */

import { useEffect, useMemo, useState } from "react";
import { getBackend } from "@/lib/backend";
import { useEnvironment } from "@/lib/hooks/useEnvironment";
import { useAsync, useAction } from "@/lib/hooks/useAsync";
import type { Order, OrderItem, ProductSku, StickerDesign } from "@/lib/domain/types";
import { renderPressSheet, placementList, type PressPlacement } from "@/lib/pressSheet";
import { PosShell } from "@/features/pos/PosShell";
import { Banner, Button, EmptyState, Mono, Panel, Skeleton } from "@/components/ui";

function waitedFor(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} hr ${mins % 60} min`;
}

function GarmentSheet({
  item,
  sku,
  designsById,
  receiptNo,
}: {
  item: OrderItem;
  sku: ProductSku | undefined;
  designsById: Map<string, StickerDesign>;
  receiptNo: string;
}) {
  const placements: PressPlacement[] = useMemo(
    () =>
      item.stickers.map((s) => {
        const design = s.sticker_design_id ? designsById.get(s.sticker_design_id) : undefined;
        return {
          code: s.code,
          side: s.side,
          pos_x: s.pos_x,
          pos_y: s.pos_y,
          rotation: s.rotation,
          print_w_cm: design?.print_w_cm ?? null,
          print_h_cm: design?.print_h_cm ?? null,
          cutout_path: design?.cutout_path ?? null,
        };
      }),
    [item.stickers, designsById]
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
              {sku?.sku_code ?? item.sku_code ?? "Garment"} · {side}
            </div>

            {sheets[side] === undefined && (
              <div className="h-40 border-2 border-[var(--color-line)] flex items-center justify-center">
                <Mono>Rendering press sheet…</Mono>
              </div>
            )}
            {sheets[side] === null && (
              <div className="border-2 border-[var(--color-signal)] p-2.5">
                <Mono className="text-[var(--color-signal)]">
                  No mockup or print area on file for this SKU — use the placement list below.
                </Mono>
              </div>
            )}
            {sheets[side] && (
              // eslint-disable-next-line @next/next/no-img-element -- client-rendered canvas data: URL, not an optimisable asset.
              <img
                src={sheets[side] as string}
                alt={`Press sheet, ${side} of ${sku?.sku_code ?? item.sku_code ?? "garment"}, order ${receiptNo}`}
                className="w-full max-w-[320px] border-2 border-[var(--color-ink)] bg-white"
              />
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-[13px] border-2 border-[var(--color-ink)] bg-white">
                <thead>
                  <tr className="bg-[var(--color-ink)] text-[var(--color-cream)] text-left">
                    <th className="p-1.5 font-extrabold">CODE</th>
                    <th className="p-1.5 font-extrabold">X</th>
                    <th className="p-1.5 font-extrabold">Y</th>
                    <th className="p-1.5 font-extrabold">ROT</th>
                    <th className="p-1.5 font-extrabold">SIZE</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={`${r.code}-${i}`} className="border-t border-[var(--color-line)]">
                      <td className="p-1.5 font-[family-name:var(--font-mono)] font-bold">{r.code}</td>
                      <td className="p-1.5 font-[family-name:var(--font-mono)]">{r.x}</td>
                      <td className="p-1.5 font-[family-name:var(--font-mono)]">{r.y}</td>
                      <td className="p-1.5 font-[family-name:var(--font-mono)]">{r.rotation}</td>
                      <td className="p-1.5 font-[family-name:var(--font-mono)]">{r.size}</td>
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

export default function PressPage() {
  const { environment, bound, loading: envLoading } = useEnvironment();

  const queue = useAsync(
    () => getBackend().getPressQueue(environment?.id),
    [environment?.id]
  );
  const catalogue = useAsync(() => getBackend().getCatalogue(), []);
  const { run, busy, error, clearError } = useAction();
  const [pressed, setPressed] = useState<Set<string>>(new Set());

  const skusById = useMemo(
    () => new Map((catalogue.data?.skus ?? []).map((s) => [s.id, s])),
    [catalogue.data]
  );
  const designsById = useMemo(
    () => new Map((catalogue.data?.designs ?? []).map((d) => [d.id, d])),
    [catalogue.data]
  );

  const markPressed = async (o: Order) => {
    const res = await run(() => getBackend().markPrinted(o.id, "volunteer"));
    if (res) {
      setPressed((p) => new Set(p).add(o.id));
      void queue.reload();
    }
  };

  if (!envLoading && !bound) {
    return (
      <PosShell title="Press queue">
        <div className="p-4">
          <Banner tone="warn" title="This phone isn't assigned to a stall yet">
            Open Settings and pick which stall you&apos;re working at before pressing orders.
          </Banner>
        </div>
      </PosShell>
    );
  }

  const orders = [...(queue.data ?? [])].sort(
    (a, b) => new Date(a.client_created_at).getTime() - new Date(b.client_created_at).getTime()
  );

  return (
    <PosShell title="Press queue">
      <div className="flex flex-col gap-3 p-3">
        {(queue.error || catalogue.error) && (
          <Banner tone="danger" title="Couldn't load the press queue">
            {queue.error ?? catalogue.error}
          </Banner>
        )}
        {error && (
          <Banner
            tone="danger"
            title="That didn't go through"
            action={
              <Button size="md" variant="ghost" onClick={clearError}>
                Dismiss
              </Button>
            }
          >
            {error}
          </Banner>
        )}

        {(queue.loading || catalogue.loading) ? (
          <>
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </>
        ) : orders.length === 0 ? (
          <EmptyState
            headline="Nothing waiting to press"
            teach="Once a ticket is marked prepped on the Board, it shows up here with its press sheet ready for the heat press."
          />
        ) : (
          <>
            <Banner tone="info">
              {orders.length} pending press · oldest waiting {waitedFor(orders[0].client_created_at)}
            </Banner>
            {orders.map((o) => (
              <Panel key={o.id} tight>
                <div className="flex flex-col gap-2.5">
                  <div>
                    <div className="font-extrabold text-[16px]">{o.receipt_no ?? `#${o.order_no}`}</div>
                    <Mono>
                      waiting {waitedFor(o.client_created_at)}
                      {o.promised_date ? ` · promised ${o.promised_date}` : ""}
                    </Mono>
                  </div>
                  {o.items.map((item) => (
                    <GarmentSheet
                      key={item.id}
                      item={item}
                      sku={item.product_sku_id ? skusById.get(item.product_sku_id) : undefined}
                      designsById={designsById}
                      receiptNo={o.receipt_no ?? `#${o.order_no}`}
                    />
                  ))}
                  <Button
                    variant="primary"
                    size="lg"
                    block
                    busy={busy}
                    disabled={pressed.has(o.id)}
                    onClick={() => markPressed(o)}
                  >
                    {pressed.has(o.id) ? "Pressed" : "Mark pressed"}
                  </Button>
                </div>
              </Panel>
            ))}
          </>
        )}
      </div>
    </PosShell>
  );
}
