"use client";

/** Shared primitives — the Y2K colour-block layer.
 *
 *  Binding contract: app-v2/DESIGN-SPEC.md.
 *
 *  The rule this file exists to enforce: composing these primitives should
 *  produce a correct screen, and writing custom CSS should be what produces a
 *  wrong one. If a sibling agent finds themselves typing a hex value or a
 *  `rounded-[13px]`, the primitive is missing — extend this file rather than
 *  hand-rolling in a page.
 *
 *  Two hard invariants baked in here:
 *
 *  1. FOREGROUND SAFETY. Block colours carry their own legal text colour.
 *     `tone` picks the fill AND the foreground together; there is no way to
 *     put white text on yellow through this API, because that pairing is
 *     2.0:1 and unreadable in daylight.
 *
 *  2. TARGET SIZE. Every interactive primitive takes a `surface`, and the
 *     surface sets the minimum target: 56px POS, 64px kiosk, 40px admin.
 */

import { useEffect, useId, useRef, useState } from "react";
import { clsx } from "./clsx";

export type Surface = "kiosk" | "pos" | "admin";

/* ── Tone system ───────────────────────────────────────────────────────────
   The closed set of colour-block fills. Each entry pairs a background with the
   ONLY foreground that meets WCAG AA on it. Nothing outside this map may be
   used as a panel fill. */

export type Tone =
  | "paper"
  | "white"
  | "ink"
  | "pink"
  | "acid"
  | "yellow"
  | "orange"
  | "lilac"
  | "sky"
  | "cobalt"
  | "pinkDeep"
  | "acidDeep"
  | "orangeDeep"
  | "signal";

/** Bright blocks take ink; deep blocks take white. This is not a preference. */
const TONE_FILL: Record<Tone, string> = {
  paper: "bg-[var(--color-paper)] text-[var(--color-ink)]",
  white: "bg-white text-[var(--color-ink)]",
  ink: "bg-[var(--color-ink)] text-white on-deep",
  pink: "bg-[var(--color-pink)] text-[var(--color-ink)]",
  acid: "bg-[var(--color-acid)] text-[var(--color-ink)]",
  yellow: "bg-[var(--color-yellow)] text-[var(--color-ink)]",
  orange: "bg-[var(--color-orange)] text-[var(--color-ink)]",
  lilac: "bg-[var(--color-lilac)] text-[var(--color-ink)]",
  sky: "bg-[var(--color-sky)] text-[var(--color-ink)]",
  cobalt: "bg-[var(--color-cobalt)] text-white on-deep",
  pinkDeep: "bg-[var(--color-pink-deep)] text-white on-deep",
  acidDeep: "bg-[var(--color-acid-deep)] text-white on-deep",
  orangeDeep: "bg-[var(--color-orange-deep)] text-white on-deep",
  signal: "bg-[var(--color-signal)] text-white on-deep",
};

/** True where the tone is a dark fill, so callers can pick a matching ring or
 *  secondary text colour without re-deriving the contrast maths. */
export const TONE_IS_DEEP: Record<Tone, boolean> = {
  paper: false, white: false, pink: false, acid: false, yellow: false,
  orange: false, lilac: false, sky: false,
  ink: true, cobalt: true, pinkDeep: true, acidDeep: true, orangeDeep: true, signal: true,
};

/** Secondary/label text that is legible on top of the tone. On a block colour
 *  there is no legal "grey" — you dim with opacity on the same ink instead. */
export function toneMuted(tone: Tone): string {
  if (tone === "paper" || tone === "white") return "text-[var(--color-muted)]";
  return TONE_IS_DEEP[tone] ? "text-white/80" : "text-[var(--color-ink)]/70";
}

const TAP: Record<Surface, string> = {
  pos: "min-h-[var(--tap-pos)]",
  kiosk: "min-h-[var(--tap-kiosk)]",
  admin: "min-h-[var(--tap-admin)]",
};

