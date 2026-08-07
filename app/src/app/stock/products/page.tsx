"use client";
import { useEffect, useState } from "react";
import { PosFrame } from "@/components/PosFrame";
import { TabBar } from "@/components/TabBar";
import { Mono } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Color, Fit, ProductSku } from "@/lib/types";

export default function ProductStockPage() {
  const [skus, setSkus] = useState<ProductSku[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [fits, setFits] = useState<Fit[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const sb = supabaseBrowser();
    Promise.all([
      sb.from("stall_product_skus").select("*").order("sku_code"),
      sb.from("stall_colors").select("*"),
      sb.from("stall_fits").select("*"),
    ]).then(([s, c, f]) => {
      setSkus(s.data || []);
      setColors(c.data || []);
      setFits(f.data || []);
    });
  }, []);

  async function saveStock(id: string) {
    const qty = Number(draft);
    if (Number.isNaN(qty)) return;
    const sb = supabaseBrowser();
    // NOTE: anon key is SELECT-only per RLS (PRD §12) — this write will fail
    // against RLS by design. A proper server route (service role + audit
    // log) is required for stock adjustments; stubbed here as the
    // documented next step rather than silently bypassing RLS.
    const { error } = await sb.from("stall_product_skus").update({ stock_qty: qty }).eq("id", id);
    if (!error) {
      setSkus((prev) => prev.map((s) => (s.id === id ? { ...s, stock_qty: qty } : s)));
    } else {
      alert("Stock edits need the admin write route (not yet built) — RLS correctly blocked this direct write.");
    }
    setEditing(null);
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <PosFrame kicker="STALL OS · STOCK" title="Products">
        <div className="flex flex-col gap-1.5">
          {skus.map((s) => {
            const color = colors.find((c) => c.id === s.color_id)?.name;
            const fit = fits.find((f) => f.id === s.fit_id)?.name;
            return (
              <div key={s.id} className="border-2 border-ink bg-white p-2.5 flex justify-between items-center gap-2">
                <div>
                  <div className="font-extrabold text-sm">{s.sku_code}</div>
                  <Mono>{color} · {fit} · {s.size}</Mono>
                </div>
                {editing === s.id ? (
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex gap-1.5">
                      <input
                        autoFocus
                        disabled
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        className="border-2 border-ink w-16 p-1.5 text-center bg-neutral-200 text-neutral-400 cursor-not-allowed"
                      />
                      <button
                        disabled
                        onClick={() => saveStock(s.id)}
                        className="bg-neutral-300 text-neutral-500 px-2 font-bold text-xs cursor-not-allowed"
                      >
                        OK
                      </button>
                    </div>
                    <div className="font-mono text-[9px] text-neutral-500 text-right max-w-[140px]">
                      Stock edits need admin access — not available yet
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditing(s.id);
                      setDraft(String(s.stock_qty));
                    }}
                    className={`font-extrabold text-lg ${s.stock_qty <= 0 ? "text-signal" : ""}`}
                  >
                    {s.stock_qty}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="font-mono text-[11px] text-neutral-600 border border-dashed p-2.5">
          CSV / image import is stubbed for Phase 1 per the brief — inline stock edits only. Direct edits attempt a
          write through the anon key to demonstrate RLS is doing its job (SELECT-only); wire a server route with
          admin_audit logging before relying on this in production.
        </div>
      </PosFrame>
      <TabBar />
    </div>
  );
}
