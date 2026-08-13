"use client";

/** POS-local form controls.
 *
 *  `ui.tsx` ships `Field` (input) and `FieldShell` (a labelled wrapper) but no
 *  textarea or select. Rather than hand-roll a differently-shaped box on three
 *  separate screens, the two shapes live here once, built out of `FieldShell`
 *  so the visible label, hint and error behaviour are identical to `Field`.
 *
 *  These belong in `ui.tsx` as `Textarea` and `Select` — every surface needs
 *  them — but that file is shared and frozen while the three surfaces are
 *  being built in parallel. Flagged for promotion. */

import { useId } from "react";
import { FieldShell } from "@/components/ui";
import { clsx } from "@/components/clsx";

const BOX =
  "w-full rounded-[var(--radius-md)] border-[3px] border-[var(--color-ink)] bg-white px-3.5 t-base " +
  "transition-[border-color,background-color] duration-[var(--dur-fast)] ease-[var(--ease-out)] " +
  "placeholder:text-[var(--color-muted)] focus:bg-[var(--color-yellow-wash)]";

export function PosTextarea({
  label,
  hint,
  error,
  className,
  rows = 3,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  error?: string;
}) {
  const auto = useId();
  const id = rest.id ?? `t${auto}`;
  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={id} className={className}>
      <textarea {...rest} id={id} rows={rows} className={clsx(BOX, "py-3 min-h-[var(--tap-pos)]")} />
    </FieldShell>
  );
}

export function PosSelect({
  label,
  hint,
  error,
  className,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  error?: string;
}) {
  const auto = useId();
  const id = rest.id ?? `s${auto}`;
  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={id} className={className}>
      <select {...rest} id={id} className={clsx(BOX, "min-h-[var(--tap-pos)]")}>
        {children}
      </select>
    </FieldShell>
  );
}

/** A checkbox that is actually tappable: 56px row, ink-edged box, visible
 *  label text at the POS body floor. */
export function PosCheckbox({
  label,
  checked,
  onChange,
  className,
}: {
  label: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  className?: string;
}) {
  return (
    <label
      className={clsx(
        "flex min-h-[var(--tap-pos)] cursor-pointer items-center gap-[var(--space-3)]",
        "rounded-[var(--radius-lg)] border-[3px] border-[var(--color-ink)] bg-white px-[var(--space-3)] t-base font-bold",
        className
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-6 shrink-0 accent-[var(--color-cobalt)]"
      />
      <span>{label}</span>
    </label>
  );
}
