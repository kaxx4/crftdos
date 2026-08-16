"use client";

/** PATH.
 *
 *  Two ways in, and the docs are clear which one carries the volume: most
 *  customers do not want to design anything, they want the one they saw on
 *  Instagram. So the ready-made path is the recommended one, is described
 *  first, and gets the block colour and the cobalt action.
 *
 *  Both actions live in the pinned foot rather than inside the panels that
 *  describe them: the choice must be reachable at any scroll position, and one
 *  region gets exactly one cobalt primary.
 *
 *  Colour budget: PINK + COBALT. */

import Link from "next/link";
import { Button, HandArrow, Heading, Panel, Sticker, Text } from "@/components/ui";
import { KioskFrame } from "../_lib/KioskFrame";
import { useKiosk } from "../_lib/session";

export default function KioskStartPage() {
  const { templates, templatesLoading, designs } = useKiosk();
  const readyCount = templates.length;

  return (
    <KioskFrame
      eyebrow="Step 1 of 4"
      title="How do you want to start?"
      teach="Pick one of ours and change it, or build yours from a blank tee. You can always start over."
      back={{ href: "/kiosk", label: "Home" }}
      foot={
        <>
          <Link href="/kiosk/garment" className="inline-flex">
            <Button surface="kiosk" size="lg" variant="secondary">
              Start from blank
            </Button>
          </Link>
          <Link href="/kiosk/ready" className="inline-flex">
            <Button surface="kiosk" size="xl" variant="primary">
              Show me the ready-made ones →
            </Button>
          </Link>
        </>
      }
    >
      {/* Ambient, not structural: this screen's own budget is PINK + COBALT,
          same as attract. One small sticker per panel, peeking off the
          corner the way the hero's own sticker already does, extending the
          existing device rather than adding a new one. Hidden below sm: —
          there's no margin to spare at kiosk-phone width on a page this
          compact, unlike attract's much roomier canvas.

          Both cards now enter with the same `stagger` rise the rest of the
          kiosk grids use — this screen is the very first thing a customer
          sees after the attract screen's loud entrance, so landing flat felt
          like a step down in energy rather than a step into the flow. */}
      <div className="stagger flex flex-col gap-[var(--space-5)]">
        <div className="relative">
          <span className="absolute -top-3 -right-2 z-10 hidden rotate-6 sm:block">
            <Sticker tone="acid" tilt="r">
              fastest way in
            </Sticker>
          </span>
          {/* The one hand-drawn nudge on this screen, pointing at the
              recommended path — the docs above are explicit that this is
              the route that carries the volume, so this is the one thing
              worth a scribble. Hidden below `lg`: no canvas room to spare
              at kiosk-phone width. */}
          <span className="absolute -top-14 left-8 z-10 hidden -rotate-6 lg:block" aria-hidden>
            <span className="t-hand t-md block text-[var(--color-ink)]">start here</span>
            <HandArrow curve="r" className="mt-1 h-14 w-14 -scale-x-100" />
          </span>
          <Panel tone="pink" lift className="relative flex flex-col gap-[var(--space-3)]">
            {/* Halftone corner accent, print-shop style — the recommended
                panel is the loudest element on this screen, so it's the one
                that earns the one-off texture, kept to a single corner. */}
            <div
              className="halftone pointer-events-none absolute -top-4 -right-4 z-0 hidden h-24 w-24 rounded-[var(--radius-lg)] sm:block"
              aria-hidden
            />
            <div className="relative z-10">
              <Sticker tone="white" tilt="l">
                Most people start here
              </Sticker>
            </div>
            <Heading level={2} step="xl" className="relative z-10">
              Start from a ready-made design
            </Heading>
            <Text step="md" className="relative z-10">
              {templatesLoading
                ? "Loading what we've got made up today…"
                : `${readyCount} design${readyCount === 1 ? "" : "s"} we've already put together. Tap one, swap anything you don't like, done in about three taps.`}
            </Text>
          </Panel>
        </div>

        <div className="relative">
          <span className="absolute -top-3 -left-2 z-10 hidden -rotate-6 sm:block">
            <Sticker tone="sky" tilt="l">
              full control
            </Sticker>
          </span>
          <Panel className="flex flex-col gap-[var(--space-3)]">
            <Heading level={2} step="xl">
              Start from a blank tee
            </Heading>
            <Text step="md" muted>
              Choose the garment first, then add transfers wherever you want them. {designs.length} transfer
              {designs.length === 1 ? "" : "s"} are in the box at this stall right now, and everything you see is
              really here — nothing sells out under you halfway through.
            </Text>
          </Panel>
        </div>
      </div>
    </KioskFrame>
  );
}
