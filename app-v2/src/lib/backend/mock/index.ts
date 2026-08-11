/** In-memory implementation of the `Backend` contract.
 *
 *  This is a genuine implementation, not a stub: it enforces the same invariants
 *  the live database enforces, because a UI built against a permissive fake is
 *  a UI with no error states. Specifically it reproduces —
 *
 *    - stock floor guards that REFUSE rather than going negative, and refuse
 *      the whole order rather than leaving partial state (`stall_create_order`)
 *    - environment-scoped stock, so a sale at Stall B genuinely cannot be
 *      fulfilled from Stall A's allocation [009]
 *    - hold reservation with availability computed against the same location,
 *      closing the two-kiosks-one-transfer race (`stall_reserve_sticker_hold`)
 *    - idempotency on the client-supplied order id, so an outbox retry returns
 *      the existing order instead of charging twice
 *    - receipt numbers consumed from a per-device block, environment-prefixed
 *
 *  Where the mock is deliberately weaker than production, it says so inline. */

import {
  type AnalyticsSummary,
  type Backend,
  type Catalogue,
  type CreateOrderInput,
  type InteractionAnalytics,
  type Result,
  type ShiftContext,
  err,
  ok,
} from "../contract";
import type {
  Environment,
  Hold,
  KioskDesign,
  KioskEvent,
  Order,
  OrderItem,
  OrderSticker,
  Shift,
  StockLocation,
  StockRow,
  Template,
} from "../../domain/types";
import { currentFY, formatReceiptNo } from "../../money";
import { colors, designs, fits, skus, stockLocations } from "./seed";
import { getState, latency, mutate, stockKey, subscribe } from "./store";

