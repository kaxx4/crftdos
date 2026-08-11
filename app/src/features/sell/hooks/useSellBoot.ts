"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDeviceId } from "@/lib/deviceId";
import { supabaseBrowser } from "@/lib/supabase/client";
import { loadWithCache, describeAge } from "@/lib/catalogueCache";
import type { Color, Fit, ProductSku, StickerDesign, Shift, ReceiptBlock } from "@/lib/types";

// Explicit column lists. select("*") shipped image paths, timestamps, par
// levels and bin metadata the Sell screen never reads — dead weight on mobile
// data and in the IndexedDB snapshot. Compression helps; not sending helps more.
const SELECT_COLORS = "id,name,hex,sort";
const SELECT_FITS = "id,name,applies_to,sort";
const SELECT_SKUS = "id,product_type,color_id,fit_id,size,sku_code,stock_qty,unit_cost,unit_price";
const SELECT_DESIGNS =
  "id,code,size_class,name,tags,thumb_path,stock_qty,bin_location,unit_cost,unit_price";

/** Shift/block fetch+join, offline catalogue load via loadWithCache,
 *  recentCounts restore. The one hook with a real network boot sequence, so
 *  it owns `loading` for the whole screen. */
export function useSellBoot() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [shift, setShift] = useState<Shift | null>(null);
  const [block, setBlock] = useState<ReceiptBlock | null>(null);
  const [catalogueAge, setCatalogueAge] = useState<string | null>(null);
  const [blockJoinFailed, setBlockJoinFailed] = useState(false);

  const [colors, setColors] = useState<Color[]>([]);
  const [fits, setFits] = useState<Fit[]>([]);
  const [skus, setSkus] = useState<ProductSku[]>([]);
  const [designs, setDesigns] = useState<StickerDesign[]>([]);
  const [initialColorId, setInitialColorId] = useState<string | null>(null);
  const [initialFitId, setInitialFitId] = useState<string | null>(null);
  const [recentCounts, setRecentCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    async function boot() {
      const deviceId = getDeviceId();
      const sb = supabaseBrowser();

      // The catalogue does not depend on the shift, so both legs go out at
      // once. Awaiting /api/shift/current first cost a full extra round trip
      // before the Sell screen could start loading — on stall mobile data
      // that is the difference between the screen being usable and the
      // volunteer staring at a spinner with a queue in front of them.
      // Catalogue comes through the offline cache: fresh when there is a
      // network, last-known snapshot when there isn't. Without this a
      // volunteer who lost signal and reloaded got an empty Sell screen —
      // no products, no stickers, nothing to sell (PRD §10).
      const [shiftRes, cat] = await Promise.all([
        fetch(`/api/shift/current?deviceId=${deviceId}`)
          .then((r) => r.json())
          .catch(() => null),
        loadWithCache("sell-catalogue", async () => {
          const [c, f, s, d] = await Promise.all([
            sb.from("stall_colors").select(SELECT_COLORS).order("sort"),
            sb.from("stall_fits").select(SELECT_FITS).order("sort"),
            sb.from("stall_product_skus").select(SELECT_SKUS).eq("is_active", true),
            sb.from("stall_sticker_designs").select(SELECT_DESIGNS).eq("is_active", true),
          ]);
          const err = c.error || f.error || s.error || d.error;
          if (err) throw err;
          return {
            colors: (c.data || []) as unknown as Color[],
            fits: (f.data || []) as unknown as Fit[],
            skus: (s.data || []) as unknown as ProductSku[],
            designs: (d.data || []) as unknown as StickerDesign[],
          };
        }),
      ]);

      if (cat.data) {
        setColors(cat.data.colors);
        setFits(cat.data.fits);
        setSkus(cat.data.skus);
        setDesigns(cat.data.designs);
        if (cat.data.colors[0]) setInitialColorId(cat.data.colors[0].id);
        if (cat.data.fits[0]) setInitialFitId(cat.data.fits[0].id);
      }
      setCatalogueAge(cat.stale ? describeAge(cat.cachedAt) || "unknown age" : null);

      // A failed shift lookup offline must not bounce a volunteer mid-shift to
      // /shift-open, which needs the network anyway. Only redirect when the
      // server actually answered and said there is no open shift.
      if (shiftRes && !shiftRes.shift) {
        router.replace("/shift-open");
        return;
      }
      if (shiftRes?.shift) {
        let block = shiftRes.block;
        if (!block) {
          // A device that logs in while a shift is already open (started by
          // a different device) previously landed here with block === null
          // forever — nothing ever called /api/shift/open for THIS device,
          // and /shift-open only runs when no shift exists at all. Charge
          // silently no-op'd on `if (!shift || !block) return`, with no
          // error shown, so a second/third/... device could never sell.
          // /api/shift/open is idempotent (it joins an already-open shift
          // rather than erroring), so auto-join here with the shift's own
          // settings — the volunteer never sees a form for a shift someone
          // else already configured.
          const joinRes = await fetch("/api/shift/open", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: shiftRes.shift.name,
              venue: shiftRes.shift.venue,
              event_name: shiftRes.shift.event_name,
              press_on_site: shiftRes.shift.press_on_site,
              opening_float: 0,
              deviceId,
            }),
          })
            .then((r) => r.json())
            .catch(() => null);
          if (joinRes?.block) block = joinRes.block;
          else setBlockJoinFailed(true);
        }
        setShift(shiftRes.shift);
        setBlock(block);
        try {
          const raw = sessionStorage.getItem(`recent_stickers_${shiftRes.shift.id}`);
          if (raw) setRecentCounts(JSON.parse(raw));
        } catch {
          // Corrupt/unavailable sessionStorage — start empty, not fatal.
        }
      }
      setLoading(false);
    }
    boot();
  }, [router]);

  return {
    loading,
    shift,
    block,
    setBlock,
    catalogueAge,
    blockJoinFailed,
    colors,
    fits,
    skus,
    designs,
    initialColorId,
    initialFitId,
    recentCounts,
    setRecentCounts,
  };
}
