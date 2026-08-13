"use client";

/** Sale entry — one page, top to bottom: tee, transfers, price, customer,
 *  payment, confirm.
 *
 *  Every sale recorded here (not just stall sales — this is the general
 *  record-of-sale tool now) lands in the same prep/print/handover queue as
 *  a kiosk ticket. The board doesn't care where a ticket came from.
 *
 *  Pricing is a flat combo, not the sum of catalogue unit prices: ₹450 for
 *  one tee + one transfer, +₹50 per additional transfer. The volunteer can
 *  edit it directly by tapping the number. `stall_create_order` trusts the
 *  order's own `total`/`discount_amount` rather than recomputing from line
 *  items, so the gap between what the catalogue would charge and what was
 *  actually charged becomes the logged discount automatically — every
 *  below-list-price sale is auditable without a separate manual step.
 *
 *  The charge path is optimistic and that is deliberate, not a shortcut: the
 *  cart clears BEFORE any network work, so the screen is ready for the next
 *  customer within a frame whether the write takes 80ms or never completes.
 *  Offline, the order goes to the outbox keyed by its client-generated id,
 *  which is the same id the server uses as a primary key — so a retry cannot
 *  double-charge. */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getBackend } from "@/lib/backend";
import { getDeviceId } from "@/lib/device";
import { useEnvironment } from "@/lib/hooks/useEnvironment";
import { useAction, useAsync } from "@/lib/hooks/useAsync";
import { enqueueOrder } from "@/lib/outbox";
import type { CreateOrderInput } from "@/lib/backend";
import type { PaymentMethod, Placement, ProductSku, StickerDesign, StockRow } from "@/lib/domain/types";
import { money } from "@/lib/money";
import { Banner, Button, Chip, EmptyState, Field, Nudge, Panel } from "@/components/ui";
import { clsx } from "@/components/clsx";

const BASE_PRICE = 450;
const PRICE_PER_EXTRA_STICKER = 50;
const LOW_PRICE_WARNING = 250;
const LOW_STOCK_WARNING = 2;
const IDLE_CART_MS = 25_000;

type PickedSticker =
  | { kind: "catalogue"; key: string; design: StickerDesign }
  | { kind: "custom"; key: string; description: string; sizeClass: "S" | "M" | "L" };

/** `ProductSku.stock_qty`/`StickerDesign.stock_qty` are an org-wide total
 *  (a DB trigger sums every location, warehouse included) — showing that on
 *  a walk-up sale would tell a volunteer at Stall A that Stall B's stock is
 *  theirs to sell. Overlaid with `available_qty` (this stall's own
 *  `stall_stock` allocation, minus every active named hold against it) —
 *  `qty` alone would still overstate what's sellable: a volunteer could be
 *  sold out from under a customer who already has some of it on hold. */
function atThisStall<T extends { id: string }>(items: T[], stock: StockRow[], skuType: "product" | "sticker"): (T & { stock_qty: number })[] {
  const byId = new Map(stock.filter((r) => r.sku_type === skuType).map((r) => [r.sku_id, r.available_qty]));
  return items.map((item) => ({ ...item, stock_qty: byId.get(item.id) ?? 0 }));
}

