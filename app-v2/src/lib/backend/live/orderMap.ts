/** Maps a Supabase row (joined) for `stall_orders` into the domain `Order`
 *  type. Lives outside route files so it has exactly one definition, but it
 *  intentionally takes `any`-ish loosely-typed rows rather than importing
 *  Supabase types — this file has no Supabase import itself, only the shape
 *  the joined `select()` in the order routes must produce. */

import type { Fulfillment, Order, OrderItem, OrderSticker, PaymentMethod, DiscountReason, OrderChannel, PrintSide } from "../../domain/types";

export type OrderRow = {
  id: string;
  order_no: number;
  receipt_no: string | null;
  shift_id: string | null;
  environment_id: string;
  channel: string;
  design_ticket: string | null;
  subtotal: number;
  discount_amount: number;
  discount_reason: string | null;
  discount_note: string | null;
  total: number;
  cost_total: number;
  manual_override: boolean;
  payment_method: string;
  paid_cash: number | null;
  paid_upi: number | null;
  payment_ref: string | null;
  fulfillment_status: string;
  promised_date: string | null;
  prepped_at: string | null;
  pressed_at: string | null;
  collected_at: string | null;
  affects_inventory: boolean;
  notes: string | null;
  client_created_at: string | null;
  created_at: string;
  device_id: string | null;
  voided_at: string | null;
  void_reason: string | null;
  customer?: { name: string | null; phone_e164: string | null } | { name: string | null; phone_e164: string | null }[] | null;
  items?: OrderItemRow[] | null;
};

type OrderItemRow = {
  id: string;
  product_sku_id: string | null;
  qty: number;
  unit_price: number;
  unit_cost: number;
  line_total: number;
  sku?:
    | { sku_code: string | null; size: string | null; color?: { name: string } | { name: string }[] | null; fit?: { name: string } | { name: string }[] | null }
    | { sku_code: string | null; size: string | null; color?: { name: string } | { name: string }[] | null; fit?: { name: string } | { name: string }[] | null }[]
    | null;
  stickers?: OrderStickerRow[] | null;
};

type OrderStickerRow = {
  id: string;
  sticker_design_id: string | null;
  custom_sticker_id: string | null;
  side: string | null;
  pos_x: number | null;
  pos_y: number | null;
  rotation: number | null;
  unit_price: number;
  unit_cost: number;
  design?: { code: string; bin_location: string | null } | { code: string; bin_location: string | null }[] | null;
  custom?: { code: string } | { code: string }[] | null;
};

function one<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export function mapOrderRow(row: OrderRow): Order {
  const customer = one(row.customer);
  const items: OrderItem[] = (row.items ?? []).map((it) => {
    const sku = one(it.sku);
    const color = sku ? one(sku.color) : null;
    const fit = sku ? one(sku.fit) : null;
    const stickers: OrderSticker[] = (it.stickers ?? []).map((st): OrderSticker => {
      const design = one(st.design);
      const custom = one(st.custom);
      return {
        id: st.id,
        sticker_design_id: st.sticker_design_id,
        custom_sticker_id: st.custom_sticker_id,
        code: design?.code ?? custom?.code ?? "",
        side: (st.side ?? "front") as PrintSide,
        pos_x: st.pos_x,
        pos_y: st.pos_y,
        rotation: st.rotation,
        unit_price: Number(st.unit_price),
        unit_cost: Number(st.unit_cost),
        bin_location: design?.bin_location ?? null,
      };
    });
    return {
      id: it.id,
      product_sku_id: it.product_sku_id,
      sku_code: sku?.sku_code ?? null,
      size: (sku?.size ?? null) as OrderItem["size"],
      color_name: color?.name ?? null,
      fit_name: fit?.name ?? null,
      qty: it.qty,
      unit_price: Number(it.unit_price),
      unit_cost: Number(it.unit_cost),
      line_total: Number(it.line_total),
      stickers,
    };
  });

  return {
    id: row.id,
    order_no: row.order_no,
    receipt_no: row.receipt_no,
    shift_id: row.shift_id,
    environment_id: row.environment_id,
    channel: row.channel as OrderChannel,
    design_ticket: row.design_ticket,
    customer_name: customer?.name ?? null,
    customer_phone: customer?.phone_e164 ?? null,
    subtotal: Number(row.subtotal),
    discount_amount: Number(row.discount_amount),
    discount_reason: row.discount_reason as DiscountReason | null,
    discount_note: row.discount_note,
    total: Number(row.total),
    cost_total: Number(row.cost_total),
    manual_override: row.manual_override,
    payment_method: row.payment_method as PaymentMethod,
    paid_cash: Number(row.paid_cash ?? 0),
    paid_upi: Number(row.paid_upi ?? 0),
    payment_ref: row.payment_ref,
    fulfillment_status: row.fulfillment_status as Fulfillment,
    promised_date: row.promised_date,
    prepped_at: row.prepped_at,
    pressed_at: row.pressed_at,
    collected_at: row.collected_at,
    affects_inventory: row.affects_inventory,
    notes: row.notes,
    client_created_at: row.client_created_at ?? row.created_at,
    created_at: row.created_at,
    device_id: row.device_id,
    voided_at: row.voided_at,
    void_reason: row.void_reason,
    items,
  };
}

export const ORDER_SELECT = `
  *,
  customer:stall_customers(name, phone_e164),
  items:stall_order_items(
    *,
    sku:stall_product_skus(sku_code, size, color:stall_colors(name), fit:stall_fits(name)),
    stickers:stall_order_item_stickers(
      *,
      design:stall_sticker_designs(code, bin_location),
      custom:stall_custom_stickers(code)
    )
  )
`;
