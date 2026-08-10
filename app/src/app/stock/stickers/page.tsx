"use client";
import { useEffect, useState } from "react";
import { PosFrame } from "@/components/PosFrame";
import { TabBar } from "@/components/TabBar";
import { BigButton, Field, Mono } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { StickerDesign } from "@/lib/types";

export default function StickerStockPage() {
  const [designs, setDesigns] = useState<StickerDesign[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftQty, setDraftQty] = useState("");
  const [draftBin, setDraftBin] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newSize, setNewSize] = useState<"S" | "M" | "L">("M");
  const [newPrice, setNewPrice] = useState("0");

  async function load() {
    const sb = supabaseBrowser();
    const { data } = await sb.from("stall_sticker_designs").select("*").order("code");
    setDesigns(data || []);
  }
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = supabaseBrowser();
      const { data } = await sb.from("stall_sticker_designs").select("*").order("code");
      if (cancelled) return;
      setDesigns(data || []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(id: string) {
    const res = await fetch(`/api/stock/sticker/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stock_qty: Number(draftQty), bin_location: draftBin }),
    });
    if (res.ok) await load();
    setEditing(null);
  }

  async function addDesign() {
    if (!newCode.trim()) return;
    const res = await fetch(`/api/stock/sticker/new`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: newCode.trim().toUpperCase(), size_class: newSize, unit_price: Number(newPrice) }),
    });
    if (res.ok) {
      await load();
      setAddOpen(false);
      setNewCode("");
      setNewPrice("0");
    } else {
      const j = await res.json();
      alert(j.error || "Could not add design");
    }
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <PosFrame kicker="STALL OS · STOCK" title="Stickers">
        <div className="flex flex-col gap-1.5">
          {designs.map((d) => (
            <div key={d.id} className="border-2 border-ink bg-white p-2.5 flex justify-between items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-extrabold text-sm">{d.code} {d.name ? `· ${d.name}` : ""}</div>
                {editing === d.id ? (
                  <input
                    value={draftBin}
                    onChange={(e) => setDraftBin(e.target.value)}
                    placeholder="Bin location"
                    className="border border-ink px-1.5 py-1 text-xs mt-1 w-full"
                  />
                ) : (
                  <Mono>{d.bin_location || "no bin set"}</Mono>
                )}
              </div>
              {editing === d.id ? (
                <div className="flex gap-1.5">
                  <input
                    autoFocus
                    value={draftQty}
                    onChange={(e) => setDraftQty(e.target.value)}
                    className="border-2 border-ink w-14 p-1.5 text-center"
                  />
                  <button onClick={() => save(d.id)} className="bg-blue text-cream px-2 font-bold text-xs">
                    OK
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setEditing(d.id);
                    setDraftQty(String(d.stock_qty));
                    setDraftBin(d.bin_location || "");
                  }}
                  className={`font-extrabold text-lg ${d.stock_qty <= 0 ? "text-signal" : ""}`}
                >
                  {d.stock_qty}
                </button>
              )}
            </div>
          ))}
          {designs.length === 0 && (
            <div className="text-center text-sm text-muted py-6">
              No sticker designs yet. The 200-design catalogue import (PRD §16.10) is still pending — add a few
              manually below to test Sell.
            </div>
          )}
        </div>

        {!addOpen ? (
          <BigButton variant="ghost" onClick={() => setAddOpen(true)}>
            + ADD DESIGN
          </BigButton>
        ) : (
          <div className="border-2 border-ink bg-white p-2.5 flex flex-col gap-2">
            <Field label="Sticker code" placeholder="Code e.g. M-014" value={newCode} onChange={(e) => setNewCode(e.target.value)} />
            <div className="flex gap-1.5">
              {(["S", "M", "L"] as const).map((sz) => (
                <button
                  key={sz}
                  onClick={() => setNewSize(sz)}
                  className={`border-2 border-ink px-3 py-2 font-bold text-xs ${newSize === sz ? "bg-ink text-cream" : "bg-white"}`}
                >
                  {sz}
                </button>
              ))}
              <Field label="Unit price in rupees" type="number" placeholder="₹ price" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} className="flex-1" />
            </div>
            <div className="flex gap-1.5">
              <BigButton variant="blue" className="flex-1" onClick={addDesign}>
                ADD
              </BigButton>
              <BigButton variant="ghost" className="flex-1" onClick={() => setAddOpen(false)}>
                CANCEL
              </BigButton>
            </div>
          </div>
        )}
        <div className="font-mono text-[11px] text-muted border border-dashed p-2.5">
          CSV/image bulk import and QR label sheets (PRD §9) are stubbed — this page covers count + bin location
          CRUD only, which is what Sell needs.
        </div>
      </PosFrame>
      <TabBar />
    </div>
  );
}
