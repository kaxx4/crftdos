"use client";
import { useEffect, useState } from "react";
import { PosFrame } from "@/components/PosFrame";
import { TabBar } from "@/components/TabBar";
import { BigButton, Field, Mono } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getDeviceId } from "@/lib/deviceId";
import type { ProductSku, StickerDesign } from "@/lib/types";

type Hold = {
  id: string;
  product_sku_id: string | null;
  sticker_id: string | null;
  qty: number;
  customer_name: string;
  customer_phone: string | null;
  expires_at: string;
};

export default function HoldsPage() {
  const [holds, setHolds] = useState<Hold[]>([]);
  const [skus, setSkus] = useState<ProductSku[]>([]);
  const [designs, setDesigns] = useState<StickerDesign[]>([]);
  const [shift, setShift] = useState<{ id: string } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [skuCode, setSkuCode] = useState("");
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    // Ticking clock for the "N min left" countdown — legitimately syncs
    // React state with the passage of time, not derivable from props/state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  async function load() {
    const [h, sb, shiftRes] = await Promise.all([
      fetch("/api/holds").then((r) => r.json()),
      supabaseBrowser(),
      fetch(`/api/shift/current?deviceId=${getDeviceId()}`).then((r) => r.json()),
    ]);
    setHolds(h.holds || []);
    setShift(shiftRes.shift);
    const [s, d] = await Promise.all([sb.from("stall_product_skus").select("*"), sb.from("stall_sticker_designs").select("*")]);
    setSkus(s.data || []);
    setDesigns(d.data || []);
  }
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [h, sb, shiftRes] = await Promise.all([
        fetch("/api/holds").then((r) => r.json()),
        supabaseBrowser(),
        fetch(`/api/shift/current?deviceId=${getDeviceId()}`).then((r) => r.json()),
      ]);
      const [s, d] = await Promise.all([sb.from("stall_product_skus").select("*"), sb.from("stall_sticker_designs").select("*")]);
      if (cancelled) return;
      setHolds(h.holds || []);
      setShift(shiftRes.shift);
      setSkus(s.data || []);
      setDesigns(d.data || []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function label(h: Hold) {
    if (h.product_sku_id) return skus.find((s) => s.id === h.product_sku_id)?.sku_code || "product";
    return designs.find((d) => d.id === h.sticker_id)?.code || "sticker";
  }

  function minutesLeft(h: Hold) {
    if (nowMs == null) return 0;
    return Math.max(0, Math.round((new Date(h.expires_at).getTime() - nowMs) / 60000));
  }

  async function addHold() {
    const sku = skus.find((s) => s.sku_code.toLowerCase() === skuCode.trim().toLowerCase());
    const design = designs.find((d) => d.code.toLowerCase() === skuCode.trim().toLowerCase());
    if (!sku && !design) return alert("No SKU/sticker code matched");
    await fetch("/api/holds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productSkuId: sku?.id,
        stickerId: design?.id,
        customerName: name,
        customerPhone: phone,
        shiftId: shift?.id,
      }),
    });
    setAddOpen(false);
    setName("");
    setPhone("");
    setSkuCode("");
    load();
  }

  async function release(id: string) {
    await fetch(`/api/holds/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "release" }),
    });
    load();
  }

  async function convert(id: string) {
    const res = await fetch(`/api/holds/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "convert", shiftId: shift?.id, deviceId: getDeviceId(), paymentMethod: "cash" }),
    });
    if (res.ok) load();
    else {
      const j = await res.json();
      alert(j.error || "Could not convert");
    }
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <PosFrame kicker="STALL OS · HOLDS" title="Holds">
        <div className="flex flex-col gap-2">
          {holds.map((h) => (
            <div key={h.id} className="border-2 border-ink bg-white p-2.5 flex justify-between gap-2">
              <div>
                <div className="font-extrabold text-sm">{label(h)} × {h.qty}</div>
                <Mono>{h.customer_name} · {h.customer_phone || "no phone"}</Mono>
                <Mono>{minutesLeft(h)} min left</Mono>
              </div>
              <div className="flex flex-col gap-1.5">
                <button onClick={() => convert(h.id)} className="bg-blue text-cream text-[10px] font-extrabold px-2 py-1.5">
                  CONVERT
                </button>
                <button onClick={() => release(h.id)} className="border border-signal text-signal text-[10px] font-extrabold px-2 py-1">
                  RELEASE
                </button>
              </div>
            </div>
          ))}
          {holds.length === 0 && <div className="text-center text-sm text-muted py-6">No active holds.</div>}
        </div>
        {!addOpen ? (
          <BigButton variant="ghost" onClick={() => setAddOpen(true)}>
            + NEW HOLD
          </BigButton>
        ) : (
          <div className="border-2 border-ink bg-white p-2.5 flex flex-col gap-2">
            <Field label="SKU or sticker code" placeholder="SKU or sticker code" value={skuCode} onChange={(e) => setSkuCode(e.target.value)} />
            <Field label="Customer name" placeholder="Customer name" value={name} onChange={(e) => setName(e.target.value)} />
            <Field label="Customer phone" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <div className="flex gap-2">
              <BigButton variant="blue" className="flex-1" onClick={addHold}>
                HOLD 2H
              </BigButton>
              <BigButton variant="ghost" className="flex-1" onClick={() => setAddOpen(false)}>
                CANCEL
              </BigButton>
            </div>
          </div>
        )}
      </PosFrame>
      <TabBar />
    </div>
  );
}
