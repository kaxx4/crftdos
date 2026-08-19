"use client";

/** GARMENT.
 *
 *  Stock here is this stall's own available quantity, not the org-wide total —
 *  a customer must never pick something that is actually sold out in front of
 *  them and find out at the counter. Sold-out garments stay visible but
 *  disabled and labelled, because a garment that silently vanishes reads as
 *  the app being broken.
 *
 *  A repeating collection is one tone: every tile is white. The only colour in
 *  the grid is the SELECTED tile's cobalt action and an orange low-stock
 *  badge, both of which mean something.
 *
 *  Colour budget: COBALT (selection + continue) + ORANGE (low stock). */

import { useState } from "react";
import { money } from "@/lib/money";
import { Badge, Button, Chip, EmptyState, HandArrow, Heading, Mono, Panel, Sheet, Skeleton, Table, Td, Text, Th } from "@/components/ui";
import { KioskFrame } from "../_lib/KioskFrame";
import { Mockup } from "../_lib/Mockup";
import { useKiosk } from "../_lib/session";
import { skuLabel } from "../_lib/util";
import { sizeChartFor } from "@/lib/sizeChart";
import Link from "next/link";

/** The fits with a real chart to show, in the order they should tab. Crop
 *  has no supplied chart, so it isn't offered here rather than guessed. */
const CHARTED_FITS = ["Oversized", "Regular"] as const;

function SizeGuideSheet({ open, onClose, initialFit }: { open: boolean; onClose: () => void; initialFit: string }) {
  const [fit, setFit] = useState<string>(CHARTED_FITS.includes(initialFit as (typeof CHARTED_FITS)[number]) ? initialFit : CHARTED_FITS[0]);
  const rows = sizeChartFor(fit);

  return (
    <Sheet open={open} onClose={onClose} title="Size guide">
      <div className="flex flex-col gap-[var(--space-4)]">
        <Text step="sm" muted>
          All measurements in inches, laid flat. Chest width is measured pit-to-pit and doubled.
        </Text>
        <div className="flex gap-[var(--space-2)]">
          {CHARTED_FITS.map((f) => (
            <Chip key={f} surface="admin" selected={fit === f} onClick={() => setFit(f)}>
              {f}
            </Chip>
          ))}
        </div>
        {rows ? (
          <Table caption={`${fit} fit — chest, front length, sleeve length and shoulder width by size`} head={["", ...rows.map((r) => r.size)]}>
            {(
              [
                ["Chest width", "chestWidth"],
                ["Front length", "frontLength"],
                ["Sleeve length", "sleeveLength"],
                ["Shoulder width", "shoulderWidth"],
              ] as const
            ).map(([label, key]) => (
              <tr key={key}>
                <Th>{label}</Th>
                {rows.map((r) => (
                  <Td key={r.size} mono className="text-right">
                    {r[key]}&Prime;
                  </Td>
                ))}
              </tr>
            ))}
          </Table>
        ) : (
          <Text step="sm" muted>
            No chart for this fit yet — a volunteer can measure one against the rack.
          </Text>
        )}
      </div>
    </Sheet>
  );
}

export default function KioskGarmentPage() {
  const { skus, catalogue, catalogueLoading, canvas } = useKiosk();
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);

  const available = skus.filter((s) => s.is_active && s.print_area);
  const chosen = canvas.sku;
  const chosenFitName = catalogue?.fits.find((f) => f.id === chosen?.fit_id)?.name ?? CHARTED_FITS[0];

  return (
    <KioskFrame
      wide
      eyebrow="Step 2 of 4"
      title="Pick your tee"
      teach="Tap the colour, fit and size you want. Everything shown is in the box at this stall today — if it's greyed out, it's gone."
      back={{ href: "/kiosk/start", label: "Back" }}
      foot={
        chosen ? (
          <>
            <Text step="md" className="text-white">
              {skuLabel(chosen, catalogue)} · <Mono>{money(chosen.unit_price)}</Mono>
            </Text>
            <Link href="/kiosk/design" className="inline-flex">
              <Button surface="kiosk" size="xl" variant="primary">
                Add transfers →
              </Button>
            </Link>
          </>
        ) : (
          <Text step="md" className="text-white/80">
            Pick a tee to carry on.
          </Text>
        )
      }
    >
      {!catalogueLoading && available.length > 0 && (
        <div className="flex justify-end">
          <Button surface="kiosk" size="lg" variant="ghost" onClick={() => setSizeGuideOpen(true)}>
            📏 Size guide
          </Button>
        </div>
      )}

      {catalogueLoading ? (
        <div className="grid gap-[var(--space-3)] sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[380px]" />
          ))}
        </div>
      ) : available.length === 0 ? (
        <EmptyState
          headline="Nothing left to print on"
          teach="Every garment at this stall is sold out or still in the van. A volunteer can tell you what's coming back out — this screen fills itself in again the moment stock is booked in."
        />
      ) : (
        <div className="stagger grid gap-[var(--space-3)] sm:grid-cols-2 lg:grid-cols-3">
          {available.map((sku, i) => {
            const selected = chosen?.id === sku.id;
            const soldOut = sku.stock_qty <= 0;
            const low = !soldOut && sku.stock_qty <= 2;
            // One hand-drawn nudge, on the first tile only, and only while
            // nothing has been chosen yet — this grid is a repeating
            // collection (one tone, per the comment above), so the nudge
            // stays a single scribble pointing at a starting point rather
            // than decoration on the collection itself. Gone the instant a
            // tile is picked, and gone below `lg` where a 3-up grid has no
            // canvas room to spare.
            const showNudge = i === 0 && !chosen && !soldOut;
            return (
              <Panel key={sku.id} className="relative flex flex-col gap-[var(--space-3)]">
                {showNudge && (
                  <span className="absolute -top-12 -right-4 z-10 hidden -rotate-6 lg:block" aria-hidden>
                    <span className="t-hand t-md block text-[var(--color-ink)]">pick one!</span>
                    <HandArrow curve="l" className="mt-1 h-14 w-14" />
                  </span>
                )}
                <Mockup sku={sku} placements={[]} side="front" className={soldOut ? "opacity-60" : undefined} />
                <div className="flex flex-col gap-[var(--space-2)]">
                  <Heading level={2} step="lg">
                    {skuLabel(sku, catalogue)}
                  </Heading>
                  <Text step="base">
                    <Mono>{money(sku.unit_price)}</Mono>
                  </Text>
                  {soldOut ? (
                    <div>
                      <Badge tone="white">Sold out here</Badge>
                    </div>
                  ) : low ? (
                    <div>
                      <Badge tone="orange">Only {sku.stock_qty} left</Badge>
                    </div>
                  ) : null}
                </div>
                <Button
                  surface="kiosk"
                  size="lg"
                  block
                  aria-pressed={selected}
                  disabled={soldOut}
                  variant={selected ? "primary" : "secondary"}
                  onClick={() => canvas.setSku(sku)}
                >
                  {soldOut ? "Sold out" : selected ? "✓ This one" : "Choose this"}
                </Button>
              </Panel>
            );
          })}
        </div>
      )}

      <SizeGuideSheet open={sizeGuideOpen} onClose={() => setSizeGuideOpen(false)} initialFit={chosenFitName} />
    </KioskFrame>
  );
}