const now = () => new Date().toISOString();
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 10)}`;

function locationForEnvironment(environmentId: string): StockLocation | undefined {
  return stockLocations.find((l) => l.environment_id === environmentId);
}

/** Active holds against a sticker at one location. Mirrors the predicate the
 *  live partial indexes are built on: not released, not converted, not expired. */
function activeHoldQty(stickerId: string, environmentId: string): number {
  const t = Date.now();
  return getState()
    .holds.filter(
      (h) =>
        h.sticker_id === stickerId &&
        h.environment_id === environmentId &&
        !h.released_at &&
        !h.converted_order &&
        new Date(h.expires_at).getTime() > t
    )
    .reduce((n, h) => n + h.qty, 0);
}

function qtyAt(locationId: string, skuType: "product" | "sticker", skuId: string): number {
  return getState().stock[stockKey(locationId, skuType, skuId)]?.qty ?? 0;
}

export class MockBackend implements Backend {
  readonly isMock = true;

  // ── Environments ─────────────────────────────────────────────────────────

  async listEnvironments(): Promise<Result<Environment[]>> {
    await latency(40);
    return ok([...getState().environments]);
  }

  async createEnvironment(input: {
    name: string;
    prefix: string;
    kind: Environment["kind"];
  }): Promise<Result<Environment>> {
    await latency();
    const prefix = input.prefix.trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9]{1,5}$/.test(prefix)) {
      return err("A prefix is 2-6 characters, starting with a letter. Example: SA", "conflict");
    }
    if (getState().environments.some((e) => e.prefix === prefix)) {
      return err(`Prefix ${prefix} is already used by another environment.`, "conflict");
    }
    return mutate((s) => {
      const env: Environment = {
        id: uid("env"),
        name: input.name.trim(),
        prefix,
        kind: input.kind,
        is_active: true,
        opened_at: now(),
        closed_at: null,
      };
      s.environments.push(env);
      // An environment without a stock location can never sell anything, so
      // the two are created together — there is no valid state where one
      // exists without the other.
      stockLocations.push({ id: `loc-${env.id}`, environment_id: env.id, name: env.name, is_warehouse: false });
      for (const d of designs) {
        s.stock[stockKey(`loc-${env.id}`, "sticker", d.id)] = {
          location_id: `loc-${env.id}`,
          sku_type: "sticker",
          sku_id: d.id,
          qty: 0,
          par_level: 0,
        };
      }
      for (const k of skus) {
        s.stock[stockKey(`loc-${env.id}`, "product", k.id)] = {
          location_id: `loc-${env.id}`,
          sku_type: "product",
          sku_id: k.id,
          qty: 0,
          par_level: 0,
        };
      }
      return ok(env);
    });
  }

  async closeEnvironment(id: string): Promise<Result<Environment>> {
    await latency();
    const loc = locationForEnvironment(id);
    // Closing with stock still allocated would silently remove it from the
    // sellable pool. Block with a count rather than auto-returning, because
    // the operator has a physical reconciliation to do either way.
    if (loc) {
      const remaining = Object.values(getState().stock)
        .filter((r) => r.location_id === loc.id)
        .reduce((n, r) => n + r.qty, 0);
      if (remaining > 0) {
        return err(
          `${remaining} items are still allocated here. Return them to the warehouse before closing.`,
          "conflict"
        );
      }
    }
    return mutate((s) => {
      const env = s.environments.find((e) => e.id === id);
      if (!env) return err<Environment>("Environment not found.", "not_found");
      env.is_active = false;
      env.closed_at = now();
      return ok(env);
    });
  }

  // ── Stock ────────────────────────────────────────────────────────────────

  async listStockLocations(): Promise<Result<StockLocation[]>> {
    await latency(30);
    return ok([...stockLocations]);
  }

  async getStock(locationId: string): Promise<Result<StockRow[]>> {
    await latency(50);
    return ok(Object.values(getState().stock).filter((r) => r.location_id === locationId));
  }

  async transferStock(input: {
    from_location_id: string;
    to_location_id: string;
    sku_type: "product" | "sticker";
    sku_id: string;
    qty: number;
    actor: string;
  }): Promise<Result<{ from: StockRow; to: StockRow }>> {
    await latency();
    if (input.qty <= 0) return err("Transfer quantity must be at least 1.", "conflict");
    if (input.from_location_id === input.to_location_id) return err("Pick two different locations.", "conflict");
    return mutate((s) => {
      const fromKey = stockKey(input.from_location_id, input.sku_type, input.sku_id);
      const toKey = stockKey(input.to_location_id, input.sku_type, input.sku_id);
      const from = s.stock[fromKey];
      if (!from || from.qty < input.qty) {
        return err<{ from: StockRow; to: StockRow }>(
          `Only ${from?.qty ?? 0} available at the source location.`,
          "out_of_stock"
        );
      }
      const to = (s.stock[toKey] ??= {
        location_id: input.to_location_id,
        sku_type: input.sku_type,
        sku_id: input.sku_id,
        qty: 0,
        par_level: 0,
      });
      from.qty -= input.qty;
      to.qty += input.qty;
      return ok({ from: { ...from }, to: { ...to } });
    });
  }

  // ── Catalogue ────────────────────────────────────────────────────────────

  async getCatalogue(): Promise<Result<Catalogue>> {
    await latency(120);
    return ok({ colors, fits, skus, designs, fetchedAt: now() });
  }

  async getKioskCatalogue(environmentId: string): Promise<Result<KioskDesign[]>> {
    await latency(120);
    const loc = locationForEnvironment(environmentId);
    if (!loc) return err(`This device is bound to an environment with no stock location.`, "not_found");

    const out: KioskDesign[] = [];
    for (const d of designs) {
      // Three filters, and all three matter. Inactive/hidden is an admin
      // decision. Null print dimensions would produce NaN geometry on the
      // canvas — a design without a real physical size cannot be placed at
      // true scale, so it must never reach the kiosk at all. And a design with
      // no cutout renders as a white box.
      if (!d.is_active || !d.kiosk_visible) continue;
      if (d.print_w_cm == null || d.print_h_cm == null) continue;
      if (!d.cutout_path) continue;

      const available = qtyAt(loc.id, "sticker", d.id) - activeHoldQty(d.id, environmentId);
      if (available <= 0) continue;

      out.push({ ...d, print_w_cm: d.print_w_cm, print_h_cm: d.print_h_cm, available_qty: available });
    }
    return ok(out);
  }

  // ── Templates ────────────────────────────────────────────────────────────

  async listTemplates(opts?: { includeInactive?: boolean }): Promise<Result<Template[]>> {
    await latency(60);
    const all = getState().templates;
    const visible = opts?.includeInactive ? all : all.filter((t) => t.is_active);
    // Filter-on-read rather than validate-on-write: an admin deactivating a
    // design must never be blocked, and a template referencing it should
    // degrade by disappearing rather than by failing when a customer opens it.
    const usable = visible.filter((t) =>
      t.payload.placements.every((p) => designs.some((d) => d.id === p.sticker_design_id && d.is_active))
    );
    return ok(usable.sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || b.times_used - a.times_used));
  }

  async saveTemplate(t: Partial<Template> & { name: string; payload: Template["payload"] }): Promise<Result<Template>> {
    await latency();
    return mutate((s) => {
      if (t.id) {
        const existing = s.templates.find((x) => x.id === t.id);
        if (!existing) return err<Template>("Template not found.", "not_found");
        Object.assign(existing, t);
        return ok(existing);
      }
      const created: Template = {
        id: uid("tpl"),
        name: t.name,
        slug: t.slug ?? t.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        blurb: t.blurb ?? null,
        payload: t.payload,
        preview_path: t.preview_path ?? null,
        is_featured: t.is_featured ?? false,
        is_active: t.is_active ?? true,
        sort: t.sort ?? 0,
        times_used: 0,
      };
      s.templates.push(created);
      return ok(created);
    });
  }

  async deleteTemplate(id: string): Promise<Result<void>> {
    await latency();
    return mutate((s) => {
      s.templates = s.templates.filter((t) => t.id !== id);
      return ok(undefined);
    });
  }

  async noteTemplateOpened(id: string): Promise<Result<void>> {
    return mutate((s) => {
      const t = s.templates.find((x) => x.id === id);
      if (t) t.times_used += 1;
      return ok(undefined);
    });
  }

  // ── Holds ────────────────────────────────────────────────────────────────

  async reserveSticker(input: {
    sticker_id: string;
    environment_id: string;
    session_id: string;
    qty: number;
  }): Promise<Result<Hold>> {
    await latency(70);
    const loc = locationForEnvironment(input.environment_id);
    if (!loc) return err("No stock location for this environment.", "not_found");

    return mutate((s) => {
      // The live version does this inside `select ... for update` on the design
      // row. Single-threaded JS gives the mock the same serialisation for free,
      // which is why the check-then-insert below is safe here and would NOT be
      // safe if this were the real implementation.
      const available = qtyAt(loc.id, "sticker", input.sticker_id) - activeHoldQty(input.sticker_id, input.environment_id);
      if (available < input.qty) {
        return err<Hold>("That transfer just went out of stock at this stall.", "out_of_stock");
      }
      const hold: Hold = {
        id: uid("hold"),
        sticker_id: input.sticker_id,
        product_sku_id: null,
        environment_id: input.environment_id,
        qty: input.qty,
        session_id: input.session_id,
        expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
        released_at: null,
        converted_order: null,
      };
      s.holds.push(hold);
      return ok(hold);
    });
  }

  async releaseHold(id: string): Promise<Result<void>> {
    return mutate((s) => {
      const h = s.holds.find((x) => x.id === id);
      if (h && !h.released_at) h.released_at = now();
      return ok(undefined);
    });
  }

  // ── Shift ────────────────────────────────────────────────────────────────

  async getShiftContext(environmentId: string, deviceId: string): Promise<Result<ShiftContext>> {
    await latency(60);
    const s = getState();
    const shift = s.shifts.find((x) => x.environment_id === environmentId && !x.closed_at) ?? null;
    const block = shift ? s.blocks.find((b) => b.shift_id === shift.id && b.device_id === deviceId && !b.closed_at) ?? null : null;
    return ok({ shift, block });
  }

  async openShift(input: {
    environment_id: string;
    device_id: string;
    name: string;
    type: Shift["type"];
    venue: string | null;
    press_on_site: boolean;
    opening_float: number;
  }): Promise<Result<ShiftContext>> {
    await latency();
    return mutate((s) => {
      // At most one open shift per environment, mirroring the live
      // `stall_one_open_shift` partial unique index. A second device opening
      // JOINS the existing shift rather than failing — the eighth-pass bug in
      // the old build was a joining device silently getting no receipt block
      // and being unable to charge, so the block allocation is unconditional.
      let shift = s.shifts.find((x) => x.environment_id === input.environment_id && !x.closed_at);
      if (!shift) {
        shift = {
          id: uid("shift"),
          name: input.name,
          event_name: null,
          type: input.type,
          venue: input.venue,
          environment_id: input.environment_id,
          shift_date: new Date().toISOString().slice(0, 10),
          press_on_site: input.press_on_site,
          opening_float: input.opening_float,
          counted_cash: null,
          expected_cash: null,
          variance: null,
          opened_at: now(),
          closed_at: null,
        };
        s.shifts.push(shift);
      }

      let block = s.blocks.find((b) => b.shift_id === shift!.id && b.device_id === input.device_id && !b.closed_at);
      if (!block) {
        const fy = currentFY();
        const env = s.environments.find((e) => e.id === input.environment_id);
        // Numbering is scoped per (environment, fy) so two stalls never collide
        // without needing runtime resolution — the prefix does the work.
        const scope = s.blocks.filter((b) => b.fy === fy && b.environment_id === input.environment_id);
        const start = scope.length ? Math.max(...scope.map((b) => b.end_no)) + 1 : 1;
        block = {
          id: uid("blk"),
          shift_id: shift.id,
          environment_id: input.environment_id,
          device_id: input.device_id,
          fy,
          start_no: start,
          end_no: start + 99,
          next_no: start,
          closed_at: null,
        };
        void env;
        s.blocks.push(block);
      }
      return ok({ shift, block });
    });
  }

  async closeShift(input: { shift_id: string; counted_cash: number }): Promise<Result<Shift>> {
    await latency();
    return mutate((s) => {
      const shift = s.shifts.find((x) => x.id === input.shift_id);
      if (!shift) return err<Shift>("Shift not found.", "not_found");
      const orders = s.orders.filter((o) => o.shift_id === shift.id && !o.voided_at);
      const expected =
        shift.opening_float +
        orders.reduce((n, o) => n + (o.payment_method === "cash" ? o.total : o.paid_cash), 0);
      shift.counted_cash = input.counted_cash;
      shift.expected_cash = expected;
      shift.variance = input.counted_cash - expected;
      shift.closed_at = now();
      for (const b of s.blocks) if (b.shift_id === shift.id) b.closed_at = now();
      return ok(shift);
    });
  }

  // ── Orders ───────────────────────────────────────────────────────────────

  async createOrder(input: CreateOrderInput): Promise<Result<Order>> {
    await latency(150);

    // Idempotency FIRST, before any guard or mutation. An outbox retry must
    // return the existing order, never charge a second time. This ordering is
    // the property the whole offline story rests on.
    const existing = getState().orders.find((o) => o.id === input.id);
    if (existing) return ok(existing);

    const env = getState().environments.find((e) => e.id === input.environment_id);
    if (!env) return err("This device is bound to an environment that no longer exists.", "not_found");
    if (!env.is_active) return err(`${env.name} has been closed. Rebind this device in Settings.`, "environment_closed");

    const loc = locationForEnvironment(input.environment_id);
    if (!loc) return err("No stock location for this environment.", "not_found");

    return mutate((s) => {
      // Tally everything the order consumes BEFORE decrementing anything, so a
      // shortfall on the last line cannot leave the first line's stock already
      // gone. This is the mock's stand-in for the transaction boundary in
      // `stall_create_order` — an out-of-stock line rolls back the whole order.
      const need = new Map<string, { type: "product" | "sticker"; id: string; qty: number; label: string }>();
      const bump = (type: "product" | "sticker", id: string, label: string) => {
        const k = `${type}|${id}`;
        const cur = need.get(k) ?? { type, id, qty: 0, label };
        cur.qty += 1;
        need.set(k, cur);
      };
      for (const d of input.designs) {
        const sku = skus.find((x) => x.id === d.product_sku_id);
        bump("product", d.product_sku_id, sku?.sku_code ?? "garment");
        for (const p of d.placements) bump("sticker", p.sticker_design_id, p.code);
      }

      for (const item of need.values()) {
        // Holds already carved out for THIS session's placements are not
        // competition with themselves — they convert rather than block.
        const held =
          item.type === "sticker"
            ? s.holds
                .filter(
                  (h) =>
                    h.sticker_id === item.id &&
                    h.environment_id === input.environment_id &&
                    !h.released_at &&
                    !h.converted_order &&
                    input.designs.some((d) => d.placements.some((p) => p.hold_id === h.id))
                )
                .reduce((n, h) => n + h.qty, 0)
            : 0;
        const otherHolds = item.type === "sticker" ? activeHoldQty(item.id, input.environment_id) - held : 0;
        const available = qtyAt(loc.id, item.type, item.id) - otherHolds;
        if (available < item.qty) {
          return err<Order>(
            `${item.label} is out of stock at ${env.name}. Nothing has been charged.`,
            "out_of_stock"
          );
        }
      }

      // Receipt number, consumed from this device's block.
      const block = s.blocks.find((b) => b.shift_id === input.shift_id && b.device_id === input.device_id && !b.closed_at);
      let receipt_no: string | null = null;
      if (input.channel === "stall") {
        if (!block) return err<Order>("No receipt numbers left on this device's block. Reopen the shift on this device.", "no_receipt_numbers");
        if (block.next_no > block.end_no) {
          return err<Order>("This device's receipt block is exhausted. Reopen the shift on this device.", "no_receipt_numbers");
        }
        receipt_no = formatReceiptNo(env.prefix, block.fy, block.next_no);
        block.next_no += 1;
      }

      // Commit stock.
      for (const item of need.values()) {
        s.stock[stockKey(loc.id, item.type, item.id)].qty -= item.qty;
      }

      const items: OrderItem[] = input.designs.map((d) => {
        const sku = skus.find((x) => x.id === d.product_sku_id);
        const color = colors.find((c) => c.id === sku?.color_id);
        const fit = fits.find((f) => f.id === sku?.fit_id);
        const stickers: OrderSticker[] = d.placements.map((p) => {
          const design = designs.find((x) => x.id === p.sticker_design_id);
          return {
            id: uid("ois"),
            sticker_design_id: p.sticker_design_id,
            custom_sticker_id: null,
            code: p.code,
            side: p.side,
            pos_x: p.pos_x,
            pos_y: p.pos_y,
            rotation: p.rotation,
            unit_price: p.unit_price,
            unit_cost: p.unit_cost,
            bin_location: design?.bin_location ?? null,
          };
        });
        const lineTotal = d.unit_price + stickers.reduce((n, x) => n + x.unit_price, 0);
        return {
          id: uid("oi"),
          product_sku_id: d.product_sku_id,
          sku_code: d.sku_code,
          size: sku?.size ?? null,
          color_name: color?.name ?? null,
          fit_name: fit?.name ?? null,
          qty: 1,
          unit_price: d.unit_price,
          unit_cost: d.unit_cost,
          line_total: lineTotal,
          stickers,
        };
      });

      const subtotal = items.reduce((n, i) => n + i.line_total, 0);
      const cost_total = items.reduce(
        (n, i) => n + i.unit_cost + i.stickers.reduce((m, x) => m + x.unit_cost, 0),
        0
      );

      s.seq[env.id] = (s.seq[env.id] ?? 0) + 1;

      const order: Order = {
        id: input.id,
        order_no: s.seq[env.id],
        receipt_no,
        shift_id: input.shift_id,
        environment_id: input.environment_id,
        channel: input.channel,
        design_ticket: null,
        customer_name: input.customer_name,
        customer_phone: input.customer_phone,
        subtotal,
        discount_amount: input.discount_amount,
        discount_reason: input.discount_reason,
        discount_note: input.discount_note,
        total: Math.max(0, subtotal - input.discount_amount),
        cost_total,
        manual_override: input.manual_override,
        payment_method: input.payment_method,
        paid_cash: input.paid_cash,
        paid_upi: input.paid_upi,
        payment_ref: null,
        fulfillment_status: "pending_press",
        promised_date: null,
        prepped_at: null,
        pressed_at: null,
        collected_at: null,
        affects_inventory: true,
        notes: input.notes ?? null,
        client_created_at: input.client_created_at,
        created_at: now(),
        device_id: input.device_id,
        voided_at: null,
        void_reason: null,
        items,
      };

      // Convert this session's holds rather than leaving them to expire — the
      // stock they were protecting has now actually moved.
      for (const h of s.holds) {
        if (input.designs.some((d) => d.placements.some((p) => p.hold_id === h.id))) h.converted_order = order.id;
      }

      s.orders.unshift(order);
      return ok(order);
    });
  }

  async listOrders(opts: { environment_id?: string; shift_id?: string; limit?: number }): Promise<Result<Order[]>> {
    await latency(80);
    let list = getState().orders;
    if (opts.environment_id) list = list.filter((o) => o.environment_id === opts.environment_id);
    if (opts.shift_id) list = list.filter((o) => o.shift_id === opts.shift_id);
    return ok(list.slice(0, opts.limit ?? 200));
  }

  async getOrder(id: string): Promise<Result<Order>> {
    await latency(50);
    const o = getState().orders.find((x) => x.id === id);
    return o ? ok(o) : err("Order not found.", "not_found");
  }

  /** Prep is where stock actually moves in the live design — but in this build
   *  stock is committed at order creation (see `createOrder`), because the
   *  kiosk order and the POS walk-up sale share one creation path and the
   *  walk-up sale is a completed transaction at that moment.
   *
   *  Migration 007 resolves this the other way for KIOSK orders specifically:
   *  a kiosk order holds rather than decrements, and `stall_prep_order` moves
   *  the stock. When that lands, this method gains the decrement and can
   *  refuse; the signature already returns Result so no caller changes. */
  async markPrepped(id: string, actor: string): Promise<Result<Order>> {
    await latency();
    return this.stamp(id, "prepped_at", actor, (o) => {
      if (o.prepped_at) return "This ticket is already prepped.";
      return null;
    });
  }

  async markPrinted(id: string, actor: string): Promise<Result<Order>> {
    await latency();
    return this.stamp(id, "pressed_at", actor, (o) => {
      if (!o.prepped_at) return "Pull the stickers and mark this prepped first.";
      if (o.pressed_at) return "This ticket is already printed.";
      return null;
    });
  }

  async markHandedOver(id: string, actor: string): Promise<Result<Order>> {
    await latency();
    return this.stamp(id, "collected_at", actor, (o) => {
      if (!o.pressed_at) return "Press this ticket before handing it over.";
      if (o.collected_at) return "This ticket is already handed over.";
      return null;
    });
  }

  private stamp(
    id: string,
    field: "prepped_at" | "pressed_at" | "collected_at",
    actor: string,
    guard: (o: Order) => string | null
  ): Result<Order> {
    void actor;
    return mutate((s) => {
      const o = s.orders.find((x) => x.id === id);
      if (!o) return err<Order>("Order not found.", "not_found");
      if (o.voided_at) return err<Order>("This order was voided.", "conflict");
      const problem = guard(o);
      // A guarded no-op, not an error the volunteer has to think about: a
      // double-tap in a queue must be harmless.
      if (problem) return err<Order>(problem, "conflict");
      o[field] = now();
      if (field === "collected_at") o.fulfillment_status = "handed_over";
      else if (field === "prepped_at") o.fulfillment_status = "prepped";
      return ok(o);
    });
  }

  async voidOrder(id: string, reason: string, actor: string): Promise<Result<Order>> {
    await latency();
    void actor;
    return mutate((s) => {
      const o = s.orders.find((x) => x.id === id);
      if (!o) return err<Order>("Order not found.", "not_found");
      if (o.voided_at) return err<Order>("This order is already void.", "conflict");
      const loc = locationForEnvironment(o.environment_id);
      // Restock returns to the location the order drew from, not the
      // warehouse — otherwise a void quietly moves stock between stalls.
      if (loc) {
        for (const i of o.items) {
          if (i.product_sku_id) s.stock[stockKey(loc.id, "product", i.product_sku_id)].qty += i.qty;
          for (const st of i.stickers) {
            if (st.sticker_design_id) s.stock[stockKey(loc.id, "sticker", st.sticker_design_id)].qty += 1;
          }
        }
      }
      o.voided_at = now();
      o.void_reason = reason;
      return ok(o);
    });
  }

  // ── Analytics ────────────────────────────────────────────────────────────

  async getAnalytics(opts: { environment_id?: string; from?: string; to?: string }): Promise<Result<AnalyticsSummary>> {
    await latency(140);
    const s = getState();
    let list = s.orders.filter((o) => !o.voided_at);
    if (opts.environment_id) list = list.filter((o) => o.environment_id === opts.environment_id);
    // Report on client_created_at, not created_at — they differ by hours on an
    // offline sale, and the volunteer charged at the former.
    if (opts.from) list = list.filter((o) => o.client_created_at >= opts.from!);
    if (opts.to) list = list.filter((o) => o.client_created_at <= opts.to!);

    const gross = list.reduce((n, o) => n + o.total, 0);
    const cogs = list.reduce((n, o) => n + o.cost_total, 0);

    const byEnv = s.environments.map((e) => {
      const sub = list.filter((o) => o.environment_id === e.id);
      return {
        environment_id: e.id,
        name: e.name,
        gross: sub.reduce((n, o) => n + o.total, 0),
        raised: sub.reduce((n, o) => n + (o.total - o.cost_total), 0),
        orders: sub.length,
      };
    });

    const tally = new Map<string, number>();
    for (const o of list) for (const i of o.items) for (const st of i.stickers) tally.set(st.code, (tally.get(st.code) ?? 0) + 1);

    return ok({
      gross,
      discounts: list.reduce((n, o) => n + o.discount_amount, 0),
      cogs,
      raisedForAquaterra: gross - cogs,
      orders: list.length,
      units: list.reduce((n, o) => n + o.items.length, 0),
      byEnvironment: byEnv.filter((e) => e.orders > 0),
      topDesigns: [...tally.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([code, units]) => ({ code, name: designs.find((d) => d.code === code)?.name ?? code, units })),
    });
  }

  async getInteractionAnalytics(opts: { environment_id?: string }): Promise<Result<InteractionAnalytics>> {
    await latency(140);
    const s = getState();
    let ev = s.events;
    if (opts.environment_id) ev = ev.filter((e) => e.environment_id === opts.environment_id);

    const sessions = new Set(ev.map((e) => e.session_id));
    const completed = new Set(ev.filter((e) => e.event === "order_completed").map((e) => e.session_id));

    const stageOrder = ["storefront", "canvas", "order", "done"];
    const funnel = stageOrder.map((stage) => ({
      stage,
      sessions: new Set(ev.filter((e) => e.event === "stage_entered" && e.detail?.stage === stage).map((e) => e.session_id)).size,
    }));

    const picks = new Map<string, number>();
    for (const e of ev) if (e.event === "sticker_placed" && typeof e.detail?.code === "string") picks.set(e.detail.code, (picks.get(e.detail.code) ?? 0) + 1);

    const opens = new Map<string, number>();
    for (const e of ev) if (e.event === "template_opened" && typeof e.detail?.name === "string") opens.set(e.detail.name, (opens.get(e.detail.name) ?? 0) + 1);

    return ok({
      sessions: sessions.size,
      completed: completed.size,
      abandoned: sessions.size - completed.size,
      funnel,
      topPicked: [...picks.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([code, p]) => ({ code, name: designs.find((d) => d.code === code)?.name ?? code, picks: p })),
      topTemplates: [...opens.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, o]) => ({ name, opens: o, conversions: 0 })),
      overlapBlocks: ev.filter((e) => e.event === "overlap_blocked").length,
    });
  }

  async logEvents(events: KioskEvent[]): Promise<Result<void>> {
    if (!events.length) return ok(undefined);
    return mutate((s) => {
      s.events.push(...events);
      // Retention, enforced client-side here because this repo has no
      // scheduled-job infrastructure at all (see Known Issues #2). The live
      // version needs a real purge — see requirements doc, open question 5.
      if (s.events.length > 5000) s.events = s.events.slice(-5000);
      return ok(undefined);
    });
  }

  // ── Settings ─────────────────────────────────────────────────────────────

  async getSettings(): Promise<Result<Record<string, unknown>>> {
    await latency(30);
    return ok({ ...getState().settings });
  }

  async setSetting(key: string, value: unknown): Promise<Result<void>> {
    await latency();
    return mutate((s) => {
      s.settings[key] = value;
      return ok(undefined);
    });
  }

  subscribeOrders(environmentId: string, cb: (o: Order) => void): () => void {
    let seen = new Set(getState().orders.map((o) => o.id));
    return subscribe(() => {
      const orders = getState().orders.filter((o) => o.environment_id === environmentId);
      for (const o of orders) if (!seen.has(o.id)) cb(o);
      seen = new Set(getState().orders.map((o) => o.id));
    });
  }
}