const SURFACE_RADIUS: Record<Surface, string> = {
  pos: "rounded-[var(--radius-lg)]",
  kiosk: "rounded-[var(--radius-xl)]",
  admin: "rounded-[var(--radius-sm)]",
};

// ── Button ──────────────────────────────────────────────────────────────────

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "block";
  /** Colour-block fill, only meaningful with variant="block". */
  tone?: Tone;
  size?: "sm" | "md" | "lg" | "xl";
  surface?: Surface;
  busy?: boolean;
  block?: boolean;
};

/** The workhorse.
 *
 *  `size` is scoped by surface, not free: `sm` is ADMIN-ONLY. The 56px floor
 *  exists because a volunteer is thumbing a phone in sunlight with a queue
 *  waiting; that reasoning does not transfer to a mouse on a 1440px console,
 *  where inflating every control to touch size costs the density that makes a
 *  dense console useful. Do not use `sm` on kiosk or POS.
 *
 *  Every button is a hard-edged object: 3px ink border and a hard offset
 *  shadow that collapses on press. There is no blurred elevation anywhere in
 *  this system. */
export function Button({
  variant = "secondary",
  tone = "yellow",
  size = "md",
  surface = "pos",
  busy = false,
  block = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const isDeep = variant === "primary" || variant === "danger" || (variant === "block" && TONE_IS_DEEP[tone]);

  return (
    <button
      {...rest}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={clsx(
        "relative inline-flex items-center justify-center gap-2 border-[3px] border-[var(--color-ink)]",
        "font-extrabold tracking-[-0.01em]",
        "transition-[transform,box-shadow,background-color,color] duration-[var(--dur-fast)] ease-[var(--ease-out)]",
        // The press: the object travels into its own shadow. This is the
        // signature feedback of the system and every control shares it.
        "shadow-[var(--shadow-sticker)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
        "disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-x-0 disabled:active:translate-y-0",
        "disabled:active:shadow-[var(--shadow-sticker)]",
        SURFACE_RADIUS[surface],
        isDeep && "on-deep",
        {
          sm: "min-h-[var(--tap-admin)] px-3 text-[length:var(--text-sm)]",
          md: "min-h-[var(--tap-pos)] px-4 text-[length:var(--text-base)]",
          lg: "min-h-[64px] px-6 text-[length:var(--text-md)]",
          xl: "min-h-[76px] px-8 text-[length:var(--text-lg)]",
        }[size],
        block && "w-full",
        {
          // Primary is COBALT everywhere. One primary action per region.
          primary: "bg-[var(--color-cobalt)] text-white hover:bg-[var(--color-cobalt-deep)]",
          secondary: "bg-white text-[var(--color-ink)] hover:bg-[var(--color-paper-2)]",
          // Ghost is the only borderless, shadowless control. Tertiary only.
          ghost:
            "border-transparent bg-transparent text-[var(--color-ink)] shadow-none hover:bg-[var(--color-ink)]/8 " +
            "active:translate-x-0 active:translate-y-0 active:shadow-none",
          danger: "bg-[var(--color-signal)] text-white hover:bg-[var(--color-signal-deep)]",
          block: TONE_FILL[tone],
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

/** Friction, not authorization. Nothing stands between a mis-tap and a real
 *  price change or refund — this is a two-tap guard against exactly that, not
 *  a permission check. First tap arms it and swaps in the real stakes; a
 *  second tap within the window commits, and it quietly disarms if left alone.
 *
 *  Armed state escalates to the heaviest border in the system. */
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
      className={clsx(armed && "border-[5px] animate-pop", className)}
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

// ── Panel — THE SIGNATURE PRIMITIVE ─────────────────────────────────────────

/** A flat colour-block surface with a hard ink edge.
 *
 *  This is what makes the app look like the reference. A screen is a stack of
 *  these, MOSTLY WHITE OR PAPER, with one or two carrying a saturated tone.
 *  See DESIGN-SPEC.md §2 for the proportion rule — a screen where every panel
 *  is a different colour is confetti, not colour-block, and is the single most
 *  likely way this direction gets ruined.
 *
 *  `title` renders as a label-step eyebrow. `lift` adds the heavy 6px offset
 *  shadow and is reserved for the ONE hero panel on a screen. */
export function Panel({
  title,
  action,
  tone = "white",
  lift = false,
  tilt,
  className,
  children,
  tight,
  as: As = "section",
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  tone?: Tone;
  lift?: boolean;
  tilt?: "l" | "r";
  className?: string;
  children: React.ReactNode;
  tight?: boolean;
  as?: "section" | "div" | "article" | "aside";
}) {
  return (
    <As
      className={clsx(
        "border-[3px] border-[var(--color-ink)] rounded-[var(--radius-lg)]",
        TONE_FILL[tone],
        lift && "shadow-[var(--shadow-block)]",
        tilt === "l" && "sticker-tilt-l",
        tilt === "r" && "sticker-tilt-r",
        tight ? "p-[var(--space-3)]" : "p-[var(--space-4)]",
        className
      )}
    >
      {(title || action) && (
        <header className="mb-[var(--space-3)] flex items-center justify-between gap-[var(--space-3)]">
          {typeof title === "string" ? (
            <h2 className={clsx("t-label", toneMuted(tone))}>{title}</h2>
          ) : (
            title
          )}
          {action}
        </header>
      )}
      {children}
    </As>
  );
}

/** Alias. Some surfaces read better as "Card"; identical behaviour. */
export const Card = Panel;

// ── Typography ──────────────────────────────────────────────────────────────

type Step = "mega" | "xxl" | "xl" | "lg" | "md" | "base" | "sm" | "xs" | "label";

const STEP_CLASS: Record<Step, string> = {
  mega: "t-mega", xxl: "t-xxl", xl: "t-xl", lg: "t-lg", md: "t-md",
  base: "t-base", sm: "t-sm", xs: "t-xs", label: "t-label",
};

/** Headings carry a type STEP, not a size. The step already sets weight,
 *  line-height and tracking — do not override them in a page. */
export function Heading({
  level = 2,
  step,
  display = false,
  className,
  children,
}: {
  level?: 1 | 2 | 3 | 4;
  step?: Step;
  /** Fraunces 900 italic. Display only, never below the `xl` step. */
  display?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4";
  const resolved: Step = step ?? (["xxl", "xl", "lg", "md"] as const)[level - 1];
  return (
    <Tag className={clsx(STEP_CLASS[resolved], display && "t-display", className)}>
      {children}
    </Tag>
  );
}

export function Text({
  step = "base",
  muted = false,
  mono = false,
  className,
  children,
}: {
  step?: Step;
  muted?: boolean;
  mono?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p
      className={clsx(
        STEP_CLASS[step],
        muted && "text-[var(--color-muted)]",
        mono && "font-[family-name:var(--font-mono)] tnum",
        className
      )}
    >
      {children}
    </p>
  );
}

/** Money, counts, codes, timers. Tabular so digits do not jitter as they
 *  update — a total that reflows while a customer is watching reads as a bug. */
export function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={clsx("font-[family-name:var(--font-mono)] tnum", className)}>{children}</span>;
}

// ── Badge / Sticker ─────────────────────────────────────────────────────────

/** Non-interactive status marker. Small, loud, ink-edged. */
export function Badge({
  tone = "yellow",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-[var(--radius-pill)] border-2 border-[var(--color-ink)]",
        "px-2.5 py-1 t-xs whitespace-nowrap",
        TONE_FILL[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/** A Badge that has been physically pressed on: tilted, hard-shadowed. Use it
 *  for the one thing on a panel that should feel applied rather than printed —
 *  a price flash, a "NEW", a shift state. At most one per panel. */
export function Sticker({
  tone = "pink",
  tilt = "l",
  className,
  children,
}: {
  tone?: Tone;
  tilt?: "l" | "r";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-[var(--radius-pill)] border-[3px] border-[var(--color-ink)]",
        "px-3 py-1.5 t-xs uppercase shadow-[var(--shadow-sticker)]",
        tilt === "l" ? "sticker-tilt-l" : "sticker-tilt-r",
        TONE_FILL[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

// ── Chip ────────────────────────────────────────────────────────────────────

/** Interactive selection. Selected is a filled colour-block; unselected is
 *  white with an ink edge. Never signal selection with colour alone —
 *  `aria-pressed` carries it for assistive tech and the border weight carries
 *  it visually for a colour-blind operator. */
export function Chip({
  selected,
  tone = "cobalt",
  surface = "pos",
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
  tone?: Tone;
  surface?: Surface;
}) {
  return (
    <button
      {...rest}
      aria-pressed={selected}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-4 t-sm font-extrabold",
        "border-[var(--color-ink)] transition-[transform,box-shadow,background-color] duration-[var(--dur-fast)] ease-[var(--ease-out)]",
        "active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
        "disabled:opacity-60 disabled:active:translate-x-0 disabled:active:translate-y-0",
        TAP[surface],
        selected
          ? clsx("border-[3px] shadow-[var(--shadow-sticker)]", TONE_FILL[tone])
          : "border-2 bg-white text-[var(--color-ink)] shadow-none",
        className
      )}
    >
      {children}
    </button>
  );
}

// ── Field / Input ───────────────────────────────────────────────────────────

/** Labels are VISIBLE, not aria-label. A programmatically-correct aria-label
 *  still means a sighted volunteer on the most-used screen in the app has to
 *  infer what a box wants from a placeholder that vanishes the moment they
 *  start typing. */
export function Field({
  label,
  hint,
  error,
  id,
  className,
  surface = "pos",
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
  surface?: Surface;
}) {
  const auto = useId();
  const inputId = id ?? `f${auto}`;
  const describedBy = error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className={clsx("flex flex-col gap-[var(--space-1)]", className)}>
      <label htmlFor={inputId} className="t-label text-[var(--color-ink)]">
        {label}
      </label>
      <input
        {...rest}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={clsx(
          "w-full rounded-[var(--radius-md)] border-[3px] bg-white px-3.5 t-base",
          "transition-[border-color,background-color] duration-[var(--dur-fast)] ease-[var(--ease-out)]",
          "placeholder:text-[var(--color-muted)]",
          TAP[surface],
          error
            ? "border-[var(--color-signal)] bg-[var(--color-signal-wash)]"
            : "border-[var(--color-ink)] focus:bg-[var(--color-yellow-wash)]"
        )}
      />
      {error ? (
        <p id={`${inputId}-err`} className="t-sm font-bold text-[var(--color-signal)]">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="t-sm text-[var(--color-muted)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Same shell, for a <select> or any custom control that must line up with a
 *  Field in a form column. */
export function FieldShell({
  label,
  hint,
  error,
  htmlFor,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={clsx("flex flex-col gap-[var(--space-1)]", className)}>
      <label htmlFor={htmlFor} className="t-label text-[var(--color-ink)]">
        {label}
      </label>
      {children}
      {error ? (
        <p className="t-sm font-bold text-[var(--color-signal)]">{error}</p>
      ) : hint ? (
        <p className="t-sm text-[var(--color-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

/* ── Select / Textarea / Checkbox ───────────────────────────────────────────
   The rest of the `Field` family. These were hand-rolled twice — once in
   `features/pos/controls.tsx`, once in `features/admin/AdminShell.tsx` —
   which is how six admin pages ended up carrying a select at four different
   heights and one POS select ended up 8px under the POS target floor. They
   live here now, surface-aware like every other interactive primitive, and
   they share `Field`'s geometry, label rule and error/hint wiring exactly so
   the four read as one family in a form column. */

/** The shared box geometry: `Field`'s input, minus the height. */
const CONTROL_BOX =
  "w-full rounded-[var(--radius-md)] border-[3px] bg-white px-3.5 t-base " +
  "transition-[border-color,background-color] duration-[var(--dur-fast)] ease-[var(--ease-out)] " +
  "placeholder:text-[var(--color-muted)] disabled:cursor-not-allowed disabled:opacity-60";

/** Error state paints the box; otherwise the focus wash. Identical to `Field`
 *  so a form column does not have two different ideas of what "wrong" looks
 *  like. */
function controlState(error?: string): string {
  return error
    ? "border-[var(--color-signal)] bg-[var(--color-signal-wash)]"
    : "border-[var(--color-ink)] focus:bg-[var(--color-yellow-wash)]";
}

/** The message row under a control. Error wins over hint, both are wired to
 *  the control through `aria-describedby`. */
function ControlMessage({ id, hint, error }: { id: string; hint?: string; error?: string }) {
  if (error) {
    return (
      <p id={`${id}-err`} className="t-sm font-bold text-[var(--color-signal)]">
        {error}
      </p>
    );
  }
  if (hint) {
    return (
      <p id={`${id}-hint`} className="t-sm text-[var(--color-muted)]">
        {hint}
      </p>
    );
  }
  return null;
}

function describedBy(id: string, hint?: string, error?: string): string | undefined {
  return error ? `${id}-err` : hint ? `${id}-hint` : undefined;
}

/** A native `<select>`, styled — deliberately not a custom listbox.
 *
 *  A hand-built listbox on a tablet gives up the platform's own picker (a
 *  full-screen wheel on iOS, a touch-sized sheet on Android), and has to
 *  re-implement typeahead, keyboard roving and screen-reader semantics that
 *  the native element already gets right. On the surface where a volunteer is
 *  picking a SKU one-handed with a queue waiting, that trade is not close.
 *
 *  So: native element, `appearance-none`, and OUR chevron drawn on top. The
 *  platform arrow is the one part of a select that cannot be styled to match
 *  a 3px-ink system, and it is the only part that is purely decorative — the
 *  control stays fully native underneath.
 *
 *  Label is visible, as everywhere else. `labelHidden` is the single agreed
 *  exception; see the prop. */
export function Select({
  label,
  labelHidden = false,
  hint,
  error,
  id,
  className,
  surface = "pos",
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  /** Renders the label into an `sr-only` span instead of dropping it.
   *
   *  ONLY for a control inside an admin table cell, where the column head is
   *  already the visible label and repeating it on every row is noise rather
   *  than help. The `<label>` element still exists and is still associated, so
   *  the accessible name survives — this hides a label, it never removes one.
   *  Never on a form. */
  labelHidden?: boolean;
  hint?: string;
  error?: string;
  surface?: Surface;
}) {
  const auto = useId();
  const selectId = id ?? `s${auto}`;

  return (
    <div className={clsx("flex flex-col gap-[var(--space-1)]", className)}>
      <label htmlFor={selectId} className={clsx("t-label text-[var(--color-ink)]", labelHidden && "sr-only")}>
        {label}
      </label>
      <div className="relative">
        <select
          {...rest}
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(selectId, hint, error)}
          className={clsx(
            CONTROL_BOX,
            // Room for our chevron, and the platform arrow suppressed.
            "appearance-none pr-[var(--space-6)] font-semibold",
            TAP[surface],
            controlState(error)
          )}
        >
          {children}
        </select>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-[var(--space-3)] flex items-center text-[var(--color-ink)]"
        >
          ▾
        </span>
      </div>
      <ControlMessage id={selectId} hint={hint} error={error} />
    </div>
  );
}

/** A multi-line `Field`. The surface floor is a MINIMUM here, not a height —
 *  `rows` grows it from there. */
export function Textarea({
  label,
  hint,
  error,
  id,
  className,
  surface = "pos",
  rows = 3,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  error?: string;
  surface?: Surface;
}) {
  const auto = useId();
  const areaId = id ?? `t${auto}`;

  return (
    <div className={clsx("flex flex-col gap-[var(--space-1)]", className)}>
      <label htmlFor={areaId} className="t-label text-[var(--color-ink)]">
        {label}
      </label>
      <textarea
        {...rest}
        id={areaId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(areaId, hint, error)}
        className={clsx(CONTROL_BOX, "py-3", TAP[surface], controlState(error))}
      />
      <ControlMessage id={areaId} hint={hint} error={error} />
    </div>
  );
}

/** A checkbox whose TAP TARGET is the whole row, not the 24px box.
 *
 *  A bare `<input type="checkbox">` is roughly 20px on every platform — a
 *  quarter of the POS floor and a tenth of the kiosk one. Rather than inflate
 *  the box (which browsers style inconsistently and which looks wrong next to
 *  a 3px-ink input), the LABEL is the control: the whole ink-edged row is the
 *  hit area and carries the surface floor, so the box being small costs
 *  nothing. That is why `label` is required and there is no unlabelled mode. */
export function Checkbox({
  label,
  hint,
  error,
  id,
  className,
  surface = "pos",
  ...rest
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: React.ReactNode;
  hint?: string;
  error?: string;
  surface?: Surface;
}) {
  const auto = useId();
  const boxId = id ?? `c${auto}`;

  return (
    <div className={clsx("flex flex-col gap-[var(--space-1)]", className)}>
      <label
        htmlFor={boxId}
        className={clsx(
          "flex cursor-pointer items-center gap-[var(--space-3)] rounded-[var(--radius-md)] border-[3px] px-[var(--space-3)]",
          "t-base font-bold",
          "transition-[border-color,background-color] duration-[var(--dur-fast)] ease-[var(--ease-out)]",
          "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60",
          TAP[surface],
          controlState(error)
        )}
      >
        <input
          {...rest}
          type="checkbox"
          id={boxId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(boxId, hint, error)}
          className="size-6 shrink-0 accent-[var(--color-cobalt)]"
        />
        <span>{label}</span>
      </label>
      <ControlMessage id={boxId} hint={hint} error={error} />
    </div>
  );
}

// ── Table ───────────────────────────────────────────────────────────────────

/** Admin tables. Wide content scrolls INSIDE this container — the page body
 *  must never scroll horizontally, or a table becomes impossible to read
 *  against a fixed header. */
export function Table({
  head,
  children,
  className,
  caption,
}: {
  head: React.ReactNode[];
  children: React.ReactNode;
  className?: string;
  caption?: string;
}) {
  return (
    /* Three things here are load-bearing, and the page scrolls sideways on a
       phone without any one of them:
         min-w-0   — this is usually a flex item, and a flex item's default
                     min-width:auto sizes it to max-content, so a table with a
                     min-width grew the box instead of scrolling inside it.
         relative  — makes this the containing block for absolutely-positioned
                     descendants. An abspos box whose containing block sits
                     OUTSIDE a scrollport is not clipped by it, so the sr-only
                     caption and cell labels — 1px, invisible, laid out at the
                     far edge of a 981px table — dragged the document 544px
                     wide while everything visible looked perfectly contained.
         overflow-x-auto — the actual scroller. */
    <div className="relative min-w-0 overflow-x-auto rounded-[var(--radius-md)] border-[3px] border-[var(--color-ink)] bg-white">
      <table className={clsx("w-full border-collapse text-left", className)}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="bg-[var(--color-ink)] text-white">
            {head.map((h, i) => (
              <th key={i} scope="col" className="t-label whitespace-nowrap px-3 py-2.5">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-t-2 [&>tr]:border-[var(--color-line-soft)]">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({
  children,
  mono = false,
  className,
  ...rest
}: React.TdHTMLAttributes<HTMLTableCellElement> & { mono?: boolean }) {
  return (
    <td
      {...rest}
      className={clsx("px-3 py-2.5 t-sm align-middle", mono && "font-[family-name:var(--font-mono)] tnum", className)}
    >
      {children}
    </td>
  );
}

export function Th({
  children,
  className,
  ...rest
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th {...rest} scope="row" className={clsx("px-3 py-2.5 t-sm font-extrabold align-middle", className)}>
      {children}
    </th>
  );
}

// ── Banner ──────────────────────────────────────────────────────────────────

/** Banners are ANNOUNCED. A silent div means a screen-reader user gets no
 *  signal that a charge failed. `alert` for anything the user must act on,
 *  `status` for anything merely informative. */
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
        "flex items-start gap-[var(--space-3)] rounded-[var(--radius-md)] border-[3px] border-[var(--color-ink)] p-3.5 t-sm",
        {
          info: "bg-[var(--color-sky)] text-[var(--color-ink)]",
          warn: "bg-[var(--color-yellow)] text-[var(--color-ink)]",
          // Danger is the ONLY banner that uses signal, and it fills — a
          // washed-out red band is exactly what a stressed operator scrolls
          // straight past.
          danger: "bg-[var(--color-signal)] text-white on-deep",
          success: "bg-[var(--color-acid)] text-[var(--color-ink)]",
        }[tone],
        className
      )}
    >
      <div className="flex-1">
        {title && <p className="font-extrabold">{title}</p>}
        {children && <div className={clsx(title && "mt-0.5")}>{children}</div>}
      </div>
      {action}
    </div>
  );
}

// ── Empty state / nudge ─────────────────────────────────────────────────────

/** An empty state TEACHES. It never merely states a fact.
 *
 *  "No open tickets" tells a 16-year-old handed a phone minutes before doors
 *  open precisely nothing. "No open tickets yet — new orders from the kiosk
 *  will appear here automatically" tells them the screen is working, what will
 *  happen, and that they do not need to do anything. */
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
        "flex flex-col items-center gap-[var(--space-3)] rounded-[var(--radius-lg)]",
        "border-[3px] border-dashed border-[var(--color-ink)] bg-white px-6 py-10 text-center",
        className
      )}
    >
      {icon && <div className="text-[var(--color-ink)]">{icon}</div>}
      <p className="t-lg">{headline}</p>
      <p className="t-base max-w-[46ch] text-[var(--color-muted)]">{teach}</p>
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
        "flex items-start gap-2 rounded-[var(--radius-sm)] border-2 border-[var(--color-ink)]",
        "bg-[var(--color-yellow-wash)] px-3 py-2 t-sm text-[var(--color-ink)]",
        className
      )}
    >
      <span aria-hidden className="mt-px font-extrabold">
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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-[var(--color-ink)]/60 animate-rise"
        style={{ animationDuration: "var(--dur-fast)" }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx(
          "animate-rise relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden",
          "border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)]",
          "rounded-t-[var(--radius-xl)] shadow-[var(--shadow-lift)] sm:rounded-[var(--radius-xl)]"
        )}
      >
        <header className="flex items-center justify-between gap-3 border-b-[3px] border-[var(--color-ink)] bg-[var(--color-yellow)] p-4">
          <h2 className="t-lg">{title}</h2>
          <Button size="sm" surface="admin" variant="ghost" onClick={onClose} aria-label="Close">
            ✕
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        {footer && <footer className="border-t-[3px] border-[var(--color-ink)] bg-white p-4">{footer}</footer>}
      </div>
    </div>
  );
}

// ── Skeleton ────────────────────────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={clsx("skeleton rounded-[var(--radius-md)] border-2 border-[var(--color-line-soft)]", className)}
    />
  );
}

// ── Stat ────────────────────────────────────────────────────────────────────

/** A number that must be readable across a counter. The value runs at the
 *  `xl` step in mono; `emphasis` promotes it to a full colour-block. At most
 *  ONE emphasised Stat per screen — it is the headline number. */
export function Stat({
  label,
  value,
  sub,
  emphasis,
  tone,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  emphasis?: boolean;
  tone?: Tone;
  className?: string;
}) {
  const fill: Tone = tone ?? (emphasis ? "acid" : "white");
  return (
    <div
      className={clsx(
        "rounded-[var(--radius-lg)] border-[3px] border-[var(--color-ink)] p-[var(--space-4)]",
        emphasis && "shadow-[var(--shadow-block)]",
        TONE_FILL[fill],
        className
      )}
    >
      <p className={clsx("t-label", toneMuted(fill))}>{label}</p>
      <p
        className={clsx(
          "mt-1.5 font-[family-name:var(--font-mono)] tnum font-bold",
          emphasis ? "t-xxl" : "t-xl"
        )}
      >
        {value}
      </p>
      {sub && <p className={clsx("mt-1 t-sm", toneMuted(fill))}>{sub}</p>}
    </div>
  );
}

// ── Layout scaffolds ────────────────────────────────────────────────────────

/** A POS screen is THREE fixed regions, not one long scroll:
 *
 *    <PosScreen>
 *      <PosScreen.Head/>    optional, does not scroll
 *      <PosScreen.Body/>    the ONLY scrolling region
 *      <PosScreen.Foot/>    the primary action. Never scrolls off.
 *    </PosScreen>
 *
 *  The reason is ergonomic, not aesthetic: the charge button must be reachable
 *  with a thumb at any scroll position, because it is the last thing in every
 *  transaction and an operator who has to scroll to find it will mis-tap.
 *  Do not put a primary action inside Body. */
export function PosScreen({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx("flex min-h-0 flex-1 flex-col", className)}>{children}</div>;
}

function PosHead({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={clsx(
        "shrink-0 border-b-[3px] border-[var(--color-ink)] bg-white px-[var(--space-4)] py-[var(--space-3)]",
        className
      )}
    >
      {children}
    </div>
  );
}

function PosBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={clsx(
        "min-h-0 flex-1 overflow-y-auto overscroll-contain",
        "flex flex-col gap-[var(--space-3)] p-[var(--space-3)]",
        className
      )}
    >
      {children}
    </div>
  );
}

/** The pinned action region. Ink ground so it separates absolutely from the
 *  scrolling body behind it. */
function PosFoot({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={clsx(
        "on-deep shrink-0 border-t-[3px] border-[var(--color-ink)] bg-[var(--color-ink)] text-white",
        "p-[var(--space-3)] pb-[max(var(--space-3),env(safe-area-inset-bottom))]",
        className
      )}
    >
      {children}
    </div>
  );
}

PosScreen.Head = PosHead;
PosScreen.Body = PosBody;
PosScreen.Foot = PosFoot;

/** Admin page scaffold: a title row and a content column at a readable
 *  measure. Admin is dense and desktop-first; it does not get colour-block
 *  panels by default, only accents. */
export function AdminPage({
  title,
  action,
  children,
  className,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("flex flex-col gap-[var(--space-5)]", className)}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-[var(--space-3)]">
          {typeof title === "string" ? <h2 className="t-xl">{title}</h2> : title}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

/** Rows of colour-block tiles. Enforces the gap so no page invents its own. */
export function BlockGrid({
  cols = 2,
  children,
  className,
}: {
  cols?: 2 | 3 | 4;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "grid gap-[var(--space-3)]",
        { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 xl:grid-cols-4" }[cols],
        className
      )}
    >
      {children}
    </div>
  );
}

/** A horizontal rail of chips that scrolls without a scrollbar. */
export function Rail({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx("no-scrollbar -mx-1 flex gap-[var(--space-2)] overflow-x-auto px-1 py-1", className)}>
      {children}
    </div>
  );
}