export function WalkUpSale() {
  const { environment, bound } = useEnvironment();
  const catalogueRaw = useAsync(() => getBackend().getCatalogue(), []);
  const locations = useAsync(() => getBackend().listStockLocations(), []);
  const location = locations.data?.find((l) => l.environment_id === environment?.id);
  const stock = useAsync(
    () => (location ? getBackend().getStock(location.id) : Promise.resolve({ ok: true as const, data: [] as StockRow[] })),
    [location?.id]
  );
  const catalogue = useMemo(() => {
    if (!catalogueRaw.data || !stock.data) return null;
    return {
      ...catalogueRaw.data,
      skus: atThisStall(catalogueRaw.data.skus, stock.data, "product"),
      designs: atThisStall(catalogueRaw.data.designs, stock.data, "sticker"),
    };
  }, [catalogueRaw.data, stock.data]);
  const shift = useAsync(
    () =>
      environment
        ? getBackend().getShiftContext(environment.id, getDeviceId())
        : Promise.resolve({ ok: true as const, data: { shift: null, block: null } }),
    [environment?.id]
  );

  // ── Tee ──────────────────────────────────────────────────────────────────
  const [sku, setSku] = useState<ProductSku | null>(null);

  // ── Transfers ────────────────────────────────────────────────────────────
  const [stickers, setStickers] = useState<PickedSticker[]>([]);
  const [search, setSearch] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);
  const [customDesc, setCustomDesc] = useState("");
  const [customSize, setCustomSize] = useState<"S" | "M" | "L">("M");

  // ── Price ────────────────────────────────────────────────────────────────
  const [priceOverride, setPriceOverride] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState(false);
  const [freebie, setFreebie] = useState(false);
  const [freebieName, setFreebieName] = useState("");
  const [freebieDept, setFreebieDept] = useState("");
  const [freebieApprover, setFreebieApprover] = useState("");

  // ── Customer ─────────────────────────────────────────────────────────────
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // ── Payment ──────────────────────────────────────────────────────────────
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [splitCash, setSplitCash] = useState("");
  const [splitUpi, setSplitUpi] = useState("");

  const [toast, setToast] = useState<string | null>(null);
  const { run, busy, error, clearError } = useAction();

  // A cart a volunteer forgot about mid-conversation — gentle, not a
  // blocker. Keyed by fingerprint below so it remounts (and re-arms) fresh
  // on any cart change instead of resetting state inside an effect.
  const cartFingerprint = `${sku?.id ?? ""}|${stickers.length}`;

  // Natural (catalogue) subtotal — informational, and the baseline the
  // logged discount is measured against. Custom stickers carry no catalogue
  // price (there's nothing to look up), so they contribute 0 here but still
  // count toward the sticker total the flat-price formula uses.
  const naturalSubtotal =
    (sku?.unit_price ?? 0) + stickers.reduce((n, s) => n + (s.kind === "catalogue" ? s.design.unit_price : 0), 0);

  const suggestedPrice = stickers.length === 0 ? BASE_PRICE : BASE_PRICE + PRICE_PER_EXTRA_STICKER * (stickers.length - 1);
  const finalPrice = freebie ? 0 : priceOverride !== null ? Number(priceOverride) || 0 : suggestedPrice;
  const priceIsLow = !freebie && finalPrice > 0 && finalPrice < LOW_PRICE_WARNING;
  const discountAmount = Math.max(0, naturalSubtotal - finalPrice);

  const splitTotal = (Number(splitCash) || 0) + (Number(splitUpi) || 0);
  const splitMismatch = method === "split" && splitTotal !== finalPrice;

  /** Code search that matches how a volunteer actually types under pressure:
   *  "14" finds S-014/M-014/L-014, "m14" narrows to M-014. Results carry BIN
   *  LOCATION, which is the single highest-value detail on this screen —
   *  it tells them where to physically walk. */
  const results = useMemo(() => {
    const all = (catalogue?.designs ?? []).filter((d) => d.is_active && d.stock_qty > 0);
    const q = search.trim().toLowerCase();
    if (!q) return all.slice(0, 12);
    const digits = q.replace(/\D/g, "");
    const letter = q.match(/^[sml]/)?.[0]?.toUpperCase();
    return all
      .filter((d) => {
        if (letter && d.size_class !== letter) return false;
        if (digits && !d.code.includes(digits.padStart(3, "0"))) return false;
        if (!digits && !letter) return d.name.toLowerCase().includes(q) || d.tags.some((t) => t.includes(q));
        return true;
      })
      .slice(0, 12);
  }, [catalogue, search]);

  if (!bound) {
    return (
      <div className="p-4">
        <Banner tone="warn" title="This phone isn't assigned to a stall yet">
          Open Settings and pick your stall before selling — otherwise the sale lands in the wrong place.
        </Banner>
      </div>
    );
  }

  if (!shift.loading && !shift.data?.shift) {
    return (
      <div className="p-4">
        <EmptyState
          headline="No shift open yet"
          teach="A shift has to be open before you can sell — it's what allocates this phone its receipt numbers. Open one from More."
          // inline-flex on the anchor: without it the <a> collapses to the line
          // box and becomes a 21px-tall tap target wrapped around a 48px
          // button. The link is what receives the tap, not the button.
          action={
            <Link href="/pos/more" className="inline-flex">
              <Button variant="primary">Go to More</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const addCustomSticker = () => {
    if (!customDesc.trim()) return;
    setStickers((p) => [...p, { kind: "custom", key: `custom-${Date.now()}`, description: customDesc.trim(), sizeClass: customSize }]);
    setCustomDesc("");
    setCustomSize("M");
    setAddingCustom(false);
  };

  const canCharge =
    !!sku &&
    !splitMismatch &&
    (!freebie || (freebieName.trim() && freebieDept.trim() && freebieApprover.trim()));

  const charge = async () => {
    if (!sku || !environment || !canCharge) return;

    const placements: Placement[] = stickers.map((s) => {
      if (s.kind === "catalogue") {
        const d = s.design;
        return {
          sticker_design_id: d.id,
          code: d.code,
          side: "front",
          // A walk-up sale has no composed layout — the volunteer presses it
          // centred. Recording 50/50 rather than null keeps the press sheet's
          // shape identical for kiosk and walk-up tickets.
          pos_x: 50,
          pos_y: 50,
          rotation: 0,
          print_w_cm: d.print_w_cm ?? 0,
          print_h_cm: d.print_h_cm ?? 0,
          cutout_path: d.cutout_path,
          unit_price: d.unit_price,
          unit_cost: d.unit_cost,
        };
      }
      return {
        sticker_design_id: null,
        code: "C-????", // server assigns the real C-series code
        description: s.description,
        size_class: s.sizeClass,
        side: "front",
        pos_x: 50,
        pos_y: 50,
        rotation: 0,
        print_w_cm: 0,
        print_h_cm: 0,
        cutout_path: null,
        unit_price: 0,
        unit_cost: 0,
      };
    });

    const paidCash = method === "cash" ? finalPrice : method === "split" ? Number(splitCash) || 0 : 0;
    const paidUpi = method === "upi" ? finalPrice : method === "split" ? Number(splitUpi) || 0 : 0;

    const payload: CreateOrderInput = {
      id: crypto.randomUUID(),
      environment_id: environment.id,
      channel: "stall",
      shift_id: shift.data?.shift?.id ?? null,
      device_id: getDeviceId(),
      customer_name: customerName.trim() || null,
      customer_phone: customerPhone.trim() || null,
      payment_method: method,
      paid_cash: paidCash,
      paid_upi: paidUpi,
      discount_amount: discountAmount,
      discount_reason: freebie ? "freebie" : discountAmount > 0 ? "volunteer_discretion" : null,
      discount_note: freebie
        ? `Freebie for ${freebieName.trim()}\nDepartment- ${freebieDept.trim()}\nApproved by - ${freebieApprover.trim()}`
        : null,
      manual_override: freebie || priceOverride !== null,
      designs: [
        {
          product_sku_id: sku.id,
          sku_code: sku.sku_code,
          unit_price: sku.unit_price,
          unit_cost: sku.unit_cost,
          placements,
        },
      ],
      client_created_at: new Date().toISOString(),
    };

    // Clear FIRST. The next customer is already standing there.
    setSku(null);
    setStickers([]);
    setSearch("");
    setPriceOverride(null);
    setFreebie(false);
    setFreebieName("");
    setFreebieDept("");
    setFreebieApprover("");
    setCustomerName("");
    setCustomerPhone("");
    setSplitCash("");
    setSplitUpi("");
    setMethod("cash");

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await enqueueOrder({ id: payload.id, payload, queuedAt: new Date().toISOString(), status: "queued" });
      setToast("Saved on this phone — it'll send when you're back online.");
      return;
    }

    const order = await run(() => getBackend().createOrder(payload));
    if (order) setToast(`Charged ${money(order.total)} · ${order.receipt_no ?? "pending"}`);
    else await enqueueOrder({ id: payload.id, payload, queuedAt: new Date().toISOString(), status: "queued" });
  };

  return (
    <div className="flex flex-col gap-4 p-3">
      {toast && (
        <Banner tone="success" action={<Button size="md" variant="ghost" onClick={() => setToast(null)}>Dismiss</Button>}>
          {toast}
        </Banner>
      )}
      {error && (
        <Banner tone="danger" title="That sale didn't go through" action={<Button size="md" variant="ghost" onClick={clearError}>Dismiss</Button>}>
          {error}
        </Banner>
      )}

      <Panel title="Tee">
        {!catalogue ? (
          <p className="text-sm text-[var(--color-muted)]">Loading the catalogue…</p>
        ) : (
          <SkuGrid catalogue={catalogue} value={sku} onChange={setSku} />
        )}
      </Panel>

      <Panel title="Transfers">
        <Field
          label="Find by code"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Type 14, or m14, or a name"
          hint="Bin location is shown so you know where to walk. Add as many as this order needs."
        />
        <ul className="mt-3 flex flex-col gap-2">
          {results.map((d) => (
            <li key={d.id}>
              <button
                onClick={() => setStickers((p) => [...p, { kind: "catalogue", key: `${d.id}-${Date.now()}`, design: d }])}
                className="tap-target flex w-full items-center justify-between gap-3 rounded-lg border-2 border-[var(--color-line)] bg-white px-3 text-left transition-transform duration-[var(--dur-fast)] active:scale-[0.98]"
              >
                <span>
                  <span className="font-[family-name:var(--font-mono)] font-bold">{d.code}</span>
                  <span className="ml-2 text-sm">{d.name}</span>
                  <span className="block text-xs text-[var(--color-muted)]">
                    {d.bin_location} · {d.stock_qty} left
                  </span>
                </span>
                <span className="font-[family-name:var(--font-mono)] font-bold tnum">{money(d.unit_price)}</span>
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="py-3 text-center text-sm text-[var(--color-muted)]">
              Nothing matches that. Try just the number.
            </li>
          )}
        </ul>

        {/* Custom sticker — no catalogue code. The volunteer describes it;
            the server assigns the next C-series number, since nobody at the
            till is expected to remember which one's free. */}
        {addingCustom ? (
          <div className="mt-3 flex flex-col gap-2 rounded-lg border-2 border-dashed border-[var(--color-line)] p-3">
            <Field
              label="Describe the custom print"
              value={customDesc}
              onChange={(e) => setCustomDesc(e.target.value)}
              placeholder="e.g. hand-drawn cat, back placement"
            />
            <div className="flex gap-2">
              {(["S", "M", "L"] as const).map((sz) => (
                <Chip key={sz} selected={customSize === sz} onClick={() => setCustomSize(sz)}>
                  {sz}
                </Chip>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="primary" size="md" disabled={!customDesc.trim()} onClick={addCustomSticker}>
                Add custom sticker
              </Button>
              <Button variant="ghost" size="md" onClick={() => setAddingCustom(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" size="md" className="mt-3" onClick={() => setAddingCustom(true)}>
            + Add a custom sticker (no code)
          </Button>
        )}
      </Panel>

      {stickers.length > 0 && (
        <Panel title="On this order">
          <ul className="flex flex-col gap-2">
            {stickers.map((s, i) => (
              <li key={s.key} className="flex items-center justify-between gap-3">
                <span className="font-[family-name:var(--font-mono)] font-bold">
                  {s.kind === "catalogue" ? s.design.code : `C-series · ${s.sizeClass}`}
                </span>
                {s.kind === "custom" && <span className="flex-1 truncate text-sm text-[var(--color-muted)]">{s.description}</span>}
                {s.kind === "catalogue" && s.design.stock_qty <= LOW_STOCK_WARNING && (
                  <span className="text-xs font-bold text-[var(--color-signal)]">{s.design.stock_qty} left</span>
                )}
                <Button size="md" variant="ghost" onClick={() => setStickers((p) => p.filter((_, j) => j !== i))}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
          {stickers.some((s) => s.kind === "catalogue" && s.design.stock_qty <= LOW_STOCK_WARNING) && (
            <Nudge className="mt-3">Running low on one of these transfers — worth restocking after this sale.</Nudge>
          )}
        </Panel>
      )}

      <Panel title="Price">
        <div className="flex items-center justify-between gap-3">
          {editingPrice && !freebie ? (
            <input
              autoFocus
              type="number"
              inputMode="numeric"
              value={priceOverride ?? String(suggestedPrice)}
              onChange={(e) => setPriceOverride(e.target.value)}
              onBlur={() => setEditingPrice(false)}
              className="w-32 rounded-lg border-2 border-[var(--color-blue)] px-2 py-1 font-[family-name:var(--font-mono)] text-2xl font-bold tnum"
            />
          ) : (
            <button
              disabled={freebie}
              onClick={() => setEditingPrice(true)}
              className="font-[family-name:var(--font-mono)] text-2xl font-bold tnum underline decoration-dashed underline-offset-4 disabled:no-underline disabled:opacity-60"
            >
              {money(finalPrice)}
            </button>
          )}
          <span className="text-sm text-[var(--color-muted)]">
            Preset {money(suggestedPrice)}
            {priceOverride !== null && !freebie && (
              <Button size="sm" variant="ghost" className="ml-2" onClick={() => setPriceOverride(null)}>
                Reset
              </Button>
            )}
          </span>
        </div>

        {priceIsLow && (
          <Banner tone="warn" className="mt-3">
            That&apos;s below ₹{LOW_PRICE_WARNING} for one tee and one transfer — worth a second look, or mark it as a freebie instead.
          </Banner>
        )}

        <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={freebie} onChange={(e) => setFreebie(e.target.checked)} className="size-5" />
          Mark as freebie (₹0 — needs sign-off)
        </label>

        {freebie && (
          <div className="mt-3 flex flex-col gap-2 rounded-lg border-2 border-[var(--color-line)] p-3">
            <Field label="Freebie for (name)" value={freebieName} onChange={(e) => setFreebieName(e.target.value)} />
            <Field label="Department" value={freebieDept} onChange={(e) => setFreebieDept(e.target.value)} placeholder="e.g. Events" />
            <Field label="Approved by" value={freebieApprover} onChange={(e) => setFreebieApprover(e.target.value)} />
          </div>
        )}
      </Panel>

      <Panel title="Customer (optional)">
        <div className="flex flex-col gap-3">
          <Field label="Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          <Field
            label="Phone"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            inputMode="tel"
          />
        </div>
      </Panel>

      <Panel title="Payment">
        <div className="flex gap-2">
          {(["cash", "upi", "split", "pending"] as const).map((m) => (
            <Chip key={m} selected={method === m} onClick={() => setMethod(m)} className="flex-1 justify-center">
              {m === "pending" ? "Pay later" : m === "split" ? "Cash + UPI" : m.toUpperCase()}
            </Chip>
          ))}
        </div>
        {method === "pending" && (
          <Nudge className="mt-3">Pending means unpaid — only pick this if you genuinely can&apos;t collect now, and follow up before shift close.</Nudge>
        )}
        {method === "split" && (
          <div className="mt-3 flex flex-col gap-2">
            <div className="flex gap-2">
              <Field label="Cash (₹)" value={splitCash} onChange={(e) => setSplitCash(e.target.value)} inputMode="numeric" />
              <Field label="UPI (₹)" value={splitUpi} onChange={(e) => setSplitUpi(e.target.value)} inputMode="numeric" />
            </div>
            <p className={clsx("text-sm font-semibold", splitMismatch ? "text-[var(--color-signal)]" : "text-[var(--color-muted)]")}>
              {splitMismatch
                ? `Cash + UPI must add up to ${money(finalPrice)} — currently ${money(splitTotal)}.`
                : `Adds up to ${money(splitTotal)}.`}
            </p>
          </div>
        )}
      </Panel>

      {sku && canCharge && <IdleCartNudge key={cartFingerprint} />}

      {/* Charge, pinned. It must be reachable with a thumb without scrolling,
          because it is the last thing in every transaction. */}
      <div className="sticky bottom-24 rounded-xl border-2 border-[var(--color-ink)] bg-[var(--color-ink)] p-3 text-[var(--color-cream)]">
        <div className="mb-2 flex items-end justify-between">
          <span className="text-xs font-bold uppercase tracking-[0.14em] opacity-70">Total</span>
          <span className="font-[family-name:var(--font-mono)] text-3xl font-bold tnum">{money(finalPrice)}</span>
        </div>
        <Button variant="primary" size="xl" block disabled={!canCharge} busy={busy} onClick={charge}>
          {!sku ? "Pick a tee first" : splitMismatch ? "Fix the payment split" : freebie && !canCharge ? "Fill in freebie sign-off" : "Charge"}
        </Button>
      </div>
    </div>
  );
}

/** Remounted (via `key`) on every cart change, so it always starts
 *  unarmed — no effect ever needs to reset state back to false. */
function IdleCartNudge() {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setIdle(true), IDLE_CART_MS);
    return () => clearTimeout(t);
  }, []);
  if (!idle) return null;
  return <Nudge>This one&apos;s been sitting a bit — ready to charge?</Nudge>;
}

/** Out-of-stock sizes are shown and selectable behind a warning, NOT hidden —
 *  the opposite of the kiosk's choice, and deliberately so. A volunteer
 *  holding the physical garment in their hand outranks the database. */
function SkuGrid({
  catalogue,
  value,
  onChange,
}: {
  catalogue: { colors: { id: string; name: string; hex: string }[]; fits: { id: string; name: string }[]; skus: ProductSku[] };
  value: ProductSku | null;
  onChange: (s: ProductSku) => void;
}) {
  const [colorId, setColorId] = useState(catalogue.colors[0]?.id ?? "");
  const [fitId, setFitId] = useState(catalogue.fits[0]?.id ?? "");
  const sizes = catalogue.skus.filter((s) => s.color_id === colorId && s.fit_id === fitId && s.is_active);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {catalogue.colors.map((c) => (
          <Chip key={c.id} selected={colorId === c.id} onClick={() => setColorId(c.id)}>
            {c.name}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {catalogue.fits.map((f) => (
          <Chip key={f.id} selected={fitId === f.id} onClick={() => setFitId(f.id)}>
            {f.name}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {sizes.map((s) => (
          <button
            key={s.id}
            onClick={() => onChange(s)}
            aria-pressed={value?.id === s.id}
            className={clsx(
              "tap-target min-w-[68px] rounded-lg border-2 px-3 font-bold transition-transform duration-[var(--dur-fast)] active:scale-[0.97]",
              value?.id === s.id
                ? "border-[var(--color-blue)] bg-[var(--color-blue)] text-white"
                : s.stock_qty <= 0
                  ? "border-[var(--color-signal)] bg-white text-[var(--color-signal)]"
                  : "border-[var(--color-line)] bg-white"
            )}
          >
            {s.size}
            <span className="block text-[11px] font-normal opacity-80">
              {s.stock_qty <= 0 ? "none left" : `${s.stock_qty} left`}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
