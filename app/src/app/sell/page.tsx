"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { PosFrame } from "@/components/PosFrame";
import { TabBar } from "@/components/TabBar";
import { BigButton, Chip, Field, Panel, PanelLabel, Banner, Mono } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getDeviceId } from "@/lib/deviceId";
import { enqueueOrder, flushOutbox, outboxCount } from "@/lib/outbox";
import { loadWithCache, describeAge } from "@/lib/catalogueCache";
import { decodeTicket, expandTicket } from "@/lib/ticketPayload";
import type { Color, Fit, ProductSku, StickerDesign, Shift, ReceiptBlock } from "@/lib/types";

type CartSticker = {
  key: string;
  sticker_design_id?: string;
  custom?: { size_class: "S" | "M" | "L"; description: string };
  code: string;
  unit_price: number;
  unit_cost: number;
  // Set only for stickers arriving from a kiosk design ticket. These are the
  // coordinates the customer chose on the canvas, and they are what the
  // person at the heat press actually works from — the whole justification
  // for the Design Studio. Till-entered stickers have no placement.
  side?: "front" | "back";
  pos_x?: number;
  pos_y?: number;
  rotation?: number;
};
type CartGarment = {
  key: string;
  product_sku_id: string;
  label: string;
  stockNote: string;
  unit_price: number;
  unit_cost: number;
  stickers: CartSticker[];
};
type CartStandaloneSticker = CartSticker & { kind: "standalone" };

// Explicit column lists. select("*") shipped image paths, timestamps, par
// levels and bin metadata the Sell screen never reads — dead weight on mobile
// data and in the IndexedDB snapshot. Compression helps; not sending helps more.
const SELECT_COLORS = "id,name,hex,sort";
const SELECT_FITS = "id,name,applies_to,sort";
const SELECT_SKUS = "id,product_type,color_id,fit_id,size,sku_code,stock_qty,unit_cost,unit_price";
const SELECT_DESIGNS =
  "id,code,size_class,name,tags,thumb_path,stock_qty,bin_location,unit_cost,unit_price";

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];

