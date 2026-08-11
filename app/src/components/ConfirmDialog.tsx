"use client";
import { useEffect, useRef, useState } from "react";
import { BigButton, Field } from "./ui";

/** Confirmation for actions that move money or stock.
 *
 *  Replaces `window.prompt` / `window.confirm`, which were wrong here for
 *  three reasons:
 *
 *   1. **They were losing the cancel.** `window.prompt("Void reason?") ||
 *      "unspecified"` treats Cancel (which returns null) as a valid answer, so
 *      backing out of the prompt still voided the sale. A dialog that cannot
 *      be cancelled is worse than no dialog.
 *   2. Native dialogs can't say what the action will actually do. "Void
 *      reason?" tells a volunteer nothing about stock going back.
 *   3. They're unstyled, and on mobile Safari they can be suppressed entirely.
 *
 *  Destructive variants require the reason to be non-empty before confirming,
 *  because the pattern of *why* things get voided is the data worth having. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  tone = "danger",
  reasonLabel,
  numberLabel,
  numberDefault,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  /** Say what will happen, including to stock and money. */
  body: string;
  confirmLabel: string;
  tone?: "danger" | "normal";
  /** When set, a reason is captured and required. */
  reasonLabel?: string;
  /** When set, a quantity is captured instead. */
  numberLabel?: string;
  numberDefault?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setValue(numberLabel ? (numberDefault ?? "") : "");
  }, [open, numberLabel, numberDefault]);

  // Escape always cancels. On a till, the way out must never be in doubt.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const needsValue = !!reasonLabel || !!numberLabel;
  const valid = !needsValue || value.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="bg-cream border-2 border-ink w-full max-w-sm flex flex-col gap-3 p-4 rounded-[var(--radius-pos-md)] max-h-[85dvh] overflow-y-auto motion-safe:animate-[pos-enter_var(--dur-pos)_var(--ease-out-strong)_both]"
      >
        <h2
          className={`font-extrabold text-[15px] tracking-wide uppercase ${
            tone === "danger" ? "text-signal" : ""
          }`}
        >
          {title}
        </h2>
        <p className="text-[15px] leading-snug">{body}</p>

        {reasonLabel && (
          <Field
            label={reasonLabel}
            placeholder={reasonLabel}
            value={value}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
          />
        )}
        {numberLabel && (
          <Field
            label={numberLabel}
            type="number"
            inputMode="numeric"
            placeholder={numberLabel}
            value={value}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
          />
        )}
        {needsValue && !valid && (
          <p className="text-[13px] text-muted">
            {reasonLabel ? "Type a short reason to continue." : "Enter a number to continue."}
          </p>
        )}

        <div className="flex gap-2">
          {/* Cancel is listed first and is the wider, calmer target. Backing
              out should always be the easier thing to hit by accident. */}
          <BigButton variant="cream" className="flex-1" onClick={onCancel}>
            CANCEL
          </BigButton>
          <BigButton
            variant={tone === "danger" ? "ink" : "blue"}
            className="flex-1"
            disabled={!valid}
            onClick={() => onConfirm(value.trim())}
          >
            {confirmLabel}
          </BigButton>
        </div>
      </div>
    </div>
  );
}
