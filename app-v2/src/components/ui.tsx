"use client";

/** Shared primitives.
 *
 *  One set, three skins. A `surface` prop rather than three component families,
 *  because the *behaviour* (press feedback, focus, disabled semantics, target
 *  size) must be identical everywhere — only weight and geometry change.
 *
 *  Every interactive primitive here carries:
 *    - a 48px minimum target (PRD §11's floor, not the 44 the old TabBar used)
 *    - `active:scale-[0.97]` press feedback (the shipped build had none at all)
 *    - a visible focus ring inherited from :focus-visible in globals.css
 *    - a disabled state that stays READABLE — 40% opacity, as the old build
 *      used, drops disabled text below any usable contrast in sunlight. */

import { useEffect, useRef, useState } from "react";
import { clsx } from "./clsx";

export type Surface = "kiosk" | "pos" | "admin";

// ── Button ──────────────────────────────────────────────────────────────────

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "xl";
  surface?: Surface;
  busy?: boolean;
  block?: boolean;
};

export function Button({
  variant = "secondary",
  size = "md",
  surface = "pos",
  busy = false,
  block = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const radius = surface === "kiosk" ? "rounded-2xl" : surface === "admin" ? "rounded-md" : "rounded-xl";

  return (
    <button
      {...rest}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={clsx(
        "relative inline-flex items-center justify-center gap-2 font-semibold",
        "transition-[transform,background-color,color,border-color] duration-[var(--dur-fast)] ease-[var(--ease-out)]",
        "active:scale-[0.97] disabled:active:scale-100",
        // Disabled stays legible. This is a real regression risk: a greyed
        // control a volunteer cannot read is indistinguishable from a bug.
        "disabled:cursor-not-allowed disabled:opacity-60",
        radius,
        {
          // 40px is DELIBERATE and admin-only. The 48px floor exists because a
          // volunteer is thumbing a phone in sunlight with a queue waiting;
          // that reasoning doesn't transfer to a mouse on a 1440px console,
          // where inflating every control to touch size costs the density that
          // makes a dense console useful. Do not use `sm` on kiosk or POS.
          sm: "min-h-[40px] px-3 text-sm",
          md: "min-h-[48px] px-4 text-base",
          lg: "min-h-[56px] px-6 text-lg",
          xl: "min-h-[68px] px-8 text-xl",
        }[size],
        block && "w-full",
        {
          primary: "bg-[var(--color-blue)] text-white hover:bg-[var(--color-blue-deep)]",
          secondary:
            "border-2 border-[var(--color-ink)] bg-transparent text-[var(--color-ink)] hover:bg-[var(--color-ink)] hover:text-[var(--color-cream)]",
          ghost: "text-[var(--color-ink)] hover:bg-black/5",
          danger: "bg-[var(--color-signal)] text-white hover:brightness-110",
        }[variant],
        className
      )}
    >
      {busy && (
        <span
          aria-hidden
          className="animate-spin size-4 rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}

// ── ConfirmAction ───────────────────────────────────────────────────────────

/** Friction, not authorization. Since PIN step-up came out, nothing stood
 *  between a mis-tap and a real price change or refund — this is a two-tap
 *  guard against exactly that, not a permission check. First tap arms it and
 *  swaps in the real stakes (e.g. "Confirm price change to ₹450"); a second
 *  tap within the window commits, and it quietly disarms if left alone. */
export function ConfirmAction({
  label,
  confirmLabel,
  onConfirm,
  variant = "danger",
  size = "md",
  surface = "pos",
  busy = false,
  disabled = false,
  block = false,
  className,
  armMs = 4000,
}: {
  label: React.ReactNode;
  confirmLabel: React.ReactNode;
  onConfirm: () => void;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  surface?: Surface;
  busy?: boolean;
  disabled?: boolean;
  block?: boolean;
  className?: string;
  armMs?: number;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const disarm = () => {
    if (timer.current) clearTimeout(timer.current);
    setArmed(false);
  };

  return (
    <Button
      type="button"
      variant={armed ? "danger" : variant}
      size={size}
      surface={surface}
      busy={busy}
      disabled={disabled}
      block={block}
      className={className}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          timer.current = setTimeout(disarm, armMs);
          return;
        }
        disarm();
        onConfirm();
      }}
      onBlur={disarm}
    >
      {armed ? confirmLabel : label}
    </Button>
  );
}

// ── Chip ────────────────────────────────────────────────────────────────────

export function Chip({
  selected,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      {...rest}
      aria-pressed={selected}
      className={clsx(
        "inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border-2 px-3.5 text-sm font-semibold",
        "transition-[transform,background-color,border-color] duration-[var(--dur-fast)] ease-[var(--ease-out)]",
        "active:scale-[0.97] disabled:opacity-60 disabled:active:scale-100",
        selected
          ? "border-[var(--color-blue)] bg-[var(--color-blue)] text-white"
          : "border-[var(--color-line)] bg-white text-[var(--color-ink)]",
        className
      )}
    >
      {children}
    </button>
  );
}

// ── Field ───────────────────────────────────────────────────────────────────

/** Labels are VISIBLE, not aria-label. The old build used aria-label
 *  throughout — programmatically correct, but it means a sighted volunteer on
 *  the most-used screen in the app has to infer what a box wants from its
 *  placeholder, which vanishes the moment they start typing. */
export function Field({
  label,
  hint,
  error,
  id,
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const inputId = id ?? `f-${label.toLowerCase().replace(/\W+/g, "-")}`;
  const describedBy = error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className="text-sm font-semibold text-[var(--color-ink)]">
        {label}
      </label>
      <input
        {...rest}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={clsx(
          "min-h-[52px] rounded-lg border-2 bg-white px-3.5 text-base",
          "transition-[border-color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-out)]",
          "placeholder:text-[var(--color-muted)]",
          error ? "border-[var(--color-signal)]" : "border-[var(--color-line)] focus:border-[var(--color-blue)]"
        )}
      />
      {error ? (
        <p id={`${inputId}-err`} className="text-sm font-medium text-[var(--color-signal)]">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-sm text-[var(--color-muted)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

// ── Panel ───────────────────────────────────────────────────────────────────

export function Panel({
  title,
  action,
  className,
  children,
  tight,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  tight?: boolean;
}) {
  return (
    <section
      className={clsx("rounded-xl border-2 border-[var(--color-line)] bg-white", tight ? "p-3" : "p-4", className)}
    >
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between gap-3">
          {typeof title === "string" ? (
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">{title}</h2>
          ) : (
            title
          )}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

// ── Banner ──────────────────────────────────────────────────────────────────

/** Banners are ANNOUNCED. The old build rendered them as silent divs, so a
 *  screen-reader user got no signal that a charge failed. `alert` for anything
 *  the user must act on, `status` for anything merely informative. */
export function Banner({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: "info" | "warn" | "danger" | "success";
  title?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const urgent = tone === "danger" || tone === "warn";
  return (
    <div
      role={urgent ? "alert" : "status"}
      aria-live={urgent ? "assertive" : "polite"}
      className={clsx(
        // A full 2px border in the tone colour, not a thick left slab. The
        // colour still carries the meaning — signal is reserved for stop — but
        // border-2 is what every other surface in this system uses, so a
        // banner reads as part of the same family instead of a pasted-on tab.
        "flex items-start gap-3 rounded-lg border-2 p-3.5 text-sm",
        {
          info: "border-[var(--color-blue)] bg-[var(--color-blue-wash)] text-[var(--color-ink)]",
          warn: "border-[var(--color-signal)] bg-[var(--color-signal-wash)] text-[var(--color-ink)]",
          danger: "border-[var(--color-signal)] bg-[var(--color-signal-wash)] text-[var(--color-ink)]",
          success: "border-[var(--color-teal)] bg-[color-mix(in_srgb,var(--color-teal)_10%,white)] text-[var(--color-ink)]",
        }[tone],
        className
      )}
    >
      <div className="flex-1">
        {title && <p className="font-bold">{title}</p>}
        {children && <div className={clsx(title && "mt-0.5")}>{children}</div>}
      </div>
      {action}
    </div>
  );
}

// ── Mono / money ────────────────────────────────────────────────────────────

export function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={clsx("font-[family-name:var(--font-mono)] tnum", className)}>{children}</span>;
}

// ── Empty state / nudge ─────────────────────────────────────────────────────

/** An empty state TEACHES. It never merely states a fact.
 *
 *  "No open tickets" tells a 16-year-old handed a phone minutes before doors
 *  open precisely nothing. "No open tickets yet — new orders from the kiosk
 *  will appear here automatically" tells them the screen is working, what will
 *  happen, and that they do not need to do anything. That difference is the
 *  whole guidance layer, and it is a component category rather than copy
 *  sprinkled into pages. */
export function EmptyState({
  icon,
  headline,
  teach,
  action,
  className,
}: {
  icon?: React.ReactNode;
  headline: string;
  teach: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-[var(--color-line)] px-6 py-10 text-center",
        className
      )}
    >
      {icon && <div className="text-[var(--color-muted)]">{icon}</div>}
      <p className="text-lg font-bold">{headline}</p>
      <p className="max-w-[46ch] text-[var(--color-muted)]">{teach}</p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/** In-flow guidance attached to a specific thing, driven by context rather
 *  than written per screen — the ticket's own contents decide what it says. */
export function Nudge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={clsx(
        "flex items-start gap-2 rounded-md bg-[var(--color-blue-wash)] px-3 py-2 text-sm text-[var(--color-ink)]",
        className
      )}
    >
      <span aria-hidden className="mt-px font-bold text-[var(--color-blue)]">
        →
      </span>
      <span>{children}</span>
    </p>
  );
}

// ── Sheet ───────────────────────────────────────────────────────────────────

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 animate-rise"
        style={{ animationDuration: "var(--dur-fast)" }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-rise relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-2xl bg-[var(--color-cream)] sm:rounded-2xl"
      >
        <header className="flex items-center justify-between gap-3 border-b-2 border-[var(--color-line)] p-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <Button size="md" variant="ghost" onClick={onClose} aria-label="Close">
            ✕
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        {footer && <footer className="border-t-2 border-[var(--color-line)] p-4">{footer}</footer>}
      </div>
    </div>
  );
}

// ── Skeleton ────────────────────────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={clsx("skeleton rounded-lg", className)} />;
}

// ── Stat ────────────────────────────────────────────────────────────────────

export function Stat({
  label,
  value,
  sub,
  emphasis,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={clsx(
        "rounded-xl border-2 p-4",
        emphasis ? "border-[var(--color-blue)] bg-[var(--color-blue-wash)]" : "border-[var(--color-line)] bg-white"
      )}
    >
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">{label}</p>
      <p className={clsx("mt-1.5 font-[family-name:var(--font-mono)] tnum font-bold", emphasis ? "text-3xl" : "text-2xl")}>
        {value}
      </p>
      {sub && <p className="mt-1 text-sm text-[var(--color-muted)]">{sub}</p>}
    </div>
  );
}
