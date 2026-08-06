"use client";
import { useEffect, useState } from "react";
import { PosFrame } from "@/components/PosFrame";
import { TabBar } from "@/components/TabBar";
import { BigButton, Field, Mono } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getDeviceId } from "@/lib/deviceId";
import type { ProductSku, StickerDesign } from "@/lib/types";

const REASONS = ["misalignment", "peel_failure", "temperature", "print_defect", "garment_defect", "other"];

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
    load();
  }, []);

  async function submit() {
    const sku = skus.find((s) => s.sku_code.toLowerCase() === code.trim().toLowerCase());
    const design = designs.find((d) => d.code.toLowerCase() === code.trim().toLowerCase());
    if (!sku && !design) return alert("No matching product SKU or sticker code");
    await fetch("/api/waste", {
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
    setCode("");
    setQty("1");
    setNote("");
    load();
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <PosFrame kicker="STALL OS · WASTE" title="Log waste">
        <div className="border-2 border-ink bg-white p-2.5 flex flex-col gap-2">
          <Field placeholder="Sticker or product code" value={code} onChange={(e) => setCode(e.target.value)} />
          <div className="flex gap-2">
            <Field type="number" placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} className="w-20" />
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="border-2 border-ink p-3 flex-1 bg-white">
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <Field placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <BigButton variant="blue" onClick={submit}>
            LOG WASTE (DECREMENTS STOCK)
          </BigButton>
        </div>
        <div className="flex flex-col gap-1.5">
          {log.map((w) => (
            <div key={w.id} className="border border-ink bg-white p-2 flex justify-between text-sm">
              <span>{w.reason.replace("_", " ")}</span>
              <Mono>{new Date(w.created_at).toLocaleString("en-IN")}</Mono>
            </div>
          ))}
        </div>
      </PosFrame>
      <TabBar />
    </div>
  );
}
