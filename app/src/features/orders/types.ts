import type { PressOrder } from "@/components/PressQueue";

export type Summary = {
  shift: { name: string; venue: string };
  gross: number;
  discounts: number;
  net: number;
  raisedForAquaterra: number;
  unitsSold: number;
  topDesigns: { code: string; count: number }[];
  cashVariance: number | null;
};

export type Order = PressOrder & {
  total: number;
  payment_method: string;
  fulfillment_status: string;
  voided_at: string | null;
  collected_at: string | null;
  customer_id: string | null;
};
