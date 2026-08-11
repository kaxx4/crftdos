/** Shared kiosk types, moved verbatim out of the monolithic page. */

export type Color = { id: string; name: string };
export type Fit = { id: string; name: string };

export type Sku = {
  id: string;
  color_id: string;
  fit_id: string;
  size: string;
  sku_code: string;
  unit_price: number;
  unit_cost: number;
  stock_qty: number;
  mockup_front: string;
  mockup_back: string;
  print_area: {
    front: { x: number; y: number; w: number; h: number; cm_w: number; cm_h: number };
    back: { x: number; y: number; w: number; h: number; cm_w: number; cm_h: number };
  };
};

export type Design = {
  id: string;
  code: string;
  name: string;
  size_class: "S" | "M" | "L";
  unit_price: number;
  unit_cost: number;
  print_w_cm: number;
  print_h_cm: number;
  cutout_path: string;
  available_qty: number;
  tags: string[];
};

export type Preset = {
  id: string;
  name: string;
  payload: {
    product_sku_id?: string;
    placements?: {
      sticker_design_id: string;
      code: string;
      unit_price: number;
      unit_cost: number;
      pos_x: number;
      pos_y: number;
      rotation: number;
    }[];
  };
};

export type Placement = {
  key: string;
  sticker_design_id: string;
  code: string;
  print_w_cm: number;
  print_h_cm: number;
  unit_price: number;
  unit_cost: number;
  side: "front" | "back";
  xPct: number;
  yPct: number;
  rotation: number;
  holdId: string;
};

/** A candidate placement being tested before it is committed. */
export type PlacementTrial = {
  xPct: number;
  yPct: number;
  print_w_cm: number;
  print_h_cm: number;
  rotation?: number;
};

export type PrintArea = Sku["print_area"]["front"];

export type Stage = "attract" | "path" | "product" | "canvas" | "ticket";

export const IMG_W = 400;
export const IMG_H = 500;
