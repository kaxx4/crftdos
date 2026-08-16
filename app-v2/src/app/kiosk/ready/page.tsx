"use client";

/** READY-MADE.
 *
 *  A repeating collection, so it is ONE tone — every tile is white with an ink
 *  edge. A grid of six colours would look like the reference image and would
 *  be the exact confetti failure the direction exists to fix; the eye needs
 *  somewhere to land, and here that is the artwork, not the card behind it.
 *
 *  A template is a starting point, not a promise: each placement still has to
 *  reserve its own stock, and one whose transfer has run out loads without it
 *  and says so, rather than dead-ending someone who has already chosen.
 *
 *  Colour budget: COBALT (foot) + PINK (the featured sticker). */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBackend } from "@/lib/backend";
import { track } from "@/lib/analytics";
import { money } from "@/lib/money";
import type { Template } from "@/lib/domain/types";
import {
  Badge,
  Banner,
  Button,
  Chip,
  EmptyState,
  HandArrow,
  Heading,
  Mono,
  Panel,
  Skeleton,
  Sticker,
  Text,
} from "@/components/ui";
import { KioskFrame } from "../_lib/KioskFrame";
import { Mockup } from "../_lib/Mockup";
import { useKiosk } from "../_lib/session";
import { skuLabel } from "../_lib/util";

export default function KioskReadyPage() {
  const router = useRouter();
  const { templates, templatesLoading, skus, catalogue, canvas, environment } = useKiosk();
  const [openingId, setOpeningId] = useState<string | null>(null);
  // Templates carry no real category field — is_featured is the only true
  // grouping in the data, so that's the only filter offered. Inventing a
  // taxonomy that doesn't exist would be worse than not having one.
  const [onlyPopular, setOnlyPopular] = useState(false);

  const open = async (t: Template) => {
    if (openingId) return;
    setOpeningId(t.id);
    const loaded = await canvas.loadPayload(t.payload, skus);
    setOpeningId(null);
    if (!loaded) return;
    void getBackend().noteTemplateOpened(t.id);
    if (environment) track(environment.id, "template_opened", { name: t.name, slug: t.slug });
    router.push("/kiosk/design");
  };

  const active = templates.filter((t) => t.is_active !== false);
  const hasFeatured = active.some((t) => t.is_featured);
  const visible = onlyPopular ? active.filter((t) => t.is_featured) : active;

  return (
    <KioskFrame
      wide
      eyebrow="Step 1 of 4"
      title="Pick one to start from"
      teach="Tap a design and we'll load it onto the canvas. You can swap transfers, move them, or change the tee afterwards — nothing here is final."
      back={{ href: "/kiosk/start", label: "Back" }}
      foot={
        <Link href="/kiosk/garment" className="inline-flex">
          <Button surface="kiosk" size="lg" variant="secondary">
            None of these — start from blank
          </Button>
        </Link>
      }
    >
      {canvas.refusal && (
        <Banner tone="warn" title="One transfer wasn't available" className="animate-refuse">
          {canvas.refusal.message}
        </Banner>
      )}

      {hasFeatured && !templatesLoading && (
        <div className="flex gap-[var(--space-2)]">
          <Chip surface="kiosk" selected={!onlyPopular} onClick={() => setOnlyPopular(false)}>
            All
          </Chip>
          <Chip surface="kiosk" selected={onlyPopular} onClick={() => setOnlyPopular(true)}>
            Popular
          </Chip>
        </div>
      )}

      {templatesLoading ? (
        <div className="grid gap-[var(--space-3)] sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[380px]" />
          ))}
        </div>
      ) : active.length === 0 ? (
        <EmptyState
          headline="Nothing made up yet today"
          teach="Ready-made designs are put together by the crftd team before a market. There aren't any on this tablet right now, so start from a blank tee instead — it's the same tools, one extra tap."
          action={
            <Link href="/kiosk/garment" className="inline-flex">
              <Button surface="kiosk" size="lg" variant="primary">
                Start from blank
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="stagger grid gap-[var(--space-3)] sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((t, i) => {
            const sku = skus.find((s) => s.id === t.payload.product_sku_id);
            const price = t.payload.unit_price + t.payload.placements.reduce((n, p) => n + p.unit_price, 0);
            const isHero = i === 0 && t.is_featured;
            return (
              <Panel key={t.id} className="relative flex flex-col gap-[var(--space-3)]">
                {/* One hand-drawn nudge, on the first Popular card only —
                    same device and same restraint as /kiosk/start's "start
                    here" scribble at the recommended path one screen back.
                    Never ambient: it names this specific card, and it's gone
                    below `lg` where a 3-up grid has no canvas room to spare. */}
                {isHero && (
                  <span className="absolute -top-14 left-2 z-10 hidden -rotate-6 lg:block" aria-hidden>
                    <span className="t-hand t-md block text-[var(--color-ink)]">try this one</span>
                    <HandArrow curve="r" className="mt-1 h-14 w-14 -scale-x-100" />
                  </span>
                )}
                <div className="relative">
                  {isHero && (
                    <div
                      className="halftone pointer-events-none absolute -top-3 -left-3 z-0 hidden h-20 w-20 rounded-[var(--radius-lg)] sm:block"
                      aria-hidden
                    />
                  )}
                  <Mockup sku={sku} placements={t.payload.placements} side="front" className="relative z-10" />
                  {t.is_featured && i < 3 && (
                    <span className="absolute -top-[var(--space-2)] -right-[var(--space-2)] z-10">
                      <Sticker tone="pink" tilt="r">
                        Popular
                      </Sticker>
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-[var(--space-1)]">
                  <Heading level={2} step="lg">
                    {t.name}
                  </Heading>
                  {t.blurb && (
                    <Text step="base" muted>
                      {t.blurb}
                    </Text>
                  )}
                  <Text step="base">
                    <Mono>{money(price)}</Mono>
                    {sku ? ` · ${skuLabel(sku, catalogue)}` : " · garment picked next"}
                  </Text>
                  {!sku && <Badge tone="white">Garment sold out here</Badge>}
                </div>
                <Button
                  surface="kiosk"
                  size="lg"
                  variant="secondary"
                  block
                  busy={openingId === t.id}
                  disabled={!sku || (openingId !== null && openingId !== t.id)}
                  onClick={() => void open(t)}
                >
                  {sku ? "Use this one" : "Not available today"}
                </Button>
              </Panel>
            );
          })}
        </div>
      )}
    </KioskFrame>
  );
}
