"use client";
import { useCallback, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import type { Color, Fit, ProductSku, StickerDesign } from "@/lib/types";
import type { CartGarment, CartSticker, CartStandaloneSticker } from "../types";

function cap(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** The single source of truth for cart contents: garments, standalone
 *  stickers, and which garment new stickers attach to. */
export function useCart(colors: Color[], fits: Fit[]) {
  const [garments, setGarments] = useState<CartGarment[]>([]);
  const [standalone, setStandalone] = useState<CartStandaloneSticker[]>([]);
  const [targetGarmentKey, setTargetGarmentKey] = useState<string | null>(null);

  const addGarment = useCallback(
    (sku: ProductSku) => {
      if (sku.stock_qty <= 0) {
        if (!window.confirm(`${sku.sku_code} shows 0 in stock — add it anyway? You'll need to check with a volunteer before handing it over.`)) return;
      }
      const color = colors.find((c) => c.id === sku.color_id)?.name || "";
      const fit = fits.find((f) => f.id === sku.fit_id)?.name || "";
      const g: CartGarment = {
        key: uuidv4(),
        product_sku_id: sku.id,
        label: `${cap(color)} · ${cap(fit)} · ${sku.size}`,
        stockNote: sku.stock_qty > 0 ? `${sku.stock_qty} in stock` : "Added despite 0 in stock",
        unit_price: Number(sku.unit_price),
        unit_cost: Number(sku.unit_cost),
        stickers: [],
      };
      setGarments((prev) => [...prev, g]);
      setTargetGarmentKey(g.key);
    },
    [colors, fits]
  );

  const removeGarment = useCallback(
    (key: string) => {
      setGarments((prev) => prev.filter((g) => g.key !== key));
      setTargetGarmentKey((cur) => (cur === key ? null : cur));
    },
    []
  );

  const addStickerEntry = useCallback(
    (entry: CartSticker, garmentKey: string | null) => {
      if (garmentKey) {
        setGarments((prev) =>
          prev.map((g) => (g.key === garmentKey ? { ...g, stickers: [...g.stickers, entry] } : g))
        );
      } else {
        setStandalone((prev) => [...prev, { ...entry, kind: "standalone" }]);
      }
    },
    []
  );

  const addSticker = useCallback(
    (design: StickerDesign) => {
      if (design.stock_qty <= 0) {
        if (!window.confirm(`${design.code} shows 0 in stock — add it anyway? You'll need to check with a volunteer before handing it over.`)) return null;
      }
      const entry: CartSticker = {
        key: uuidv4(),
        sticker_design_id: design.id,
        code: design.code,
        unit_price: Number(design.unit_price),
        unit_cost: Number(design.unit_cost),
      };
      addStickerEntry(entry, targetGarmentKey);
      return design.code;
    },
    [addStickerEntry, targetGarmentKey]
  );

  const addCustomSticker = useCallback(
    (description: string, sizeClass: "S" | "M" | "L", price: number) => {
      const entry: CartSticker = {
        key: uuidv4(),
        custom: { size_class: sizeClass, description: description || "Custom sticker" },
        code: "C-????",
        unit_price: price,
        unit_cost: 0,
      };
      addStickerEntry(entry, targetGarmentKey);
    },
    [addStickerEntry, targetGarmentKey]
  );

  const addTicketGarments = useCallback((newGarments: CartGarment[]) => {
    setGarments((prev) => [...prev, ...newGarments]);
  }, []);

  const removeStickerFromGarment = useCallback((gKey: string, sKey: string) => {
    setGarments((prev) =>
      prev.map((g) => (g.key === gKey ? { ...g, stickers: g.stickers.filter((s) => s.key !== sKey) } : g))
    );
  }, []);

  const removeStandalone = useCallback((sKey: string) => {
    setStandalone((prev) => prev.filter((s) => s.key !== sKey));
  }, []);

  const resetCart = useCallback(() => {
    setGarments([]);
    setStandalone([]);
    setTargetGarmentKey(null);
  }, []);

  const restore = useCallback((g: CartGarment[], s: CartStandaloneSticker[]) => {
    setGarments(g);
    setStandalone(s);
  }, []);

  const subtotal = useMemo(() => {
    const gTotal = garments.reduce(
      (s, g) => s + g.unit_price + g.stickers.reduce((ss, st) => ss + st.unit_price, 0),
      0
    );
    const standaloneTotal = standalone.reduce((s, st) => s + st.unit_price, 0);
    return gTotal + standaloneTotal;
  }, [garments, standalone]);

  const cartEmpty = garments.length === 0 && standalone.length === 0;

  const cartHasFulfillmentTrigger = useMemo(() => {
    const allStickers = [...garments.flatMap((g) => g.stickers), ...standalone];
    return allStickers.some((s) => s.custom || s.pos_x != null);
  }, [garments, standalone]);

  return {
    garments,
    standalone,
    targetGarmentKey,
    setTargetGarmentKey,
    addGarment,
    removeGarment,
    addSticker,
    addCustomSticker,
    addTicketGarments,
    removeStickerFromGarment,
    removeStandalone,
    resetCart,
    restore,
    subtotal,
    cartEmpty,
    cartHasFulfillmentTrigger,
  };
}
