"use client";

/** ATTRACT.
 *
 *  The only screen on the kiosk with no chrome, no back control and one thing
 *  to do. It has two jobs and they are in tension: it has to look, from three
 *  metres away across a market, like something worth walking over to — and it
 *  has to make it obvious to the person who does walk over what they are being
 *  offered and what to touch.
 *
 *  So the loudest expression in the product sits here (mega display type, a
 *  hero block, the one marquee band), and directly under it sits a plain
 *  sentence and a single 76px cobalt button. Expressiveness is the point on
 *  this screen; ambiguity is still not.
 *
 *  Colour budget: PINK (hero) + COBALT (the one action). Everything else is
 *  ink, white and paper. The three "how it works" cards are a repeating
 *  collection and therefore one tone — white — no matter how tempting a
 *  three-colour row looks next to the reference. */

import Link from "next/link";
import { Badge, Button, EmptyState, Heading, Panel, Sticker, Text } from "@/components/ui";
import { Mockup } from "./_lib/Mockup";
import { useKiosk } from "./_lib/session";

const STEPS = [
  { n: "1", title: "Pick your tee", body: "Colour, fit and size. We only show what's actually in the box today." },
  { n: "2", title: "Add transfers", body: "Tap a design to drop it on. Drag it where you want it. Real size, no surprises." },
  { n: "3", title: "Collect it pressed", body: "Leave your name, walk away with a code, come back to a finished tee." },
];

export default function KioskAttractPage() {
  const { environment, bound, envLoading, templates, skus } = useKiosk();

  // A real garment photo with a real transfer on it — not an illustration,
  // the actual Mockup component the rest of the kiosk uses to show what you
  // are buying. Featured first, since that's already how the product marks
  // its best examples; falls back to whatever exists so the object never
  // depends on someone having flagged one as featured today.
  const heroTemplate = templates.find((t) => t.is_featured) ?? templates[0];
  const heroSku = heroTemplate ? skus.find((s) => s.id === heroTemplate.payload.product_sku_id) : undefined;

  // An unbound device is a blocking, explained state, never a silent default:
  // a kiosk quietly writing orders into the wrong stall puts a day's takings
  // in the wrong bucket with nothing on screen to reveal it.
  if (!envLoading && !bound) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-[var(--space-5)] p-[var(--space-5)]">
        <EmptyState
          headline="Nearly ready"
          teach="This tablet hasn't been told which stall it's selling for yet, so it can't take an order. A volunteer picks the stall once in settings and this screen turns into the storefront."
          action={
            <Link href="/settings" className="inline-flex">
              <Button surface="kiosk" size="xl" variant="primary">
                Open settings
              </Button>
            </Link>
          }
        />
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col">
      {/* The one decorative loop in the product, and it is on the one screen
          where nobody is reading a number. Reduced motion kills it outright. */}
      <div className="on-deep overflow-hidden border-b-[3px] border-[var(--color-ink)] bg-[var(--color-ink)] py-[var(--space-3)] text-white">
        <div className="animate-marquee flex w-max gap-[var(--space-5)] whitespace-nowrap">
          {Array.from({ length: 2 }).map((_, i) => (
            <p key={i} className="t-label flex gap-[var(--space-5)]" aria-hidden={i === 1}>
              <span>Design your own tee</span>
              <span>★</span>
              <span>Pressed while you wait</span>
              <span>★</span>
              <span>Every rupee funds AQUATERRA</span>
              <span>★</span>
              <span>Design your own tee</span>
              <span>★</span>
              <span>Pressed while you wait</span>
              <span>★</span>
              <span>Every rupee funds AQUATERRA</span>
              <span>★</span>
            </p>
          ))}
        </div>
      </div>

      <div className="relative mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-[var(--space-6)] p-[var(--space-5)]">
        {/* Ambient decoration, not a repeating collection — the STEPS row
            below stays strictly one tone per its own comment, but these are
            one-off badges scattered around empty canvas, extending the same
            sticker the hero already carried rather than inventing a new
            device. Small and few enough that they read as stickers, not a
            third colour block: DESIGN-SPEC's budget is about panel-scale
            fills, not sticker-scale accents.
            Placed to relate to what's near them, not float in their own
            zone: the two upper ones peek off the hero's own corners (the
            same "breaks the frame" move as the Popular badge on /kiosk/
            ready), and the lower one leans toward the CTA button rather
            than sitting in dead space beside it. Sizes vary on purpose —
            two are the standard Sticker size, one is scaled up — so no two
            neighbours are the same weight. */}
        <span className="absolute -top-2 left-2 z-10 hidden -rotate-6 sm:block md:left-8">
          <Sticker tone="acid" tilt="l">
            ★ handmade
          </Sticker>
        </span>
        <span className="absolute -top-3 right-2 z-10 hidden scale-125 rotate-3 sm:block md:right-10">
          <Sticker tone="sky" tilt="r">
            no two alike
          </Sticker>
        </span>
        <span className="absolute bottom-16 left-4 z-10 hidden -rotate-3 md:block lg:left-12">
          <Sticker tone="yellow" tilt="l">
            takes ~1 min
          </Sticker>
        </span>

        <Panel tone="pink" lift className="relative animate-rise text-center">
          <div className="mb-[var(--space-4)] flex justify-center">
            <Sticker tone="white" tilt="r">
              crftd ★ {environment?.name ?? "stall"}
            </Sticker>
          </div>
          <Heading level={1} step="mega" display>
            Make a tee that
            <br />
            nobody else has.
          </Heading>
          <Text step="md" className="mx-auto mt-[var(--space-4)] max-w-[46ch]">
            Choose a garment, press your transfers onto it, and pick it up finished. Takes about a minute, and you do
            all of it yourself.
          </Text>

          {/* The hero object — a real garment mockup with a real transfer on
              it, not an illustration. Every strong poster in the reference
              set has an actual THING anchoring it, not just type and shapes;
              this is the honest version of that for a product that already
              has real photography. Peeking off the hero panel's OWN corner
              (not the outer column — that positioned it below the steps grid
              instead, a real bug caught by screenshot, not assumed away).
              right-4 rather than a negative offset: this must never be able
              to push the page sideways, and a bottom-only peek can't. Skipped
              entirely without a template that has a real mockup image — a
              "no photo yet" placeholder has no business being decoration. */}
          {heroTemplate && heroSku?.mockup_front && (
            <span className="absolute -bottom-10 right-4 z-10 hidden rotate-6 md:block">
              <Mockup
                sku={heroSku}
                placements={heroTemplate.payload.placements}
                side="front"
                className="w-28 shadow-[var(--shadow-block)] lg:w-36"
              />
            </span>
          )}
        </Panel>

        <div className="flex flex-col items-center gap-[var(--space-3)]">
          <Link href="/kiosk/start" className="inline-flex w-full max-w-md">
            <Button surface="kiosk" size="xl" variant="primary" block>
              Start designing →
            </Button>
          </Link>
          <Text step="base" muted>
            No account, no app. A volunteer is right here if you get stuck.
          </Text>
        </div>

        <div className="stagger grid gap-[var(--space-3)] sm:grid-cols-3">
          {STEPS.map((s) => (
            <Panel key={s.n} className="flex flex-col gap-[var(--space-2)]">
              <Badge tone="white">Step {s.n}</Badge>
              <Heading level={2} step="lg">
                {s.title}
              </Heading>
              <Text step="base" muted>
                {s.body}
              </Text>
            </Panel>
          ))}
        </div>
      </div>
    </main>
  );
}
