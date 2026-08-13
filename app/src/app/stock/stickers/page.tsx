"use client";
import { useEffect, useState } from "react";
import { PosFrame } from "@/components/PosFrame";
import { FirstRunHint } from "@/components/FirstRunHint";
import { TabBar } from "@/components/TabBar";
import { BigButton, Card, Field, Mono, PanelLabel } from "@/components/ui";
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
    <div className="contents">
      <PosFrame
        helpTopic="sell"
        nav={<TabBar />} kicker="VOLUNTEER · STOCK" title="Stickers">
        <FirstRunHint
          id="stockstickers"
          title="Counts and bin locations"
          points={[
            "Tap a number to correct the count, and set the bin location while you're there.",
            "The bin location is what Sell shows the volunteer — Box 2 / Tab M tells them where to physically walk.",
            "Importing many designs at once lives in Admin - Catalogue.",
          ]}
        />
        <PanelLabel>Designs in stock</PanelLabel>
        <div className="flex flex-col gap-1.5">
          {designs.map((d) => (
            <Card key={d.id} className="p-2.5">
              <div className="flex justify-between items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-sm">{d.code} {d.name ? `· ${d.name}` : ""}</div>
                  {editing === d.id ? (
                    <input
                      aria-label="Bin location"
                      value={draftBin}
                      onChange={(e) => setDraftBin(e.target.value)}
                      placeholder="Bin location"
                      className="border border-ink px-1.5 py-1 min-h-[48px] text-[13px] mt-1 w-full"
                    />
                  ) : (
                    <Mono>{d.bin_location || "Bin not set"}</Mono>
                  )}
                </div>
                {editing === d.id ? (
                  <div className="flex gap-1.5">
                    <input
                      autoFocus
                      aria-label="Stock quantity"
                      value={draftQty}
                      onChange={(e) => setDraftQty(e.target.value)}
                      className="border-2 border-ink w-16 min-h-[48px] p-1.5 text-center"
                    />
                    <button
                      onClick={() => save(d.id)}
                      className="bg-blue text-cream px-3 min-h-[48px] min-w-[48px] font-bold text-[13px]"
                    >
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
                    className={`font-extrabold text-lg min-h-[48px] min-w-[48px] ${d.stock_qty <= 0 ? "text-signal" : ""}`}
                  >
                    {d.stock_qty}
                  </button>
                )}
              </div>
            </Card>
          ))}
          {designs.length === 0 && (
            <div className="text-center text-sm text-muted py-6">
              No sticker designs yet. Import the full catalogue from Admin → Catalogue, or add a few here by
              hand to try out Sell.
            </div>
          )}
        </div>

        {!addOpen ? (
          <BigButton variant="ghost" onClick={() => setAddOpen(true)}>
            + ADD DESIGN
          </BigButton>
        ) : (
          <Card className="p-2.5">
            <Field label="Sticker code" placeholder="Code e.g. M-014" value={newCode} onChange={(e) => setNewCode(e.target.value)} />
            <div className="flex gap-1.5">
              {(["S", "M", "L"] as const).map((sz) => (
                <button
                  key={sz}
                  onClick={() => setNewSize(sz)}
                  aria-pressed={newSize === sz}
                  className={`border-2 border-ink min-h-[48px] min-w-[48px] px-3 py-2 font-bold text-[13px] ${newSize === sz ? "bg-ink text-cream" : "bg-white"}`}
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
          </Card>
        )}
        <div className="font-mono text-[13px] text-muted border border-dashed border-hairline p-2.5">
          To import many designs at once or print QR labels, use Admin → Catalogue. This page is for
          count and bin location on shift — what Sell reads from.
        </div>
      </PosFrame>
    </div>
  );
}
