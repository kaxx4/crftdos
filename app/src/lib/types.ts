export type Color = { id: string; name: string; hex: string | null; sort: number; is_active: boolean };
export type Fit = { id: string; name: string; applies_to: string; sort: number; is_active: boolean };
export type ProductSku = {
  id: string;
  product_type: string;
  color_id: string;
  fit_id: string;
  size: string;
  sku_code: string;
  stock_qty: number;
  par_level: number;
  unit_cost: number;
  unit_price: number;
  is_active: boolean;
};
export type StickerDesign = {
  id: string;
  code: string;
  size_class: "S" | "M" | "L";
  name: string | null;
  tags: string[];
  stock_qty: number;
  bin_location: string | null;
  unit_price: number;
  unit_cost: number;
  is_active: boolean;
  kiosk_visible: boolean;
};
export type Shift = {
  id: string;
  name: string;
  venue: string | null;
  event_name: string | null;
  press_on_site: boolean;
  opened_at: string;
  closed_at: string | null;
};
export type ReceiptBlock = {
  id: string;
  shift_id: string;
  device_id: string;
  fy: string;
  start_no: number;
  end_no: number;
  next_no: number;
  closed_at: string | null;
};

export type CartGarment = {
  key: string;
  product_sku_id: string;
  label: string; // "Black · Oversized · M"
  unit_price: number;
  unit_cost: number;
  stickers: CartStickerEntry[];
};

export type CartStickerLine = {
  key: string;
  sticker_design_id?: string;
  custom: { size_class: "S" | "M" | "L"; description: string } | null;
  code: string;
  unit_price: number;
  unit_cost: number;
};

export type CartStickerEntry = CartStickerLine;
