"use client";
import { useEffect, useMemo, useState } from "react";
import type { Color, Fit, ProductSku } from "@/lib/types";

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];

/** Garment picker: colour/fit selection and the derived size grid. */
export function useCatalogueFilters(
  skus: ProductSku[],
  initialColorId: string | null,
  initialFitId: string | null
) {
  const [colorId, setColorId] = useState<string | null>(null);
  const [fitId, setFitId] = useState<string | null>(null);

  useEffect(() => {
    if (initialColorId && !colorId) setColorId(initialColorId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialColorId]);
  useEffect(() => {
    if (initialFitId && !fitId) setFitId(initialFitId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFitId]);

  const sizesForSelection = useMemo(() => {
    if (!colorId || !fitId) return [];
    return skus
      .filter((s) => s.color_id === colorId && s.fit_id === fitId)
      .sort((a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size));
  }, [skus, colorId, fitId]);

  return { colorId, setColorId, fitId, setFitId, sizesForSelection };
}

export function labelFor(colors: Color[], fits: Fit[], sku: ProductSku) {
  const color = colors.find((c) => c.id === sku.color_id)?.name || "";
  const fit = fits.find((f) => f.id === sku.fit_id)?.name || "";
  return { color, fit };
}
