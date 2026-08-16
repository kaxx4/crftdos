"use client";

/** THE TICKET.
 *
 *  Its job is to answer, without anyone having to ask a volunteer: what did I
 *  just order, what do I show them, and when do I come back. A code alone is
 *  necessary and is not an answer, so the code sits with the three steps that
 *  follow it.
 *
 *  The screen resets itself. A kiosk left on the last customer's name and
 *  phone number is both a privacy problem and a queue problem — but the
 *  countdown is visible and cancellable by touching anything, because nobody
 *  should be hurried off a screen they are still reading.
 *
 *  Colour budget: ACID (paid/complete — the hero) + COBALT (the one action). */

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button, Heading, PosScreen, Sticker, Text, TicketStub } from "@/components/ui";
import { useKiosk } from "../_lib/session";
import { ticketCode, useStageGuard } from "../_lib/util";
import { money } from "@/lib/money";

const RESET_SECONDS = 90;

export default function KioskDonePage() {
  const { order, environment, startOver } = useKiosk();
  useStageGuard(Boolean(order), "/kiosk");

  const [qr, setQr] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(RESET_SECONDS);

  const orderId = order?.id ?? null;

  useEffect(() => {
    if (!orderId) return;
    let alive = true;
    QRCode.toDataURL(`crftd:o:${orderId}`, { width: 512, margin: 1 })
      .then((url) => alive && setQr(url))
      .catch(() => alive && setQr(null));
    return () => {
      alive = false;
    };
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;
    const tick = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    const reset = setTimeout(() => void startOver(), RESET_SECONDS * 1000);
    return () => {
      clearInterval(tick);
      clearTimeout(reset);
    };
  }, [orderId, startOver]);

  if (!order) return null;

  const code = ticketCode(order.id);
  const firstName = order.customer_name?.split(" ")[0];

  const steps = [
    "A volunteer pulls your transfers out of the box.",
    "They press them onto your tee — a couple of minutes.",
    "They call your name. You pay at the counter and take it home.",
  ];

  return (
    <PosScreen className="min-h-dvh bg-[var(--color-paper)]">
      <PosScreen.Body className="p-[var(--space-5)]">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-[var(--space-5)]">
          {/* One physical object, not two cards: the acid hero and the
              instructions are two acts of the SAME ticket, torn apart at a
              die-cut seam — the structure the reference confirmations use,
              kept to our own acid + cobalt budget. */}
          <TicketStub className="relative animate-pop">
            {/* The one sticker this screen earns: a small "fresh off the
                press" beat that peeks off the ticket's own corner, the same
                frame-breaking move the attract and start screens already
                use. White stays legal on the acid section and doesn't add a
                third block colour. */}
            <span className="absolute -top-3 -right-2 z-10 hidden rotate-6 sm:block">
              <Sticker tone="white" tilt="r">
                ★ fresh off the press
              </Sticker>
            </span>
            <TicketStub.Section tone="acid" className="text-center">
              <p className="t-label">Order placed</p>
              <Heading level={1} step="xxl" className="mt-[var(--space-2)]">
                Thanks{firstName ? `, ${firstName}` : ""}.
              </Heading>
              <Text step="md" className="mx-auto mt-[var(--space-2)] max-w-[46ch]">
                Show this code at the counter when your name is called.
              </Text>
              <p className="mt-[var(--space-4)] font-[family-name:var(--font-mono)] tnum t-mega tracking-[0.12em]">
                {code}
              </p>
              {qr && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qr}
                  alt={`QR code for order ${code}`}
                  className="mx-auto mt-[var(--space-4)] size-44 rounded-[var(--radius-md)] border-[3px] border-[var(--color-ink)] bg-white"
                />
              )}
              <p className="mt-[var(--space-4)] font-[family-name:var(--font-mono)] tnum t-base">
                {environment?.prefix ? `${environment.prefix} · ` : ""}
                {money(order.total)} · pay at the counter
              </p>
            </TicketStub.Section>

            <TicketStub.Divider />

            <TicketStub.Section>
              <p className="t-label text-[var(--color-muted)]">What happens now</p>
              <ol className="mt-[var(--space-3)] flex flex-col gap-[var(--space-3)]">
                {steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-[var(--space-3)]">
                    <span className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-pill)] border-2 border-[var(--color-ink)] bg-white font-[family-name:var(--font-mono)] tnum t-sm font-bold">
                      {i + 1}
                    </span>
                    <span className="t-base">{s}</span>
                  </li>
                ))}
              </ol>
            </TicketStub.Section>
          </TicketStub>

          <Text step="base" muted>
            Can&apos;t remember the code later? A volunteer can find your order by your name.
          </Text>
        </div>
      </PosScreen.Body>

      <PosScreen.Foot className="p-[var(--space-4)]">
        <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-[var(--space-3)]">
          <Text step="base" className="text-white/80">
            Back to the start in <span className="font-[family-name:var(--font-mono)] tnum">{seconds}s</span>
          </Text>
          <Button surface="kiosk" size="lg" variant="primary" onClick={() => void startOver()}>
            Done — next person
          </Button>
        </div>
      </PosScreen.Foot>
    </PosScreen>
  );
}
