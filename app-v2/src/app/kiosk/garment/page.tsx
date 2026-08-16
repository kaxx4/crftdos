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

import { money } from "@/lib/money";
import { Badge, Button, EmptyState, HandArrow, Heading, Mono, Panel, Skeleton, Text } from "@/components/ui";
import { KioskFrame } from "../_lib/KioskFrame";
import { Mockup } from "../_lib/Mockup";
import { useKiosk } from "../_lib/session";
import { skuLabel } from "../_lib/util";
import Link from "next/link";

export default function KioskGarmentPage() {
  const { skus, catalogue, catalogueLoading, canvas } = useKiosk();

  const available = skus.filter((s) => s.is_active && s.print_area);
  const chosen = canvas.sku;

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
    </KioskFrame>
  );
}
