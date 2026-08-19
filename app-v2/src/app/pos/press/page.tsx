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
 *  code, same as v1 does for any sticker missing a cutout.
 *
 *  Two structural fixes over the port. The placement data used to be a
 *  five-column table that overflowed a phone sideways at the one moment the
 *  operator's hands are full; it is now one line per placement. And "Mark
 *  pressed" used to sit under each order, inside the scroller — it is now the
 *  single pinned action, acting on the selected (by default oldest) order,
 *  which is the one the operator should be pressing. */

import { useEffect, useMemo, useState } from "react";
import { getBackend } from "@/lib/backend";
import { useEnvironment } from "@/lib/hooks/useEnvironment";
import { useAsync, useAction } from "@/lib/hooks/useAsync";
import type { Order, OrderItem, ProductSku, StickerDesign } from "@/lib/domain/types";
import { renderPressSheet, placementList, type PressPlacement } from "@/lib/pressSheet";
import { PosShell } from "@/features/pos/PosShell";
import {
  Badge,
  Banner,
  Button,
  EmptyState,
  Mono,
  PosScreen,
  Skeleton,
  Text,
} from "@/components/ui";
import { clsx } from "@/components/clsx";

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
    <div className="flex flex-col gap-[var(--space-3)]">
      {sides.map((side) => {
        const rows = placementList(placements, side);
        return (
          <div key={side} className="flex flex-col gap-[var(--space-2)]">
            <p className="t-label">
              {sku?.sku_code ?? item.sku_code ?? "Garment"} · {side}
            </p>

            {sheets[side] === undefined && (
              <div className="flex h-40 items-center justify-center rounded-[var(--radius-md)] border-[3px] border-[var(--color-ink)] bg-white">
                <Mono className="t-base">Rendering press sheet…</Mono>
              </div>
            )}
            {sheets[side] === null && (
              <Banner tone="warn">
                No mockup or print area on file for this SKU — press it by the placement list below.
              </Banner>
            )}
            {sheets[side] && (
              // eslint-disable-next-line @next/next/no-img-element -- client-rendered canvas data: URL, not an optimisable asset.
              <img
                src={sheets[side] as string}
                alt={`Press sheet, ${side} of ${sku?.sku_code ?? item.sku_code ?? "garment"}, order ${receiptNo}`}
                className="w-full max-w-[320px] rounded-[var(--radius-md)] border-[3px] border-[var(--color-ink)] bg-white"
              />
            )}

            {/* One line per placement, not a five-column table. The table
                overflowed the phone sideways, which is unusable at a press. */}
            <ul className="flex flex-col divide-y-2 divide-[var(--color-line-soft)] rounded-[var(--radius-md)] border-[3px] border-[var(--color-ink)] bg-white px-[var(--space-3)]">
              {rows.map((r, i) => (
                <li key={`${r.code}-${i}`} className="flex flex-wrap items-baseline gap-x-[var(--space-3)] py-[var(--space-2)]">
                  <Mono className="t-md font-bold">{r.code}</Mono>
                  <Mono className="t-base text-[var(--color-muted)]">
                    x {r.x} · y {r.y} · {r.rotation}° · {r.size}
                  </Mono>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export default function PressPage() {
  const { environment, bound, loading: envLoading } = useEnvironment();

  const queue = useAsync(() => getBackend().getPressQueue(environment?.id), [environment?.id]);
  const catalogue = useAsync(() => getBackend().getCatalogue(), []);
  const { run, busy, error, clearError } = useAction();
  const [pressed, setPressed] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<string | null>(null);

  const skusById = useMemo(
    () => new Map((catalogue.data?.skus ?? []).map((s) => [s.id, s])),
    [catalogue.data]
  );
  const designsById = useMemo(
    () => new Map((catalogue.data?.designs ?? []).map((d) => [d.id, d])),
    [catalogue.data]
  );

  if (!envLoading && !bound) {
    return (
      <PosShell title="Press queue">
        <PosScreen>
          <PosScreen.Body>
            <Banner tone="warn" title="This phone isn't assigned to a stall yet">
              Pick which stall you&apos;re working at before pressing orders.
            </Banner>
          </PosScreen.Body>
        </PosScreen>
      </PosShell>
    );
  }

  const orders = [...(queue.data ?? [])].sort(
    (a, b) => new Date(a.client_created_at).getTime() - new Date(b.client_created_at).getTime()
  );
  const active = orders.find((o) => o.id === picked) ?? orders[0] ?? null;
  const loading = queue.loading || catalogue.loading;

  const markPressed = async (o: Order) => {
    const res = await run(() => getBackend().markPrinted(o.id, "volunteer"));
    if (res) {
      setPressed((p) => new Set(p).add(o.id));
      setPicked(null);
      void queue.reload();
    }
  };

  return (
    <PosShell title="Press queue">
      <PosScreen>
        <PosScreen.Head className="flex items-center justify-between gap-[var(--space-3)]">
          <div>
            <p className="t-label text-[var(--color-muted)]">Waiting at the press</p>
            <p className="t-base font-extrabold">
              {orders.length > 0
                ? `oldest waiting ${waitedFor(orders[0].client_created_at)}`
                : "nothing right now"}
            </p>
          </div>
          <Badge tone={orders.length > 0 ? "cobalt" : "white"}>
            <Mono>{orders.length}</Mono>
          </Badge>
        </PosScreen.Head>

        <PosScreen.Body className="stagger">
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
                <Button variant="ghost" onClick={clearError}>
                  Dismiss
                </Button>
              }
            >
              {error}
            </Banner>
          )}

          {loading ? (
            <>
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </>
          ) : orders.length === 0 ? (
            <EmptyState
              headline="Nothing waiting to press"
              teach="Once a ticket is marked prepped on the Board, it shows up here with its press sheet ready for the heat press."
            />
          ) : (
            <ul className="flex flex-col gap-[var(--space-3)]">
              {orders.map((o) => {
                const on = active?.id === o.id;
                return (
                  <li key={o.id}>
                    <article
                      className={clsx(
                        "rounded-[var(--radius-lg)] border-[var(--color-ink)] bg-white p-[var(--space-3)]",
                        on ? "border-[5px] shadow-[var(--shadow-block)]" : "border-[3px]"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setPicked(o.id)}
                        aria-pressed={on}
                        className="flex min-h-[var(--tap-pos)] w-full items-center justify-between gap-[var(--space-3)] text-left"
                      >
                        <span className="min-w-0">
                          <Mono className="t-lg block">{o.receipt_no ?? `#${o.order_no}`}</Mono>
                          <Mono className="t-base text-[var(--color-muted)]">
                            waiting {waitedFor(o.client_created_at)}
                            {o.promised_date ? ` · promised ${o.promised_date}` : ""}
                          </Mono>
                        </span>
                        <Badge tone={on ? "cobalt" : "white"}>{on ? "At the press" : "Select"}</Badge>
                      </button>

                      <div className="mt-[var(--space-3)] flex flex-col gap-[var(--space-3)]">
                        {o.items.map((item) => (
                          <GarmentSheet
                            key={item.id}
                            item={item}
                            sku={item.product_sku_id ? skusById.get(item.product_sku_id) : undefined}
                            designsById={designsById}
                            receiptNo={o.receipt_no ?? `#${o.order_no}`}
                          />
                        ))}
                      </div>

                      {pressed.has(o.id) && (
                        <Text muted className="mt-[var(--space-2)]">
                          Marked pressed — it will drop off the queue on the next refresh.
                        </Text>
                      )}
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </PosScreen.Body>

        <PosScreen.Foot className="flex flex-col gap-[var(--space-2)]">
          <div className="flex items-baseline justify-between gap-[var(--space-3)]">
            <span className="t-label text-white/80">At the press</span>
            <span className="t-base min-w-0 flex-1 truncate text-right font-extrabold">
              {active ? (active.receipt_no ?? `#${active.order_no}`) : "Nothing selected"}
            </span>
          </div>
          <Button
            variant="primary"
            size="xl"
            block
            busy={busy}
            disabled={!active || pressed.has(active.id)}
            onClick={() => active && markPressed(active)}
          >
            {!active ? "Nothing to press" : pressed.has(active.id) ? "Pressed" : "Mark pressed"}
          </Button>
        </PosScreen.Foot>
      </PosScreen>
    </PosShell>
  );
}
