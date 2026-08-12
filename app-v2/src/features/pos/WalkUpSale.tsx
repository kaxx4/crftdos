"use client";

/** The walk-up sale.
 *
 *  Confirmed still in scope: not every order starts at the kiosk. A customer
 *  who just wants a plain tee, or who points at a transfer in the box, gets
 *  served here and lands in the SAME prep/print/handover queue as a kiosk
 *  ticket. The board doesn't care where a ticket came from.
 *
 *  The charge path is optimistic and that is deliberate, not a shortcut: the
 *  cart clears BEFORE any network work, so the screen is ready for the next
 *  customer within a frame whether the write takes 80ms or never completes.
 *  Offline, the order goes to the outbox keyed by its client-generated id,
 *  which is the same id the server uses as a primary key — so a retry cannot
 *  double-charge. */

import { useMemo, useState } from "react";
import Link from "next/link";
import { getBackend } from "@/lib/backend";
import { getDeviceId } from "@/lib/device";
import { useEnvironment } from "@/lib/hooks/useEnvironment";
import { useAction, useAsync } from "@/lib/hooks/useAsync";
import { enqueueOrder } from "@/lib/outbox";
import type { CreateOrderInput } from "@/lib/backend";
import type { PaymentMethod, Placement, ProductSku, StickerDesign, StockRow } from "@/lib/domain/types";
import { money } from "@/lib/money";
import { Banner, Button, Chip, EmptyState, Field, Panel } from "@/components/ui";
import { clsx } from "@/components/clsx";

/** `ProductSku.stock_qty`/`StickerDesign.stock_qty` are an org-wide total
 *  (a DB trigger sums every location, warehouse included) — showing that on
 *  a walk-up sale would tell a volunteer at Stall A that Stall B's stock is
 *  theirs to sell. Overlaid with this stall's own `stall_stock` allocation,
 *  the same source `StockScreen` reads, before anything renders. */
function atThisStall<T extends { id: string }>(items: T[], stock: StockRow[], skuType: "product" | "sticker"): (T & { stock_qty: number })[] {
  const byId = new Map(stock.filter((r) => r.sku_type === skuType).map((r) => [r.sku_id, r.qty]));
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

  const [sku, setSku] = useState<ProductSku | null>(null);
  const [picked, setPicked] = useState<StickerDesign[]>([]);
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [toast, setToast] = useState<string | null>(null);
  const { run, busy, error, clearError } = useAction();

  const total = (sku?.unit_price ?? 0) + picked.reduce((n, d) => n + d.unit_price, 0);

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

  const charge = async () => {
    if (!sku || !environment) return;

    const placements: Placement[] = picked.map((d) => ({
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
    }));

    const payload: CreateOrderInput = {
      id: crypto.randomUUID(),
      environment_id: environment.id,
      channel: "stall",
      shift_id: shift.data?.shift?.id ?? null,
      device_id: getDeviceId(),
      customer_name: null,
      customer_phone: null,
      payment_method: method,
      paid_cash: method === "cash" ? total : 0,
      paid_upi: method === "upi" ? total : 0,
      discount_amount: 0,
      discount_reason: null,
      discount_note: null,
      manual_override: false,
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
    setPicked([]);
    setSearch("");

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

      <Panel title="Garment">
        {!catalogue ? (
          <p className="text-sm text-[var(--color-muted)]">Loading the catalogue…</p>
        ) : (
          <SkuGrid catalogue={catalogue} value={sku} onChange={setSku} />
        )}
      </Panel>

      <Panel title="Transfers">
        <Field
          label="Find a transfer"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Type 14, or m14, or a name"
          hint="Bin location is shown so you know where to walk."
        />
        <ul className="mt-3 flex flex-col gap-2">
          {results.map((d) => (
            <li key={d.id}>
              <button
                onClick={() => setPicked((p) => [...p, d])}
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
      </Panel>

      {picked.length > 0 && (
        <Panel title="On this order">
          <ul className="flex flex-col gap-2">
            {picked.map((d, i) => (
              <li key={`${d.id}-${i}`} className="flex items-center justify-between gap-3">
                <span className="font-[family-name:var(--font-mono)] font-bold">{d.code}</span>
                <span className="flex items-center gap-3">
                  <span className="font-[family-name:var(--font-mono)] tnum">{money(d.unit_price)}</span>
                  <Button size="md" variant="ghost" onClick={() => setPicked((p) => p.filter((_, j) => j !== i))}>
                    Remove
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="Payment">
        <div className="flex gap-2">
          {(["cash", "upi", "pending"] as const).map((m) => (
            <Chip key={m} selected={method === m} onClick={() => setMethod(m)} className="flex-1 justify-center">
              {m === "pending" ? "Pay later" : m.toUpperCase()}
            </Chip>
          ))}
        </div>
      </Panel>

      {/* Charge, pinned. It must be reachable with a thumb without scrolling,
          because it is the last thing in every transaction. */}
      <div className="sticky bottom-24 rounded-xl border-2 border-[var(--color-ink)] bg-[var(--color-ink)] p-3 text-[var(--color-cream)]">
        <div className="mb-2 flex items-end justify-between">
          <span className="text-xs font-bold uppercase tracking-[0.14em] opacity-70">Total</span>
          <span className="font-[family-name:var(--font-mono)] text-3xl font-bold tnum">{money(total)}</span>
        </div>
        <Button variant="primary" size="xl" block disabled={!sku} busy={busy} onClick={charge}>
          {sku ? "Charge" : "Pick a garment first"}
        </Button>
      </div>
    </div>
  );
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
