"use client";
import { Mono } from "@/components/ui";
import type { Order } from "../types";

export function OrderList({ orders, onVoid }: { orders: Order[]; onVoid: (o: Order) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {orders.map((o) => (
        <div key={o.id} className="border-2 border-ink bg-white p-2.5 flex justify-between gap-2">
          <div>
            <div className="font-extrabold text-[16px]">{o.receipt_no}</div>
            <Mono>
              {new Date(o.created_at).toLocaleTimeString("en-IN")} · {o.payment_method.toUpperCase()}
            </Mono>
          </div>
          <div className="text-right flex flex-col items-end gap-1">
            <div className="font-extrabold text-lg">₹{o.total}</div>
            {o.voided_at ? (
              <span className="text-[12px] font-extrabold text-signal">VOID</span>
            ) : (
              <button
                onClick={() => onVoid(o)}
                className="tap-target min-w-[48px] inline-flex items-center justify-center border border-signal text-signal text-[12px] font-extrabold px-1.5 py-1"
              >
                VOID
              </button>
            )}
          </div>
        </div>
      ))}
      {orders.length === 0 && (
        <div className="text-center text-sm text-muted py-6">No orders yet this shift.</div>
      )}
    </div>
  );
}
