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
import {
  Badge,
  Banner,
  Button,
  Chip,
  ConfirmAction,
  EmptyState,
  Field,
  Heading,
  Mono,
  Nudge,
  Panel,
  PosScreen,
  Text,
  Checkbox,
} from "@/components/ui";
import { clsx } from "@/components/clsx";

const BASE_PRICE = 450;
const PRICE_PER_EXTRA_STICKER = 50;
const LOW_PRICE_WARNING = 250;
const LOW_STOCK_WARNING = 2;
const IDLE_CART_MS = 25_000;
// This used to be the threshold that required an admin PIN step-up before
// PIN auth was removed app-wide. Kept as the friction threshold, not a gate.
const DISCOUNT_CONFIRM_RATIO = 0.1;

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
  // Freebies already carry their own three-field sign-off, so this only
  // fires for a partial discount steep enough to be worth a second look.
  const bigDiscount = !freebie && naturalSubtotal > 0 && discountAmount / naturalSubtotal > DISCOUNT_CONFIRM_RATIO;

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
      <PosScreen>
        <PosScreen.Body>
          <Banner tone="warn" title="This phone isn't assigned to a stall yet">
            Pick your stall before selling — otherwise the sale lands in the wrong place.
          </Banner>
        </PosScreen.Body>
        <PosScreen.Foot>
          {/* inline-flex on the anchor: without it the <a> collapses to the
              line box and becomes a 21px-tall tap target wrapped around a
              56px button. The link is what receives the tap. */}
          <Link href="/settings" className="inline-flex w-full">
            <Button variant="primary" size="xl" block>
              Choose this phone&apos;s stall
            </Button>
          </Link>
        </PosScreen.Foot>
      </PosScreen>
    );
  }

  if (!shift.loading && !shift.data?.shift) {
    return (
      <PosScreen>
        <PosScreen.Body>
          <EmptyState
            headline="No shift open yet"
            teach="A shift has to be open before you can sell — it's what gives this phone its own block of receipt numbers. Open one from More, then come back here."
          />
        </PosScreen.Body>
        <PosScreen.Foot>
          <Link href="/pos/more" className="inline-flex w-full">
            <Button variant="primary" size="xl" block>
              Open a shift
            </Button>
          </Link>
        </PosScreen.Foot>
      </PosScreen>
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
    <PosScreen>
      {/* Fixed: what is on the ticket right now. A volunteer mid-conversation
          should never have to scroll back up to check whether they picked a
          size, and the count is the thing that silently goes wrong. */}
      <PosScreen.Head className="flex items-center justify-between gap-[var(--space-3)]">
        <div className="min-w-0">
          <p className="t-label text-[var(--color-muted)]">On this ticket</p>
          <p className="t-base truncate font-extrabold">
            {sku ? `${sku.sku_code} · ${sku.size}` : "No tee picked yet"}
          </p>
        </div>
        <Badge tone={stickers.length > 0 ? "cobalt" : "white"}>
          <Mono>{stickers.length}</Mono> transfer{stickers.length === 1 ? "" : "s"}
        </Badge>
      </PosScreen.Head>

      <PosScreen.Body>
      {toast && (
        <Banner tone="success" action={<Button variant="ghost" onClick={() => setToast(null)}>Dismiss</Button>}>
          {toast}
        </Banner>
      )}
      {error && (
        <Banner tone="danger" title="That sale didn't go through" action={<Button variant="ghost" onClick={clearError}>Dismiss</Button>}>
          {error}
        </Banner>
      )}

      <Panel title="Tee">
        {!catalogue ? (
          <Text muted>Loading the catalogue…</Text>
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
        {/* One tone for the whole result list — the row you want is found by
            its code and its bin, not by being a different colour. */}
        <ul className="mt-[var(--space-3)] flex flex-col gap-[var(--space-2)]">
          {results.map((d) => (
            <li key={d.id}>
              <button
                onClick={() => setStickers((p) => [...p, { kind: "catalogue", key: `${d.id}-${Date.now()}`, design: d }])}
                className={clsx(
                  "flex min-h-[var(--tap-pos)] w-full items-center justify-between gap-[var(--space-3)] text-left",
                  "rounded-[var(--radius-lg)] border-[3px] border-[var(--color-ink)] bg-white px-[var(--space-3)] py-[var(--space-2)]",
                  "shadow-[var(--shadow-sticker)] transition-[transform,box-shadow] duration-[var(--dur-fast)]",
                  "active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
                )}
              >
                <span className="min-w-0">
                  <Mono className="t-md font-bold">{d.code}</Mono>
                  <span className="ml-2 t-base">{d.name}</span>
                  {/* Bin location is the highest-value detail on this screen:
                      it tells them where to physically walk. */}
                  <span className="block t-base text-[var(--color-muted)]">
                    {d.bin_location} · {d.stock_qty} left
                  </span>
                </span>
                <Mono className="t-md font-bold">{money(d.unit_price)}</Mono>
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li>
              <Text muted className="py-[var(--space-3)] text-center">
                Nothing matches that. Try just the number.
              </Text>
            </li>
          )}
        </ul>

        {/* Custom sticker — no catalogue code. The volunteer describes it;
            the server assigns the next C-series number, since nobody at the
            till is expected to remember which one's free. */}
        {addingCustom ? (
          <div className="mt-[var(--space-3)] flex flex-col gap-[var(--space-3)] rounded-[var(--radius-lg)] border-[3px] border-dashed border-[var(--color-ink)] p-[var(--space-3)]">
            <Field
              label="Describe the custom print"
              value={customDesc}
              onChange={(e) => setCustomDesc(e.target.value)}
              placeholder="e.g. hand-drawn cat, back placement"
              hint="The server assigns the next C-series code — you don't need to know which one is free."
            />
            <div className="flex flex-col gap-[var(--space-1)]">
              <span className="t-label">Size class</span>
              <div className="flex gap-[var(--space-2)]">
                {(["S", "M", "L"] as const).map((sz) => (
                  <Chip key={sz} selected={customSize === sz} onClick={() => setCustomSize(sz)} className="flex-1 justify-center">
                    {sz}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-[var(--space-3)]">
              <Button variant="secondary" disabled={!customDesc.trim()} onClick={addCustomSticker} className="flex-1">
                Add custom sticker
              </Button>
              <Button variant="ghost" onClick={() => setAddingCustom(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" block className="mt-[var(--space-3)]" onClick={() => setAddingCustom(true)}>
            + Add a custom sticker (no code)
          </Button>
        )}
      </Panel>

      {stickers.length > 0 && (
        <Panel title={`On this order (${stickers.length})`}>
          <ul className="flex flex-col divide-y-2 divide-[var(--color-line-soft)]">
            {stickers.map((s, i) => (
              <li key={s.key} className="flex items-center justify-between gap-[var(--space-3)] py-[var(--space-2)]">
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-[var(--space-2)]">
                  <Mono className="t-md font-bold">
                    {s.kind === "catalogue" ? s.design.code : `C-series · ${s.sizeClass}`}
                  </Mono>
                  {s.kind === "custom" && (
                    <span className="min-w-0 flex-1 truncate t-base text-[var(--color-muted)]">{s.description}</span>
                  )}
                  {s.kind === "catalogue" && s.design.stock_qty <= LOW_STOCK_WARNING && (
                    <Badge tone="orange">{s.design.stock_qty} left</Badge>
                  )}
                </span>
                <Button variant="ghost" onClick={() => setStickers((p) => p.filter((_, j) => j !== i))}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
          {stickers.some((s) => s.kind === "catalogue" && s.design.stock_qty <= LOW_STOCK_WARNING) && (
            <Nudge className="mt-[var(--space-3)]">
              Running low on one of these transfers — worth restocking after this sale.
            </Nudge>
          )}
        </Panel>
      )}

      <Panel title="Price">
        <div className="flex flex-wrap items-center justify-between gap-[var(--space-3)]">
          {editingPrice && !freebie ? (
            <Field
              autoFocus
              label="Price charged (₹)"
              type="number"
              inputMode="numeric"
              value={priceOverride ?? String(suggestedPrice)}
              onChange={(e) => setPriceOverride(e.target.value)}
              onBlur={() => setEditingPrice(false)}
              className="w-40"
            />
          ) : (
            <button
              disabled={freebie}
              onClick={() => setEditingPrice(true)}
              className={clsx(
                "flex min-h-[var(--tap-pos)] items-center rounded-[var(--radius-lg)] border-[3px] border-dashed border-[var(--color-ink)]",
                "bg-white px-[var(--space-3)] font-[family-name:var(--font-mono)] tnum t-xl disabled:opacity-60"
              )}
            >
              {money(finalPrice)}
              <span className="sr-only"> — tap to change the price</span>
            </button>
          )}
          <div className="flex items-center gap-[var(--space-2)]">
            <Text muted>Preset {money(suggestedPrice)}</Text>
            {priceOverride !== null && !freebie && (
              <Button variant="ghost" onClick={() => setPriceOverride(null)}>
                Reset
              </Button>
            )}
          </div>
        </div>

        {priceIsLow && (
          <Banner tone="warn" className="mt-[var(--space-3)]">
            That&apos;s below ₹{LOW_PRICE_WARNING} for one tee and one transfer — worth a second look, or mark it
            as a freebie instead.
          </Banner>
        )}

        <Checkbox
          className="mt-[var(--space-3)]"
          checked={freebie}
          onChange={(e) => setFreebie(e.target.checked)}
          label="Freebie (₹0 — needs sign-off)"
        />

        {freebie && (
          <div className="mt-[var(--space-3)] flex flex-col gap-[var(--space-3)] rounded-[var(--radius-lg)] border-[3px] border-[var(--color-ink)] p-[var(--space-3)]">
            <Field label="Freebie for (name)" value={freebieName} onChange={(e) => setFreebieName(e.target.value)} />
            <Field label="Department" value={freebieDept} onChange={(e) => setFreebieDept(e.target.value)} placeholder="e.g. Events" />
            <Field label="Approved by" value={freebieApprover} onChange={(e) => setFreebieApprover(e.target.value)} />
          </div>
        )}
      </Panel>

      <Panel title="Customer (optional)">
        <div className="flex flex-col gap-[var(--space-3)]">
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
        <div className="flex flex-wrap gap-[var(--space-2)]">
          {(["cash", "upi", "split", "pending"] as const).map((m) => (
            <Chip key={m} selected={method === m} onClick={() => setMethod(m)} className="flex-1 justify-center">
              {m === "pending" ? "Pay later" : m === "split" ? "Cash + UPI" : m.toUpperCase()}
            </Chip>
          ))}
        </div>
        {method === "pending" && (
          <Nudge className="mt-[var(--space-3)]">
            Pending means unpaid — only pick this if you genuinely can&apos;t collect now, and follow up before
            shift close.
          </Nudge>
        )}
        {method === "split" && (
          <div className="mt-[var(--space-3)] flex flex-col gap-[var(--space-2)]">
            <div className="flex gap-[var(--space-3)]">
              <Field label="Cash (₹)" value={splitCash} onChange={(e) => setSplitCash(e.target.value)} inputMode="numeric" />
              <Field label="UPI (₹)" value={splitUpi} onChange={(e) => setSplitUpi(e.target.value)} inputMode="numeric" />
            </div>
            <p
              className={clsx(
                "t-base font-bold",
                splitMismatch ? "text-[var(--color-signal)]" : "text-[var(--color-muted)]"
              )}
            >
              {splitMismatch
                ? `Cash + UPI must add up to ${money(finalPrice)} — currently ${money(splitTotal)}.`
                : `Adds up to ${money(splitTotal)}.`}
            </p>
          </div>
        )}
      </Panel>

      {sku && canCharge && <IdleCartNudge key={cartFingerprint} />}
      </PosScreen.Body>

      {/* Charge, pinned. It must be reachable with a thumb at any scroll
          position, because it is the last thing in every transaction. */}
      <PosScreen.Foot className="flex flex-col gap-[var(--space-2)]">
        <div className="flex items-end justify-between gap-[var(--space-3)]">
          <span className="t-label text-white/80">Total</span>
          <Heading level={2} step="xl" className="font-[family-name:var(--font-mono)] tnum">
            {money(finalPrice)}
          </Heading>
        </div>
        {bigDiscount ? (
          <ConfirmAction
            variant="primary"
            size="xl"
            block
            busy={busy}
            disabled={!canCharge}
            label="Charge"
            confirmLabel={`Confirm ${money(finalPrice)} — that's a steep discount?`}
            onConfirm={charge}
          />
        ) : (
          <Button variant="primary" size="xl" block disabled={!canCharge} busy={busy} onClick={charge}>
            {!sku ? "Pick a tee first" : splitMismatch ? "Fix the payment split" : freebie && !canCharge ? "Fill in freebie sign-off" : "Charge"}
          </Button>
        )}
      </PosScreen.Foot>
    </PosScreen>
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
    <div className="flex flex-col gap-[var(--space-3)]">
      <div className="flex flex-col gap-[var(--space-1)]">
        <span className="t-label">Colour</span>
        <div className="flex flex-wrap gap-[var(--space-2)]">
          {catalogue.colors.map((c) => (
            <Chip key={c.id} selected={colorId === c.id} onClick={() => setColorId(c.id)}>
              {c.name}
            </Chip>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-[var(--space-1)]">
        <span className="t-label">Fit</span>
        <div className="flex flex-wrap gap-[var(--space-2)]">
          {catalogue.fits.map((f) => (
            <Chip key={f.id} selected={fitId === f.id} onClick={() => setFitId(f.id)}>
              {f.name}
            </Chip>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-[var(--space-1)]">
        <span className="t-label">Size</span>
        <div className="flex flex-wrap gap-[var(--space-2)]">
          {sizes.map((s) => {
            const on = value?.id === s.id;
            const out = s.stock_qty <= 0;
            return (
              <button
                key={s.id}
                onClick={() => onChange(s)}
                aria-pressed={on}
                className={clsx(
                  "flex min-h-[76px] min-w-[104px] flex-col items-center justify-center rounded-[var(--radius-lg)] px-[var(--space-3)]",
                  "border-[var(--color-ink)] transition-[transform,box-shadow] duration-[var(--dur-fast)]",
                  "active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
                  on
                    ? "on-deep border-[3px] bg-[var(--color-cobalt)] text-white shadow-[var(--shadow-sticker)]"
                    : "border-2 bg-white text-[var(--color-ink)]"
                )}
              >
                <span className="t-md font-extrabold">{s.size}</span>
                {/* Out of stock is shown and still selectable, behind a stop
                    colour — the opposite of the kiosk's choice, deliberately.
                    A volunteer holding the physical garment outranks the DB. */}
                <span
                  className={clsx(
                    "t-base",
                    out && !on
                      ? "text-[var(--color-signal)]"
                      : on
                        ? "text-white/80"
                        : "text-[var(--color-muted)]"
                  )}
                >
                  {out ? "none left" : `${s.stock_qty} left`}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
