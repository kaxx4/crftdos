"use client";

/** The shape every kiosk screen takes.
 *
 *  A stranger walks up to this with no instruction and no learnability budget,
 *  so the frame makes two things structural rather than optional:
 *
 *    1. EVERY SCREEN SAYS WHAT IT IS AND WHAT TO DO NEXT. `title` and `teach`
 *       are required props. There is no way to render a kiosk screen that
 *       leaves a customer guessing, because the type won't compile.
 *    2. EVERY SCREEN HAS A WAY BACK AND A WAY OUT. The head carries the back
 *       control, the foot carries "Start over", and both are always present.
 *       No dead ends.
 *
 *  Regions come from ergonomics, not from the reference: the head and the foot
 *  are fixed, the middle is the only thing that scrolls, and the action that
 *  moves the customer forward lives in the foot where a thumb can always reach
 *  it. `PosScreen` is the shared scaffold for exactly that. */

import Link from "next/link";
import { Button, Heading, PosScreen, Text } from "@/components/ui";
import { clsx } from "@/components/clsx";
import { useKiosk } from "./session";

export function KioskFrame({
  eyebrow,
  title,
  teach,
  back,
  foot,
  children,
  wide = false,
}: {
  eyebrow: string;
  title: string;
  /** One sentence: what this screen is for and what to do on it. */
  teach: string;
  /** Where "Back" goes. Omitted only on the attract screen, which is home. */
  back?: { href: string; label: string };
  /** The action that moves the customer forward. Pinned, never scrolls off. */
  foot?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const { startOver } = useKiosk();

  return (
    <PosScreen className="min-h-dvh bg-[var(--color-paper)]">
      <PosScreen.Head className="px-[var(--space-5)] py-[var(--space-4)]">
        <div className={clsx("mx-auto flex w-full flex-col gap-[var(--space-3)]", wide ? "max-w-6xl" : "max-w-3xl")}>
          <div className="flex items-center justify-between gap-[var(--space-3)]">
            {back ? (
              <Link href={back.href} className="inline-flex">
                <Button surface="kiosk" size="lg" variant="secondary">
                  ← {back.label}
                </Button>
              </Link>
            ) : (
              <span />
            )}
            <p className="t-label text-[var(--color-muted)]">{eyebrow}</p>
          </div>
          <div>
            <Heading level={1} step="xl">
              {title}
            </Heading>
            <Text step="md" className="mt-[var(--space-2)] max-w-[60ch] text-[var(--color-muted)]">
              {teach}
            </Text>
          </div>
        </div>
      </PosScreen.Head>

      <PosScreen.Body className="p-[var(--space-5)]">
        <div className={clsx("mx-auto flex w-full flex-col gap-[var(--space-5)]", wide ? "max-w-6xl" : "max-w-3xl")}>
          {children}
        </div>
      </PosScreen.Body>

      <PosScreen.Foot className="p-[var(--space-4)]">
        <div
          className={clsx(
            "mx-auto flex w-full flex-wrap items-center justify-between gap-[var(--space-3)]",
            wide ? "max-w-6xl" : "max-w-3xl"
          )}
        >
          <Button surface="kiosk" size="lg" variant="ghost" className="text-white" onClick={() => void startOver()}>
            Start over
          </Button>
          <div className="flex flex-wrap items-center gap-[var(--space-4)]">{foot}</div>
        </div>
      </PosScreen.Foot>
    </PosScreen>
  );
}
