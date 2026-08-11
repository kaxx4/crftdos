"use client";

import { useMemo, useState } from "react";
import type { Catalogue } from "@/lib/backend";
import type { ProductSize, ProductSku } from "@/lib/domain/types";
import { money } from "@/lib/money";
import { Chip } from "@/components/ui";
import { clsx } from "@/components/clsx";

const SIZE_ORDER: ProductSize[] = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];

/** Colour → fit → size, in that order, because that is the order a customer
 *  actually decides in. Sizes not stocked in a fit are HIDDEN rather than
 *  shown-and-disabled: a kiosk customer has no way to act on a disabled
 *  control, so it is pure noise. (The POS makes the opposite choice — see the
 *  walk-up sale, where a volunteer holding the physical garment outranks the
 *  database and may need to sell something the count says is gone.) */
export function GarmentPicker({
  catalogue,
  value,
  onChange,
}: {
  catalogue: Catalogue;
  value: ProductSku | null;
  onChange: (sku: ProductSku) => void;
}) {
  const [colorId, setColorId] = useState(value?.color_id ?? catalogue.colors[0]?.id ?? "");
  const [fitId, setFitId] = useState(value?.fit_id ?? catalogue.fits[0]?.id ?? "");

  const available = useMemo(
    () => catalogue.skus.filter((s) => s.is_active && s.color_id === colorId && s.fit_id === fitId && s.stock_qty > 0),
    [catalogue.skus, colorId, fitId]
  );

  const sizes = useMemo(
    () => available.slice().sort((a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size)),
    [available]
  );

  return (
    <div className="flex flex-col gap-6">
      <fieldset>
        <legend className="mb-2 text-sm font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">Colour</legend>
        <div className="flex flex-wrap gap-2">
          {catalogue.colors
            .filter((c) => c.is_active)
            .map((c) => (
              <button
                key={c.id}
                onClick={() => setColorId(c.id)}
                aria-pressed={colorId === c.id}
                className={clsx(
                  "tap-target flex items-center gap-2.5 rounded-lg border-2 px-3.5 font-semibold",
                  "transition-transform duration-[var(--dur-fast)] active:scale-[0.97]",
                  colorId === c.id ? "border-[var(--color-blue)] bg-[var(--color-blue-wash)]" : "border-[var(--color-line)] bg-white"
                )}
              >
                <span
                  aria-hidden
                  className="size-6 rounded-full border-2 border-[var(--color-line)]"
                  style={{ background: c.hex }}
                />
                {c.name}
              </button>
            ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">Fit</legend>
        <div className="flex flex-wrap gap-2">
          {catalogue.fits
            .filter((f) => f.is_active)
            .map((f) => (
              <Chip key={f.id} selected={fitId === f.id} onClick={() => setFitId(f.id)}>
                {f.name}
              </Chip>
            ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">Size</legend>
        {sizes.length === 0 ? (
          <p className="rounded-lg bg-[var(--color-signal-wash)] px-3 py-2 text-sm font-semibold">
            That combination is sold out here. Try another colour or fit.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => (
              <Chip
                key={s.id}
                selected={value?.id === s.id}
                onClick={() => onChange(s)}
                className="min-w-[64px] justify-center"
              >
                {s.size}
              </Chip>
            ))}
          </div>
        )}
      </fieldset>

      {sizes.length > 0 && (
        <p className="text-sm text-[var(--color-muted)]">
          {sizes[0].sku_code.startsWith("TEE") ? "Tee" : "Garment"} · {money(sizes[0].unit_price)} before transfers
        </p>
      )}
    </div>
  );
}
