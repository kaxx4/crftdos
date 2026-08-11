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
          "tap-target inline-flex items-center gap-2 rounded-lg border-2 border-[var(--color-signal)] bg-[var(--color-signal)] px-3 text-sm font-bold text-white",
          "transition-transform duration-[var(--dur-fast)] active:scale-[0.97]",
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
        // 44px floor, not 36. This chip renders on the volunteer's phone and
        // the kiosk tablet, so it lives under the same touch rules as
        // everything else on those surfaces.
        "inline-flex min-h-[44px] items-center gap-2 rounded-lg border-2 px-2.5 text-sm font-bold",
        "transition-[transform,border-color] duration-[var(--dur-fast)] active:scale-[0.97]",
        tone === "dark"
          ? "border-white/25 bg-white/10 text-white"
          : "border-[var(--color-line)] bg-white text-[var(--color-ink)]",
        className
      )}
    >
      <span
        aria-hidden
        className={clsx(
          "font-[family-name:var(--font-mono)] rounded px-1.5 py-0.5 text-xs",
          environment.kind === "cloud"
            ? "bg-[var(--color-muted)] text-white"
            : environment.kind === "online"
              ? "bg-[var(--color-teal)] text-white"
              : "bg-[var(--color-blue)] text-white"
        )}
      >
        {environment.prefix}
      </span>
      <span className="max-w-[22ch] truncate">{environment.name}</span>
      <span className="sr-only">({kindLabel} environment. Tap to change which environment this device writes into.)</span>
    </Link>
  );
}
