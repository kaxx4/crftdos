"use client";
import { useEffect, useState } from "react";
import { PosFrame } from "@/components/PosFrame";
import { FirstRunHint } from "@/components/FirstRunHint";
import { TabBar } from "@/components/TabBar";
import { Banner, BigButton, Field, Mono, PanelLabel } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getDeviceId } from "@/lib/deviceId";
import type { ProductSku, StickerDesign } from "@/lib/types";

const REASONS = ["misalignment", "peel_failure", "temperature", "print_defect", "garment_defect", "other"];
const REASON_LABELS: Record<string, string> = {
  misalignment: "Misalignment",
  peel_failure: "Peel failure",
  temperature: "Wrong temperature",
  print_defect: "Print defect",
  garment_defect: "Garment defect",
  other: "Other",
};

type WasteRow = { id: string; reason: string; created_at: string; sticker_qty: number; product_qty: number };

export default function WastePage() {
  const [skus, setSkus] = useState<ProductSku[]>([]);
  const [designs, setDesigns] = useState<StickerDesign[]>([]);
  const [log, setLog] = useState<WasteRow[]>([]);
  const [code, setCode] = useState("");
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState("");
  const [shift, setShift] = useState<{ id: string } | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  async function load() {
    const sb = supabaseBrowser();
    const [s, d, w, shiftRes] = await Promise.all([
      sb.from("stall_product_skus").select("*"),
      sb.from("stall_sticker_designs").select("*"),
      fetch("/api/waste").then((r) => r.json()),
      fetch(`/api/shift/current?deviceId=${getDeviceId()}`).then((r) => r.json()),
    ]);
    setSkus(s.data || []);
    setDesigns(d.data || []);
    setLog(w.waste || []);
    setShift(shiftRes.shift);
  }
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = supabaseBrowser();
      const [s, d, w, shiftRes] = await Promise.all([
        sb.from("stall_product_skus").select("*"),
        sb.from("stall_sticker_designs").select("*"),
        fetch("/api/waste").then((r) => r.json()),
        fetch(`/api/shift/current?deviceId=${getDeviceId()}`).then((r) => r.json()),
      ]);
      if (cancelled) return;
      setSkus(s.data || []);
      setDesigns(d.data || []);
      setLog(w.waste || []);
      setShift(shiftRes.shift);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit() {
    const sku = skus.find((s) => s.sku_code.toLowerCase() === code.trim().toLowerCase());
    const design = designs.find((d) => d.code.toLowerCase() === code.trim().toLowerCase());
    if (!sku && !design) return alert("Nothing matches that code — check the spelling and try again");
    const label = sku?.sku_code || design?.code || code.trim();
    const res = await fetch("/api/waste", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shiftId: shift?.id,
        stickerId: design?.id,
        stickerQty: design ? Number(qty) : 0,
        productSkuId: sku?.id,
        productQty: sku ? Number(qty) : 0,
        reason,
        note,
      }),
    });
    if (res.ok) {
      setToast(`Logged — ${label} stock reduced.`);
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Could not log this waste — the stock count was not changed. Try again.");
    }
    setCode("");
    setQty("1");
    setNote("");
    load();
  }

  return (
    <div className="contents">
      <PosFrame
        helpTopic="close"
        nav={<TabBar />} kicker="VOLUNTEER · WASTE" title="Log waste"
        banner={toast ? <Banner tone="blue" transient>{toast}</Banner> : undefined}>
        <FirstRunHint
          id="waste"
          title="Why bother logging waste"
          points={[
            "Log every transfer or blank ruined in the press, even when it feels like paperwork.",
            "Some designs genuinely press worse than others — this is the only way we ever find out which.",
            "It takes the item out of stock with a reason, so the count stays honest.",
          ]}
        />
        <div className="border-2 border-ink bg-white p-2.5 flex flex-col gap-2">
          <Field label="Sticker or product code" placeholder="Sticker or product code" value={code} onChange={(e) => setCode(e.target.value)} />
          <div className="flex gap-2">
            <Field label="Quantity wasted" type="number" placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} className="w-20" />
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-label="Reason for waste"
              className="border-2 border-ink p-3 flex-1 bg-white min-h-[48px]"
            >
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {REASON_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <Field label="Note (optional)" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <BigButton variant="blue" onClick={submit}>
            LOG WASTE (REMOVES STOCK)
          </BigButton>
        </div>
        <PanelLabel>Logged this shift</PanelLabel>
        <div className="flex flex-col gap-1.5">
          {log.map((w) => (
            <div key={w.id} className="border border-ink bg-white p-2 flex justify-between text-sm">
              <span>{REASON_LABELS[w.reason] || w.reason}</span>
              <Mono>{new Date(w.created_at).toLocaleString("en-IN")}</Mono>
            </div>
          ))}
          {log.length === 0 && (
            <div className="text-center text-sm text-muted py-6">
              Nothing logged yet this shift. Damaged or unsellable stock goes here so counts stay accurate.
            </div>
          )}
        </div>
      </PosFrame>
    </div>
  );
}