export default function SellPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [shift, setShift] = useState<Shift | null>(null);
  const [block, setBlock] = useState<ReceiptBlock | null>(null);
  const [online, setOnline] = useState(true);
  const [pendingOutbox, setPendingOutbox] = useState(0);
  const [catalogueAge, setCatalogueAge] = useState<string | null>(null);

  const [colors, setColors] = useState<Color[]>([]);
  const [fits, setFits] = useState<Fit[]>([]);
  const [skus, setSkus] = useState<ProductSku[]>([]);
  const [designs, setDesigns] = useState<StickerDesign[]>([]);

  const [colorId, setColorId] = useState<string | null>(null);
  const [fitId, setFitId] = useState<string | null>(null);

  const [garments, setGarments] = useState<CartGarment[]>([]);
  const [standalone, setStandalone] = useState<CartStandaloneSticker[]>([]);
  const [targetGarmentKey, setTargetGarmentKey] = useState<string | null>(null);

  const [stickerQuery, setStickerQuery] = useState("");
  const [sizeFilter, setSizeFilter] = useState<"S" | "M" | "L" | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [customOpen, setCustomOpen] = useState(false);
  const [customDesc, setCustomDesc] = useState("");
  const [customSize, setCustomSize] = useState<"S" | "M" | "L">("M");
  const [customPrice, setCustomPrice] = useState("0");

  const [ticketCode, setTicketCode] = useState("");
  const [ticketErr, setTicketErr] = useState("");
  const [redeemedTicketCode, setRedeemedTicketCode] = useState<string | null>(null);

  const [discountAmt, setDiscountAmt] = useState("");
  const [discountPct, setDiscountPct] = useState("");
  const [discountReason, setDiscountReason] = useState("volunteer_discretion");
  const [discountUnlocked, setDiscountUnlocked] = useState(false);
  const [adminPinPrompt, setAdminPinPrompt] = useState(false);
  const [adminPinValue, setAdminPinValue] = useState("");
  const [adminPinErr, setAdminPinErr] = useState("");

  const [payment, setPayment] = useState<"upi" | "cash" | "split" | "pending">("cash");
  const [cashAmt, setCashAmt] = useState("");
  const [upiAmt, setUpiAmt] = useState("");

  const [charging, setCharging] = useState(false);
  const [undo, setUndo] = useState<{ orderId: string; snapshot: unknown; timer: ReturnType<typeof setTimeout> } | null>(
    null
  );

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const refreshOutboxCount = useCallback(() => {
    outboxCount().then(setPendingOutbox);
  }, []);

  useEffect(() => {
    refreshOutboxCount();
    const onVis = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        flushOutbox(() => refreshOutboxCount()).then(refreshOutboxCount);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onVis);
    };
  }, [refreshOutboxCount]);

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
        if (cat.data.colors[0]) setColorId(cat.data.colors[0].id);
        if (cat.data.fits[0]) setFitId(cat.data.fits[0].id);
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
        setShift(shiftRes.shift);
        setBlock(shiftRes.block);
      }
      setLoading(false);
    }
    boot();
  }, [router]);

  const sizesForSelection = useMemo(() => {
    if (!colorId || !fitId) return [];
    return skus
      .filter((s) => s.color_id === colorId && s.fit_id === fitId)
      .sort((a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size));
  }, [skus, colorId, fitId]);

  function addGarment(sku: ProductSku) {
    if (sku.stock_qty <= 0) {
      if (!window.confirm(`${sku.sku_code} shows 0 in stock. Add anyway?`)) return;
    }
    const color = colors.find((c) => c.id === sku.color_id)?.name || "";
    const fit = fits.find((f) => f.id === sku.fit_id)?.name || "";
    const g: CartGarment = {
      key: uuidv4(),
      product_sku_id: sku.id,
      label: `${cap(color)} · ${cap(fit)} · ${sku.size}`,
      stockNote: sku.stock_qty > 0 ? `${sku.stock_qty} in stock` : "OUT OF STOCK — confirmed",
      unit_price: Number(sku.unit_price),
      unit_cost: Number(sku.unit_cost),
      stickers: [],
    };
    setGarments((prev) => [...prev, g]);
    setTargetGarmentKey(g.key);
  }

  function removeGarment(key: string) {
    setGarments((prev) => prev.filter((g) => g.key !== key));
    if (targetGarmentKey === key) setTargetGarmentKey(null);
  }

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
    if (design.stock_qty <= 0) {
      if (!window.confirm(`${design.code} shows 0 in stock. Add anyway?`)) return;
    }
    const entry: CartSticker = {
      key: uuidv4(),
      sticker_design_id: design.id,
      code: design.code,
      unit_price: Number(design.unit_price),
      unit_cost: Number(design.unit_cost),
    };
    setRecent((r) => [design.code, ...r.filter((c) => c !== design.code)].slice(0, 8));
    if (targetGarmentKey) {
      setGarments((prev) =>
        prev.map((g) => (g.key === targetGarmentKey ? { ...g, stickers: [...g.stickers, entry] } : g))
      );
    } else {
      setStandalone((prev) => [...prev, { ...entry, kind: "standalone" }]);
    }
  }

  function removeStickerFromGarment(gKey: string, sKey: string) {
    setGarments((prev) =>
      prev.map((g) => (g.key === gKey ? { ...g, stickers: g.stickers.filter((s) => s.key !== sKey) } : g))
    );
  }
  function removeStandalone(sKey: string) {
    setStandalone((prev) => prev.filter((s) => s.key !== sKey));
  }

  function addCustomSticker() {
    const price = Number(customPrice) || 0;
    const entry: CartSticker = {
      key: uuidv4(),
      custom: { size_class: customSize, description: customDesc || "Custom sticker" },
      code: "C-????",
      unit_price: price,
      unit_cost: 0,
    };
    if (targetGarmentKey) {
      setGarments((prev) =>
        prev.map((g) => (g.key === targetGarmentKey ? { ...g, stickers: [...g.stickers, entry] } : g))
      );
    } else {
      setStandalone((prev) => [...prev, { ...entry, kind: "standalone" }]);
    }
    setCustomOpen(false);
    setCustomDesc("");
    setCustomPrice("0");
  }

  async function redeemTicket() {
    setTicketErr("");
    const raw = ticketCode.trim();
    if (!raw) return;

    // The same field accepts a scanned QR and a typed code. A QR carries the
    // whole cart, so it resolves with no network at all (PRD §10) — which is
    // the point, because the kiosk and the till are two phones on mobile data
    // that cannot reach each other locally.
    const scanned = await decodeTicket(raw);
    let j: { ticket: { code: string; payload: unknown } };
    let code: string;

    if (scanned) {
      const expanded = expandTicket(scanned);
      code = expanded.code;
      j = { ticket: expanded };
    } else {
      code = raw.toUpperCase();
      const res = await fetch(`/api/tickets/${code}`).catch(() => null);
      if (!res) {
        setTicketErr("Offline — scan the QR on the kiosk screen instead of typing the code.");
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTicketErr(body.error || "No open ticket with that code.");
        return;
      }
      j = body;
    }
    type TicketSticker = {
      sticker_design_id: string;
      code: string;
      side?: "front" | "back";
      pos_x?: number;
      pos_y?: number;
      rotation?: number;
      unit_price: number;
      unit_cost: number;
    };
    type TicketGarment = {
      product_sku_id: string;
      sku_code: string;
      unit_price: number;
      unit_cost: number;
      stickers: TicketSticker[];
    };
    const payload = j.ticket.payload as { garments: TicketGarment[] };
    const newGarments: CartGarment[] = payload.garments.map((g) => ({
      key: uuidv4(),
      product_sku_id: g.product_sku_id,
      label: `${g.sku_code} (from ticket ${code})`,
      stockNote: "from design ticket",
      unit_price: Number(g.unit_price),
      unit_cost: Number(g.unit_cost),
      stickers: g.stickers.map((s) => ({
        key: uuidv4(),
        sticker_design_id: s.sticker_design_id,
        code: s.code,
        unit_price: Number(s.unit_price),
        unit_cost: Number(s.unit_cost),
        side: s.side ?? "front",
        pos_x: s.pos_x,
        pos_y: s.pos_y,
        rotation: s.rotation,
      })),
    }));
    setGarments((prev) => [...prev, ...newGarments]);
    setRedeemedTicketCode(code);
    setTicketCode("");
  }

  const subtotal = useMemo(() => {
    const gTotal = garments.reduce(
      (s, g) => s + g.unit_price + g.stickers.reduce((ss, st) => ss + st.unit_price, 0),
      0
    );
    const standaloneTotal = standalone.reduce((s, st) => s + st.unit_price, 0);
    return gTotal + standaloneTotal;
  }, [garments, standalone]);

  const discountAmount = useMemo(() => {
    const pct = Number(discountPct) || 0;
    const amt = Number(discountAmt) || 0;
    if (pct > 0) return Math.round((subtotal * pct) / 100);
    return amt;
  }, [discountAmt, discountPct, subtotal]);

  const discountPctEffective = subtotal > 0 ? (discountAmount / subtotal) * 100 : 0;
  const needsAdminGate = discountPctEffective > 10 && discountAmount > 0;

  const total = Math.max(0, subtotal - discountAmount);
  const cartEmpty = garments.length === 0 && standalone.length === 0;

  useEffect(() => {
    // Intentional state sync: discountUnlocked is set true by a user action
    // (admin PIN entry) and must be reset once the gate that required it no
    // longer applies — it can't be derived purely from needsAdminGate.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!needsAdminGate) setDiscountUnlocked(false);
  }, [needsAdminGate]);

  async function submitAdminPin() {
    setAdminPinErr("");
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "admin", pin: adminPinValue }),
    });
    const j = await res.json().catch(() => ({}));
    if (j.ok) {
      setDiscountUnlocked(true);
      setAdminPinPrompt(false);
      setAdminPinValue("");
    } else {
      // A lockout must not read as a wrong PIN, or the volunteer keeps
      // retyping a PIN that was correct and the queue keeps growing.
      setAdminPinErr(res.status === 429 ? j.error : "Incorrect admin PIN");
    }
  }

  const splitTotal = (Number(cashAmt) || 0) + (Number(upiAmt) || 0);
  const splitOk = payment !== "split" || Math.abs(splitTotal - total) < 1;

  function resetCart() {
    setGarments([]);
    setStandalone([]);
    setTargetGarmentKey(null);
    setDiscountAmt("");
    setDiscountPct("");
    setDiscountUnlocked(false);
    setPayment("cash");
    setCashAmt("");
    setUpiAmt("");
    setRedeemedTicketCode(null);
  }

  async function charge() {
    if (cartEmpty) return;
    if (needsAdminGate && !discountUnlocked) {
      setAdminPinPrompt(true);
      return;
    }
    if (!splitOk) return;
    if (!shift || !block) return;

    setCharging(true);
    const orderId = uuidv4();
    const deviceId = getDeviceId();

    const items = [
      ...garments.map((g) => ({
        product_sku_id: g.product_sku_id,
        qty: 1,
        unit_price: g.unit_price,
        unit_cost: g.unit_cost,
        stickers: g.stickers.map((s) => ({
          sticker_design_id: s.sticker_design_id,
          size_class: s.custom?.size_class,
          description: s.custom?.description,
          unit_price: s.unit_price,
          unit_cost: s.unit_cost,
          side: s.side,
          pos_x: s.pos_x,
          pos_y: s.pos_y,
          rotation: s.rotation,
        })),
      })),
      ...standalone.map((s) => ({
        product_sku_id: null,
        qty: 1,
        unit_price: s.unit_price,
        unit_cost: s.unit_cost,
        stickers: [
          {
            sticker_design_id: s.sticker_design_id,
            size_class: s.custom?.size_class,
            description: s.custom?.description,
            unit_price: s.unit_price,
            unit_cost: s.unit_cost,
          },
        ],
      })),
    ];

    const payload = {
      id: orderId,
      shiftId: shift.id,
      deviceId,
      items,
      subtotal,
      discountAmount,
      discountReason: discountAmount > 0 ? discountReason : undefined,
      designTicket: redeemedTicketCode || undefined,
      total,
      costTotal: garments.reduce((s, g) => s + g.unit_cost, 0),
      paymentMethod: payment,
      paidCash: payment === "cash" ? total : payment === "split" ? Number(cashAmt) || 0 : 0,
      paidUpi: payment === "upi" ? total : payment === "split" ? Number(upiAmt) || 0 : 0,
      clientCreatedAt: new Date().toISOString(),
    };

    const snapshot = { garments, standalone, discountAmt, discountPct, payment, cashAmt, upiAmt };
    resetCart();
    setCharging(false);

    let synced = false;
    let receiptNo = "PENDING SYNC";
    if (navigator.onLine) {
      try {
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const j = await res.json();
          receiptNo = j.order.receipt_no;
          synced = true;
        }
      } catch {
        // fall through to outbox
      }
    }
    if (!synced) {
      await enqueueOrder({ id: orderId, payload, queuedAt: new Date().toISOString(), status: "queued" });
      refreshOutboxCount();
    }

    sessionStorage.setItem(
      "last_receipt",
      JSON.stringify({ ...payload, receipt_no: receiptNo, synced, shiftName: shift.name })
    );

    const timer = setTimeout(() => {
      setUndo(null);
      router.push("/receipt");
    }, 8000);
    setUndo({ orderId, snapshot, timer });
  }

  function doUndo() {
    if (!undo) return;
    clearTimeout(undo.timer);
    const snap = undo.snapshot as {
      garments: CartGarment[];
      standalone: CartStandaloneSticker[];
      discountAmt: string;
      discountPct: string;
      payment: "upi" | "cash" | "split" | "pending";
      cashAmt: string;
      upiAmt: string;
    };
    setGarments(snap.garments);
    setStandalone(snap.standalone);
    setDiscountAmt(snap.discountAmt);
    setDiscountPct(snap.discountPct);
    setPayment(snap.payment);
    setCashAmt(snap.cashAmt);
    setUpiAmt(snap.upiAmt);
    setUndo(null);
    import("@/lib/outbox").then(({ removeFromOutbox }) => removeFromOutbox(undo.orderId));
    fetch(`/api/orders/${undo.orderId}/void`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "undo" }),
    }).catch(() => null);
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-ink text-cream font-mono text-sm">
        Loading stall…
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <PosFrame
        kicker="STALL OS · SELL"
        title={shift?.name || "Sell"}
        meta={
          <>
            <div>{shift?.venue}</div>
            <div>{block ? `${block.next_no - block.start_no}/${block.end_no - block.start_no + 1} used` : ""}</div>
          </>
        }
        banner={
          <>
            {!online && (
              <Banner tone="signal">
                <span>OFFLINE — sales queue locally</span>
                <span>{pendingOutbox} queued</span>
              </Banner>
            )}
            {online && pendingOutbox > 0 && (
              <Banner tone="blue">
                <span>SYNCING OUTBOX</span>
                <span>{pendingOutbox} pending</span>
              </Banner>
            )}
            {catalogueAge && (
              // Selling from a cached catalogue is fine; selling from one
              // without knowing it is not. Stock counts shown here predate
              // whatever the other seven devices have sold since.
              <Banner tone="signal">
                <span>CACHED CATALOGUE — STOCK MAY BE STALE</span>
                <span>{catalogueAge}</span>
              </Banner>
            )}
          </>
        }
      >
        <Panel accent>
          <PanelLabel color="var(--color-blue)">Load design ticket</PanelLabel>
          <div className="flex gap-2">
            <Field
              label="Kiosk design ticket code"
              value={ticketCode}
              onChange={(e) => setTicketCode(e.target.value.toUpperCase())}
              placeholder="A7K2"
              className="uppercase tracking-widest font-extrabold text-xl"
            />
            <BigButton variant="blue" onClick={redeemTicket} className="px-4">
              LOAD
            </BigButton>
          </div>
          {ticketErr && (
            <div className="bg-signal text-cream p-2 font-extrabold text-[10px] tracking-wide uppercase">
              {ticketErr}
            </div>
          )}
        </Panel>

        <div className="border-2 border-ink bg-white">
          <div className="bg-ink text-cream px-2.5 py-1.5 font-extrabold text-[10px] tracking-[0.14em] flex justify-between">
            <span>CART</span>
            <span>{garments.length + standalone.length} item(s) · ₹{total}</span>
          </div>
          {cartEmpty && (
            <div className="p-4 text-center text-sm text-muted">
              Nothing in cart. Add a garment below or load a ticket.
            </div>
          )}
          {garments.map((g) => (
            <div
              key={g.key}
              role="button"
              tabIndex={0}
              onClick={() => setTargetGarmentKey(g.key)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setTargetGarmentKey(g.key);
                }
              }}
              // Which garment stickers attach to. This was a 10% blue tint —
              // effectively invisible in direct sunlight, on the control that
              // decides which shirt gets pressed. A full 2px outline is the
              // surrounding design language (every Panel, Field and Chip is
              // bordered this way) and reads at arm's length; outline does not
              // affect layout, so nothing shifts as selection moves.
              className={`p-2.5 border-b border-hairline cursor-pointer ${
                targetGarmentKey === g.key
                  ? "bg-blue/15 outline-2 -outline-offset-2 outline-blue"
                  : ""
              }`}
            >
              <div className="flex justify-between gap-2">
                <div>
                  <div className="font-extrabold text-[17px]">{g.label}</div>
                  <Mono>{g.stockNote}{targetGarmentKey === g.key ? " · adding stickers here" : ""}</Mono>
                </div>
                <div className="text-right flex flex-col items-end gap-1.5">
                  <div className="font-extrabold text-[17px]">
                    ₹{g.unit_price + g.stickers.reduce((s, st) => s + st.unit_price, 0)}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeGarment(g.key);
                    }}
                    className="tap-target min-w-[48px] inline-flex items-center justify-center border border-signal text-signal text-[9px] font-extrabold px-1.5 py-1 tracking-wide"
                  >
                    REMOVE
                  </button>
                </div>
              </div>
              {g.stickers.map((st) => (
                <div key={st.key} className="flex justify-between text-[13px] border-t border-dashed border-hairline pt-1.5 mt-1.5">
                  <Mono>{st.custom ? `Custom (${st.custom.size_class})` : st.code}</Mono>
                  <span className="flex gap-2 items-center">
                    ₹{st.unit_price}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeStickerFromGarment(g.key, st.key);
                      }}
                      className="tap-target min-w-[48px] inline-flex items-center justify-center text-signal font-bold"
                    >
                      ×
                    </button>
                  </span>
                </div>
              ))}
            </div>
          ))}
          {standalone.map((s) => (
            <div key={s.key} className="p-2.5 border-b border-hairline flex justify-between">
              <div>
                <div className="font-extrabold text-[15px]">Sticker only · {s.custom ? "Custom" : s.code}</div>
              </div>
              <div className="flex gap-2 items-center">
                ₹{s.unit_price}
                <button onClick={() => removeStandalone(s.key)} className="text-signal font-bold text-lg">
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>

        <Panel>
          <PanelLabel>Add garment</PanelLabel>
          <div className="flex flex-wrap gap-1.5">
            {colors.map((c) => (
              <Chip key={c.id} active={colorId === c.id} onClick={() => setColorId(c.id)}>
                {cap(c.name)}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {fits.map((f) => (
              <Chip key={f.id} active={fitId === f.id} onClick={() => setFitId(f.id)}>
                {cap(f.name)}
              </Chip>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {sizesForSelection.map((sku) => (
              <button
                key={sku.id}
                onClick={() => addGarment(sku)}
                className={`border-2 border-ink py-2 font-extrabold text-sm min-h-[52px] ${
                  sku.stock_qty <= 0 ? "bg-hairline text-muted" : "bg-white text-ink"
                }`}
              >
                <span>{sku.size}</span>
                <span className="block font-mono text-[9px] font-normal">{sku.stock_qty} left</span>
              </button>
            ))}
            {sizesForSelection.length === 0 && (
              <div className="col-span-4 text-center text-xs text-muted py-2">No sizes for this combo.</div>
            )}
          </div>
        </Panel>

        <Panel>
          <div className="flex justify-between items-baseline gap-2">
            <PanelLabel>Add sticker</PanelLabel>
            <Mono>{targetGarmentKey ? "→ onto selected garment" : "→ standalone sale"}</Mono>
          </div>
          <Field
            label="Search stickers by code, name or tag"
            value={stickerQuery}
            onChange={(e) => setStickerQuery(e.target.value)}
            placeholder="14, m14, ramen, anime…"
          />
          <div className="flex flex-wrap gap-1.5">
            {(["S", "M", "L"] as const).map((sz) => (
              <Chip key={sz} active={sizeFilter === sz} onClick={() => setSizeFilter(sizeFilter === sz ? null : sz)}>
                {sz}
              </Chip>
            ))}
          </div>
          {recent.length > 0 && (
            <div className="flex flex-col gap-1">
              <PanelLabel>Recent</PanelLabel>
              <div className="flex gap-1.5 overflow-x-auto">
                {recent.map((code) => {
                  const d = designs.find((x) => x.code === code);
                  return (
                    d && (
                      <button
                        key={code}
                        onClick={() => addSticker(d)}
                        className="flex-shrink-0 bg-cream border-2 border-ink font-mono text-xs font-bold px-2.5 py-2 min-h-[48px]"
                      >
                        {code}
                      </button>
                    )
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
            {stickerResults.map((d) => (
              <button
                key={d.id}
                onClick={() => addSticker(d)}
                className="flex items-center gap-2.5 border-2 border-ink p-2 text-left"
              >
                <span className="w-10 h-10 flex items-center justify-center bg-cream border border-ink font-mono text-[10px] font-bold flex-shrink-0">
                  {d.code}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-extrabold text-sm">{d.code} · {d.name}</span>
                  <Mono>{d.bin_location || "no bin set"} · {d.stock_qty} left</Mono>
                </span>
                <span className="font-extrabold text-sm">₹{d.unit_price}</span>
              </button>
            ))}
            {designs.length === 0 && (
              <div className="text-center text-xs text-muted py-3">
                No sticker designs seeded yet — import the catalogue in /admin.
              </div>
            )}
            {designs.length > 0 && stickerResults.length === 0 && (
              <div className="text-center text-xs text-muted py-3">
                No match. Try a code like <strong>14</strong> or <strong>m14</strong>.
              </div>
            )}
          </div>
          {!customOpen && (
            <button
              onClick={() => setCustomOpen(true)}
              className="bg-cream border-2 border-dashed border-ink font-extrabold text-[10px] tracking-wide min-h-[48px]"
            >
              + CUSTOM STICKER
            </button>
          )}
          {customOpen && (
            <div className="flex flex-col gap-2 border-2 border-ink p-2.5 bg-cream">
              <Field
                label="Custom sticker description"
                placeholder="Description"
                value={customDesc}
                onChange={(e) => setCustomDesc(e.target.value)}
              />
              <div className="flex gap-1.5">
                {(["S", "M", "L"] as const).map((sz) => (
                  <Chip key={sz} active={customSize === sz} onClick={() => setCustomSize(sz)}>
                    {sz}
                  </Chip>
                ))}
                <Field
                  label="Custom sticker price in rupees"
                  type="number"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  placeholder="₹"
                  className="flex-1"
                />
              </div>
              <div className="flex gap-1.5">
                <BigButton variant="blue" onClick={addCustomSticker} className="flex-1">
                  ADD
                </BigButton>
                <BigButton variant="ghost" onClick={() => setCustomOpen(false)} className="flex-1">
                  CANCEL
                </BigButton>
              </div>
            </div>
          )}
        </Panel>

        <Panel>
          <PanelLabel>Discount</PanelLabel>
          <div className="flex gap-2">
            <Field
              label="Discount amount in rupees"
              placeholder="₹ amount"
              value={discountAmt}
              onChange={(e) => {
                setDiscountAmt(e.target.value);
                setDiscountPct("");
              }}
            />
            <Field
              label="Discount percentage"
              placeholder="% off"
              value={discountPct}
              onChange={(e) => {
                setDiscountPct(e.target.value);
                setDiscountAmt("");
              }}
            />
          </div>
          <select
            value={discountReason}
            onChange={(e) => setDiscountReason(e.target.value)}
            className="border-2 border-ink p-3 text-base min-h-[48px] bg-white"
          >
            <option value="volunteer_discretion">Volunteer discretion</option>
            <option value="freebie">Freebie</option>
            <option value="bulk">Bulk</option>
            <option value="damaged_item">Damaged item</option>
            <option value="price_match">Price match</option>
            <option value="other">Other</option>
          </select>
          {needsAdminGate && !discountUnlocked && (
            <div className="bg-signal text-cream p-2.5 font-extrabold text-[10px] tracking-wide uppercase">
              Above 10% — admin PIN required at Charge
            </div>
          )}
        </Panel>

        <Panel>
          <PanelLabel>Payment</PanelLabel>
          <div className="grid grid-cols-4 gap-1.5">
            {(["upi", "cash", "split", "pending"] as const).map((p) => (
              <Chip key={p} active={payment === p} onClick={() => setPayment(p)}>
                {p.toUpperCase()}
              </Chip>
            ))}
          </div>
          {payment === "split" && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Field label="Cash portion in rupees" placeholder="Cash ₹" value={cashAmt} onChange={(e) => setCashAmt(e.target.value)} />
                <Field label="UPI portion in rupees" placeholder="UPI ₹" value={upiAmt} onChange={(e) => setUpiAmt(e.target.value)} />
              </div>
              <div className={`text-xs font-mono ${splitOk ? "text-muted" : "text-signal font-bold"}`}>
                {splitOk ? `Splits to ₹${total}` : `Must total ₹${total} (currently ₹${splitTotal})`}
              </div>
            </div>
          )}
          <Mono>Single TerraRoots UPI destination — reference optional.</Mono>
        </Panel>

        <div className="h-2" />
      </PosFrame>

      <div className="sticky bottom-[46px] w-full max-w-[480px] mx-auto px-3.5">
        <BigButton
          variant="blue"
          className="w-full"
          disabled={cartEmpty || charging || !splitOk}
          onClick={charge}
        >
          {charging ? "CHARGING…" : `CHARGE ₹${total}`}
        </BigButton>
      </div>
      <TabBar />

      {adminPinPrompt && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-cream border-2 border-ink p-4 w-full max-w-xs flex flex-col gap-3">
            <PanelLabel>Admin PIN required (discount &gt; 10%)</PanelLabel>
            <Field
              label="Admin PIN"
              type="password"
              value={adminPinValue}
              onChange={(e) => setAdminPinValue(e.target.value)}
              autoFocus
            />
            {adminPinErr && <div className="text-signal text-xs font-bold">{adminPinErr}</div>}
            <div className="flex gap-2">
              <BigButton variant="blue" className="flex-1" onClick={submitAdminPin}>
                UNLOCK
              </BigButton>
              <BigButton variant="ghost" className="flex-1" onClick={() => setAdminPinPrompt(false)}>
                CANCEL
              </BigButton>
            </div>
          </div>
        </div>
      )}

      {undo && (
        <div className="fixed bottom-16 left-0 right-0 flex justify-center z-40 px-4">
          <div className="bg-ink text-cream px-4 py-3 flex items-center gap-3 border-2 border-blue">
            <span className="text-sm font-bold">Sale charged.</span>
            <button onClick={doUndo} className="text-blue font-extrabold text-sm underline">
              UNDO
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function cap(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
