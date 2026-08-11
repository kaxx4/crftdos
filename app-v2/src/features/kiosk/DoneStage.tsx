"use client";

/** The ticket.
 *
 *  Its job is to answer, without anyone having to ask a volunteer: what did I
 *  just buy, what do I show them, and when do I come back. The old kiosk ended
 *  on a code and a QR; the number is necessary but it is not an answer.
 *
 *  The code alphabet excludes O/0 and I/1 on purpose — a volunteer reads this
 *  off a customer's screen at arm's length across a counter, and those are the
 *  two pairs that get misread. */

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { Environment, Order } from "@/lib/domain/types";
import { money } from "@/lib/money";
import { Button, Panel } from "@/components/ui";

/** 32 symbols, no O/0, no I/1. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function ticketCode(seed: string): string {
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += ALPHABET[seed.charCodeAt(i * 3 + 1) % ALPHABET.length];
  }
  return out;
}

export function DoneStage({
  order,
  environment,
  onFinish,
}: {
  order: Order;
  environment: Environment;
  onFinish: () => void;
}) {
  const code = ticketCode(order.id.replace(/-/g, ""));
  const [qr, setQr] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(90);

  useEffect(() => {
    QRCode.toDataURL(`crftd:o:${order.id}`, { width: 512, margin: 1 }).then(setQr).catch(() => setQr(null));
  }, [order.id]);

  // The kiosk returns itself to the storefront so the next customer meets a
  // fresh screen rather than the previous person's name and phone number.
  // Generous, and always cancellable — nobody should be rushed off a screen
  // they are still reading.
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => (s <= 1 ? (onFinish(), 0) : s - 1)), 1000);
    return () => clearInterval(t);
  }, [onFinish]);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <div className="animate-pop text-center">
        <p className="font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-[0.24em] text-[var(--color-blue)]">
          Order placed
        </p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight">
          Thanks{order.customer_name ? `, ${order.customer_name.split(" ")[0]}` : ""}.
        </h1>
        <p className="mt-2 text-lg text-[var(--color-muted)]">
          Show this to a volunteer at the counter when they call your name.
        </p>
      </div>

      <Panel className="text-center">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">Your ticket</p>
        <p className="my-2 font-[family-name:var(--font-mono)] text-6xl font-bold tracking-[0.15em]">{code}</p>
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt={`QR code for ticket ${code}`} className="mx-auto size-44 rounded-lg" />
        )}
        <p className="mt-3 font-[family-name:var(--font-mono)] text-sm text-[var(--color-muted)]">
          {environment.prefix} · {money(order.total)} ·{" "}
          {order.payment_method === "upi" ? "paid by UPI" : "pay at collection"}
        </p>
      </Panel>

      <Panel title="What happens now">
        <ol className="flex flex-col gap-3 text-sm">
          {[
            "A volunteer pulls your transfers from the box.",
            "They press them onto your tee — it takes a couple of minutes.",
            order.payment_method === "cash"
              ? "You pay and collect at the counter."
              : "You collect at the counter. Have your payment screen ready.",
          ].map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--color-blue)] font-[family-name:var(--font-mono)] text-xs font-bold text-white">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </Panel>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-muted)]">
          Returning to the start in <span className="font-[family-name:var(--font-mono)] tnum">{seconds}s</span>
        </p>
        <Button surface="kiosk" variant="secondary" onClick={onFinish}>
          Done — next customer
        </Button>
      </div>
    </main>
  );
}
