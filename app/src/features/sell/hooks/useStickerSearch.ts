"use client";
import { useMemo, useState } from "react";
import type { StickerDesign, Shift } from "@/lib/types";

/** Sticker search field, size-class filter, and the shift-scoped "most used
 *  this shift" strip. recentCounts is a frequency count, not a recency stack
 *  (PRD §3.1), and lives here since it's search-local convenience state
 *  backed by sessionStorage, not cart truth. */
export function useStickerSearch(
  designs: StickerDesign[],
  recentCounts: Record<string, number>,
  setRecentCounts: (updater: (prev: Record<string, number>) => Record<string, number>) => void,
  shift: Shift | null,
  onAddSticker: (design: StickerDesign) => string | null
) {
  const [stickerQuery, setStickerQuery] = useState("");
  const [sizeFilter, setSizeFilter] = useState<"S" | "M" | "L" | null>(null);

  const recentTop8 = useMemo(
    () =>
      Object.entries(recentCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([code]) => code),
    [recentCounts]
  );

  const stickerResults = useMemo(() => {
    let list = designs;
    if (sizeFilter) list = list.filter((d) => d.size_class === sizeFilter);
    const q = stickerQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((d) => {
        const code = d.code.toLowerCase();
        const numeric = q.replace(/[^0-9]/g, "");
        const sizeLetter = q.match(/^[sml]/)?.[0];
        if (sizeLetter && numeric) {
          return code === `${sizeLetter}-${numeric.padStart(3, "0")}`;
        }
        if (numeric && !sizeLetter) {
          return code.endsWith(`-${numeric.padStart(3, "0")}`);
        }
        return (
          code.includes(q) ||
          (d.name || "").toLowerCase().includes(q) ||
          d.tags?.some((t) => t.toLowerCase().includes(q))
        );
      });
    }
    return list.slice(0, 30);
  }, [designs, sizeFilter, stickerQuery]);

  function addSticker(design: StickerDesign) {
    const code = onAddSticker(design);
    if (!code) return; // volunteer declined the out-of-stock confirm
    setRecentCounts((prev) => {
      const next = { ...prev, [code]: (prev[code] || 0) + 1 };
      if (shift) {
        try {
          sessionStorage.setItem(`recent_stickers_${shift.id}`, JSON.stringify(next));
        } catch {
          // Non-fatal — this is a convenience list, not the sale record.
        }
      }
      return next;
    });
  }

  return {
    stickerQuery,
    setStickerQuery,
    sizeFilter,
    setSizeFilter,
    recentTop8,
    stickerResults,
    addSticker,
  };
}
