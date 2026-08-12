"use client";

/** The storefront — the genuinely new layer in this rework.
 *
 *  The old kiosk opened straight into a stage machine with no home or browse
 *  layer: a customer walked up to a tool. This opens onto merchandise, which
 *  is the right frame, because most customers do not want to design anything.
 *  They want the one they saw on Instagram. Templates carry that; "start
 *  blank" is there for the minority who actually want the canvas.
 *
 *  Visual register is deliberately the loudest in the app. This is the surface
 *  people photograph, so it carries the brand load (PRD D19) while POS stays
 *  restrained. */

import Link from "next/link";
import type { ProductSku, Template } from "@/lib/domain/types";
import { money } from "@/lib/money";
import { Button, Skeleton } from "@/components/ui";
import { TemplateCard } from "./TemplateCard";

export function Storefront({
  templates,
  skus,
  loading,
  designCount,
  onOpenTemplate,
  onStartBlank,
}: {
  templates: Template[];
  skus: ProductSku[];
  loading: boolean;
  designCount: number;
  onOpenTemplate: (t: Template) => void;
  onStartBlank: () => void;
}) {
  const featured = templates.filter((t) => t.is_featured);
  const rest = templates.filter((t) => !t.is_featured);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 md:px-8">
      {/* Hero. One idea, stated once, at a size you can read from two metres
          back — which is the actual viewing distance for a tablet on a table. */}
      <section className="animate-rise mb-10">
        <p className="mb-2 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-[0.24em] text-[var(--color-blue)]">
          Design it here · wear it home
        </p>
        <h1 className="text-5xl font-extrabold leading-[0.95] tracking-tight md:text-7xl">
          Build{" "}
          <span className="font-[family-name:var(--font-display)] italic text-[var(--color-blue)]">yours</span>.
        </h1>
        <p className="mt-4 max-w-[52ch] text-lg text-[var(--color-muted)] md:text-xl">
          Pick a design below and make it your own, or start from a blank tee. Every one you buy funds AQUATERRA&apos;s
          water and land work.
        </p>
      </section>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5]" />
          ))}
        </div>
      ) : (
        <>
          {featured.length > 0 && (
            <section className="mb-12">
              <div className="mb-4 flex items-baseline justify-between gap-4">
                <h2 className="text-2xl font-extrabold tracking-tight">Most popular</h2>
                <p className="text-sm text-[var(--color-muted)]">What everyone&apos;s buying today</p>
              </div>
              <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {featured.map((t) => (
                  <TemplateCard key={t.id} template={t} skus={skus} onOpen={() => onOpenTemplate(t)} featured />
                ))}
              </div>
            </section>
          )}

          {rest.length > 0 && (
            <section className="mb-12">
              <h2 className="mb-4 text-2xl font-extrabold tracking-tight">More designs</h2>
              <div className="stagger grid grid-cols-2 gap-4 lg:grid-cols-4">
                {rest.map((t) => (
                  <TemplateCard key={t.id} template={t} skus={skus} onOpen={() => onOpenTemplate(t)} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Start blank. Given real weight rather than a text link, because it is
          a genuine second path, not an escape hatch. */}
      <section className="animate-rise overflow-hidden rounded-2xl border-2 border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-cream)]">
        <div className="crop-marks flex flex-col items-start gap-5 p-8 md:flex-row md:items-center md:justify-between md:p-10">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Start from scratch</h2>
            <p className="mt-2 max-w-[46ch] text-[var(--color-cream)]/75">
              Choose a tee, then drag on any of our {designCount} transfers. Everything shows at its real printed
              size, so what you see is what you get.
            </p>
          </div>
          <Button surface="kiosk" size="xl" variant="primary" onClick={onStartBlank} className="shrink-0">
            Open the canvas
          </Button>
        </div>
      </section>

      <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--color-muted)]">
        <p>Tees from {money(499)} · transfers from {money(99)}</p>
        <p>crftd is the commercial arm of AQUATERRA / TerraRoots</p>
      </footer>

      {/* Volunteers/admins need a way into /pin from the public kiosk that
          isn't "type the URL from memory." Deliberately subtle — this is a
          customer-facing surface, not a staff one. */}
      <Link
        href="/pin"
        className="tap-target fixed bottom-4 left-4 z-10 flex min-h-[48px] min-w-[48px] items-center px-2 py-1 font-[family-name:var(--font-mono)] text-[13px] uppercase tracking-[0.14em] text-[var(--color-muted)]"
      >
        Staff passcode
      </Link>
    </main>
  );
}
