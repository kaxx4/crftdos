"use client";
import { BigButton, Mono, PanelLabel } from "./ui";

export type CollectOrder = {
  id: string;
  receipt_no: string;
  promised_date: string | null;
  customer_id: string | null;
};

/** The collect-later Collections tab (PRD §3.2): orders grouped by promised
 *  date, oldest date first, with one-tap Collected. */
export function Collections({
  orders,
  onCollect,
  busyId,
}: {
  orders: CollectOrder[];
  onCollect: (id: string) => void;
  busyId?: string | null;
}) {
  if (!orders.length) {
    return <div className="text-center text-sm text-muted py-6">No collections pending.</div>;
  }

  const groups = new Map<string, CollectOrder[]>();
  for (const o of orders) {
    const key = o.promised_date ?? "No date given";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(o);
  }
  const dates = [...groups.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  return (
    <section className="flex flex-col gap-2.5" aria-label="Collections">
      {dates.map((date) => (
        <div key={date} className="flex flex-col gap-1.5">
          <PanelLabel color="var(--color-blue)">
            {date === "No date given" ? date : new Date(date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
            {" · "}
            {groups.get(date)!.length}
          </PanelLabel>
          {groups.get(date)!.map((o) => (
            <div key={o.id} className="border-2 border-ink bg-white p-2.5 flex justify-between items-center gap-2">
              <div>
                <div className="font-extrabold text-[16px]">{o.receipt_no}</div>
                <Mono>{o.customer_id ? "customer on file" : "no contact on file"}</Mono>
              </div>
              <BigButton
                variant="blue"
                className="min-w-[140px]"
                disabled={busyId === o.id + "collect"}
                onClick={() => onCollect(o.id)}
              >
                COLLECTED
              </BigButton>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
