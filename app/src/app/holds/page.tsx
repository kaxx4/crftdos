"use client";
import { useEffect, useState } from "react";
import { PosFrame } from "@/components/PosFrame";
import { FirstRunHint } from "@/components/FirstRunHint";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TabBar } from "@/components/TabBar";
import { Banner, BigButton, Field, Mono, PanelLabel } from "@/components/ui";
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
  const [toast, setToast] = useState("");

  useEffect(() => {
    // Ticking clock for the "N min left" countdown — legitimately syncs
    // React state with the passage of time, not derivable from props/state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(id);
  }, [toast]);

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
    if (!sku && !design) return alert("Nothing matches that code — check the spelling and try again");
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

  // Releasing hands someone else's reserved item back to the shelf, and it
  // used to happen on a single tap with no confirmation at all.
  const [releaseTarget, setReleaseTarget] = useState<string | null>(null);

  async function confirmRelease() {
    const id = releaseTarget;
    setReleaseTarget(null);
    if (!id) return;
    try {
      const res = await fetch(`/api/holds/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "release" }),
      });
      if (!res.ok) {
        setToast("Couldn't release that hold — it's still reserved. Try again.");
        return;
      }
      setToast("Hold released — item is available to sell again.");
      load();
    } catch {
      setToast("No connection — the hold is still in place. Try again once you're back online.");
    }
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
      alert(
        j.error ||
          "Could not turn this hold into a sale — the item may already be sold, or the hold may have expired. Try again or start a new hold."
      );
    }
  }

  return (
    <div className="contents">
      <PosFrame
        helpTopic="sell"
        nav={<TabBar />} kicker="VOLUNTEER · HOLDS" title="Holds"
        banner={toast ? <Banner tone="blue" transient>{toast}</Banner> : undefined}>
        <FirstRunHint
          id="holds"
          title="Putting something aside"
          points={[
            "A hold reserves an item for a customer who says they'll come back. It stays on the shelf but stops anyone else selling it.",
            "Held items still count as on-hand stock — they're only removed from what's available to sell.",
            "Holds expire on their own at the end of the shift. Release one early if the customer doesn't return.",
          ]}
        />
        <PanelLabel>Active holds</PanelLabel>
        <div className="flex flex-col gap-2">
          {holds.map((h) => (
            <div key={h.id} className="border-2 border-ink bg-white p-2.5 flex justify-between gap-2">
              <div>
                <div className="font-extrabold text-sm">{label(h)} × {h.qty}</div>
                <Mono>{h.customer_name} · {h.customer_phone || "no phone"}</Mono>
                <Mono>{minutesLeft(h)} min left</Mono>
              </div>
              <div className="flex flex-col gap-1.5">
                <button onClick={() => convert(h.id)} className="bg-blue text-cream text-[12px] font-extrabold px-2 py-1.5">
                  CONVERT
                </button>
                <button onClick={() => setReleaseTarget(h.id)} className="border border-signal text-signal text-[12px] font-extrabold px-2 py-1">
                  RELEASE
                </button>
              </div>
            </div>
          ))}
          {holds.length === 0 && (
            <div className="text-center text-sm text-muted py-6">
              No active holds. Tap + NEW HOLD to set an item aside for a customer who's coming back for it.
            </div>
          )}
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
        <ConfirmDialog
          open={!!releaseTarget}
          title="Release this hold?"
          body="The item goes back on sale immediately and anyone can buy it. Do this only if the customer isn't coming back for it."
          confirmLabel="RELEASE"
          onConfirm={confirmRelease}
          onCancel={() => setReleaseTarget(null)}
        />
      </PosFrame>
    </div>
  );
}
