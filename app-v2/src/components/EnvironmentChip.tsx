"use client";

/** The environment chip.
 *
 *  Top-left, every page, every surface. Fresh Plan §7 is explicit about this
 *  and it is not decoration: an order written into the wrong environment is
 *  not recoverable from the UI, so nobody may ever be unsure which environment
 *  a device is writing into.
 *
 *  Three states, and the unbound one is the important one — it is a blocking
 *  problem rendered as a call to action rather than a silent default, because
 *  silently defaulting to "cloud" is how a stall's whole day lands in the
 *  wrong bucket. */

import Link from "next/link";
import { clsx } from "./clsx";
import { useEnvironment } from "@/lib/hooks/useEnvironment";

export function EnvironmentChip({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const { environment, loading, bound } = useEnvironment();

  if (loading) {
    return <span className={clsx("skeleton inline-block h-8 w-40 rounded-lg", className)} />;
  }

  if (!bound || !environment) {
    return (
      <Link
        href="/settings"
        className={clsx(
          "tap-target inline-flex items-center gap-2 rounded-[var(--radius-md)] border-[3px] border-[var(--color-ink)] bg-[var(--color-signal)] px-3 t-sm font-extrabold text-white",
          "transition-[transform,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-out)]",
          "active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
          className
        )}
      >
        <span aria-hidden>⚠</span>
        This device isn&apos;t set up — tap to choose
      </Link>
    );
  }

  const kindLabel = { cloud: "Cloud", stall: "Stall", online: "Online" }[environment.kind];

  return (
    <Link
      href="/settings"
      title={`Writing into ${environment.name}. Tap to change.`}
      className={clsx(
        // Full POS tap floor, not a reduced one. This chip renders on the
        // volunteer's phone and the kiosk tablet, so it lives under the same
        // touch rules as everything else on those surfaces.
        "tap-target inline-flex items-center gap-2 rounded-[var(--radius-md)] border-[3px] px-2.5 t-sm font-extrabold",
        "transition-[transform,box-shadow,border-color] duration-[var(--dur-fast)] ease-[var(--ease-out)]",
        "active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
        tone === "dark"
          ? "border-white bg-white/10 text-white"
          : "border-[var(--color-ink)] bg-white text-[var(--color-ink)]",
        className
      )}
    >
      <span
        aria-hidden
        className={clsx(
          // Deep blocks only — this badge always carries white text, so it may
          // never take a bright block (white on those is under 2.5:1).
          "font-[family-name:var(--font-mono)] rounded-[var(--radius-sm)] px-1.5 py-0.5 t-xs",
          environment.kind === "cloud"
            ? "bg-[var(--color-muted)] text-white"
            : environment.kind === "online"
              ? "bg-[var(--color-acid-deep)] text-white"
              : "bg-[var(--color-cobalt)] text-white"
        )}
      >
        {environment.prefix}
      </span>
      <span className="max-w-[22ch] truncate">{environment.name}</span>
      <span className="sr-only">({kindLabel} environment. Tap to change which environment this device writes into.)</span>
    </Link>
  );
}
