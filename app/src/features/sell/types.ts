import type { ReceiptBlock, Shift } from "@/lib/types";

export type CartSticker = {
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

export type CartGarment = {
  key: string;
  product_sku_id: string;
  label: string;
  stockNote: string;
  unit_price: number;
  unit_cost: number;
  stickers: CartSticker[];
};

export type CartStandaloneSticker = CartSticker & { kind: "standalone" };

export type PaymentMethod = "upi" | "cash" | "split" | "pending";

export type UndoSnapshot = {
  garments: CartGarment[];
  standalone: CartStandaloneSticker[];
  discountAmt: string;
  discountPct: string;
  payment: PaymentMethod;
  cashAmt: string;
  upiAmt: string;
};

export type { Shift, ReceiptBlock };
