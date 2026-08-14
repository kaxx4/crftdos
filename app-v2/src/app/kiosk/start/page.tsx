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
import { Button, Heading, Panel, Sticker, Text } from "@/components/ui";
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
      <Panel tone="pink" lift className="flex flex-col gap-[var(--space-3)]">
        <div>
          <Sticker tone="white" tilt="l">
            Most people start here
          </Sticker>
        </div>
        <Heading level={2} step="xl">
          Start from a ready-made design
        </Heading>
        <Text step="md">
          {templatesLoading
            ? "Loading what we've got made up today…"
            : `${readyCount} design${readyCount === 1 ? "" : "s"} we've already put together. Tap one, swap anything you don't like, done in about three taps.`}
        </Text>
      </Panel>

      <Panel className="flex flex-col gap-[var(--space-3)]">
        <Heading level={2} step="xl">
          Start from a blank tee
        </Heading>
        <Text step="md" muted>
          Choose the garment first, then add transfers wherever you want them. {designs.length} transfer
          {designs.length === 1 ? "" : "s"} are in the box at this stall right now, and everything you see is really
          here — nothing sells out under you halfway through.
        </Text>
      </Panel>
    </KioskFrame>
  );
}
