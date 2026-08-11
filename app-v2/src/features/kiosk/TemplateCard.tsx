"use client";

import type { ProductSku, Template } from "@/lib/domain/types";
import { money } from "@/lib/money";
import { clsx } from "@/components/clsx";
import { DesignPreview } from "./DesignPreview";

/** A merchandised template.
 *
 *  The whole card is the target, not a button inside it — on a tablet, a
 *  customer will tap the picture. */
export function TemplateCard({
  template,
  skus,
  onOpen,
  featured = false,
}: {
  template: Template;
  skus: ProductSku[];
  onOpen: () => void;
  featured?: boolean;
}) {
  const sku = skus.find((s) => s.id === template.payload.product_sku_id);
  const price =
    (sku?.unit_price ?? 0) + template.payload.placements.reduce((n, p) => n + p.unit_price, 0);

  return (
    <button
      onClick={onOpen}
      className={clsx(
        "group flex flex-col overflow-hidden rounded-2xl border-2 bg-white text-left",
        "transition-[transform,border-color,box-shadow] duration-[var(--dur-base)] ease-[var(--ease-out)]",
        "active:scale-[0.98] hover:border-[var(--color-blue)] hover:shadow-[0_8px_28px_-12px_rgba(27,77,245,0.45)]",
        featured ? "border-[var(--color-ink)]" : "border-[var(--color-line)]"
      )}
    >
      <div className="relative bg-[var(--color-cream-2)]">
        <DesignPreview sku={sku} placements={template.payload.placements} side="front" />
        {featured && template.times_used > 0 && (
          <span className="absolute left-3 top-3 rounded-md bg-[var(--color-blue)] px-2 py-1 font-[family-name:var(--font-mono)] text-xs font-bold text-white">
            {template.times_used} sold
          </span>
        )}
      </div>

      <div className={clsx("flex flex-1 flex-col gap-1 p-4", !featured && "p-3")}>
        <p className={clsx("font-extrabold tracking-tight", featured ? "text-xl" : "text-base")}>{template.name}</p>
        {featured && template.blurb && (
          <p className="text-sm leading-snug text-[var(--color-muted)]">{template.blurb}</p>
        )}
        <p className="mt-auto pt-2 font-[family-name:var(--font-mono)] font-bold tnum">
          {money(price)}
          <span className="ml-2 text-sm font-normal text-[var(--color-muted)] group-hover:text-[var(--color-blue)]">
            Make it yours →
          </span>
        </p>
      </div>
    </button>
  );
}
