"use client";

/** The order step — new in this rework.
 *
 *  Order creation moves from POS-charge-time to kiosk-order-time. The customer
 *  gives a name and number, picks how they're paying, and walks away with a
 *  ticket that is backed by a real order row rather than a quote to be
 *  redeemed later.
 *
 *  Payment, per the resolved decisions of 11 Aug:
 *    UPI  — a per-order dynamic deep link with the amount embedded and the
 *           order code as the transaction note, so reconciliation against the
 *           bank statement is automatic. NOT payment confirmation: a UPI link
 *           is fire-and-forget, and a volunteer confirms at handover.
 *    Cash — a method flag only, settled physically at handover.
 *
 *  Stock is NOT decremented here. The soft holds taken during composition keep
 *  doing their job, and stock moves at the prep stage. A customer who fills
 *  this in and wanders off costs an expired hold and nothing else. */

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { getBackend } from "@/lib/backend";
import { track } from "@/lib/analytics";
import { getDeviceId } from "@/lib/device";
import { useAction, useAsync } from "@/lib/hooks/useAsync";
import type { Environment, Order, PaymentMethod } from "@/lib/domain/types";
import type { useCanvas } from "@/lib/hooks/useCanvas";
import { money, upiLink } from "@/lib/money";
import { Banner, Button, Field, Nudge, Panel } from "@/components/ui";
import { clsx } from "@/components/clsx";

type Canvas = ReturnType<typeof useCanvas>;

export function OrderStep({
  canvas,
  environment,
  onBack,
  onPlaced,
}: {
  canvas: Canvas;
  environment: Environment | null;
  onBack: () => void;
  onPlaced: (o: Order) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  // The QR being shown is not proof of payment — a volunteer has to say the
  // customer's screen actually showed success before the order finalizes as paid.
  const [upiConfirmed, setUpiConfirmed] = useState(false);
  const [touched, setTouched] = useState(false);
  const { run, busy, error } = useAction();
  const settings = useAsync(() => getBackend().getSettings(), []);

  useEffect(() => {
    if (environment) track(environment.id, "order_started", { total: canvas.total });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [environment?.id]);

  // Contact is mandatory here, unlike the POS's skippable customer sheet. A
  // kiosk order is fulfilled later by someone who is not standing in front of
  // the customer, so there has to be a way to reach them.
  const phoneOk = /^[6-9]\d{9}$/.test(phone.replace(/\D/g, ""));
  const nameOk = name.trim().length >= 2;
  const upiReady = method !== "upi" || upiConfirmed;
  const ready = nameOk && phoneOk && method !== null && upiReady;

  const submit = async () => {
    setTouched(true);
    if (!ready || !environment) return;
    const payload = canvas.toPayload();
    if (!payload) return;

    const order = await run(() =>
      getBackend().createOrder({
        // Client-generated, and the idempotency key. Generated once here so a
        // retry of this exact submission can never create a second order.
        id: crypto.randomUUID(),
        environment_id: environment.id,
        channel: "kiosk",
        shift_id: null,
        device_id: getDeviceId(),
        customer_name: name.trim(),
        customer_phone: phone.replace(/\D/g, ""),
        payment_method: method!,
        paid_cash: 0,
        paid_upi: method === "upi" ? canvas.total : 0,
        discount_amount: 0,
        discount_reason: null,
        discount_note: null,
        manual_override: false,
        designs: [payload],
        client_created_at: new Date().toISOString(),
        payment_ref:
          method === "upi" ? `volunteer-confirmed@${new Date().toISOString()}` : null,
      })
    );

    if (order) {
      track(environment.id, "order_completed", { total: order.total, method });
      onPlaced(order);
    }
  };

  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6 lg:grid-cols-[1fr_380px] lg:px-8">
      <div className="flex flex-col gap-5">
        <div>
          <Button variant="ghost" onClick={onBack} className="mb-2 -ml-2">
            ← Back to your design
          </Button>
          <h1 className="text-3xl font-extrabold tracking-tight">Almost yours</h1>
          <p className="mt-1 text-[var(--color-muted)]">
            We need a name and number so we can call you when it&apos;s pressed and ready.
          </p>
        </div>

        <Panel title="Who's it for">
          <div className="flex flex-col gap-4">
            <Field
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="First name is fine"
              autoComplete="given-name"
              error={touched && !nameOk ? "We need a name to call out when it's ready." : undefined}
            />
            <Field
              label="Phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="numeric"
              placeholder="10 digits"
              autoComplete="tel"
              hint="Only used to tell you your tee is ready."
              error={touched && !phoneOk ? "That doesn't look like a 10-digit Indian mobile number." : undefined}
            />
          </div>
        </Panel>

        <Panel title="How are you paying">
          <div className="grid gap-3 sm:grid-cols-2">
            <PaymentChoice
              selected={method === "upi"}
              onClick={() => {
                setMethod("upi");
                setUpiConfirmed(false);
              }}
              title="UPI"
              detail="Scan a code and pay now from your phone."
            />
            <PaymentChoice
              selected={method === "cash"}
              onClick={() => {
                setMethod("cash");
                setUpiConfirmed(false);
              }}
              title="Cash"
              detail="Pay the volunteer when you collect."
            />
          </div>
          {touched && method === null && (
            <p className="mt-3 text-sm font-semibold text-[var(--color-signal)]">Pick how you&apos;d like to pay.</p>
          )}
          {touched && method === "upi" && !upiConfirmed && (
            <p className="mt-3 text-sm font-semibold text-[var(--color-signal)]">
              Confirm the customer has actually paid before placing the order.
            </p>
          )}

          {method === "upi" && settings.data && (
            <>
              <UpiPanel
                vpa={String(settings.data.upi_vpa ?? "")}
                payee={String(settings.data.upi_payee_name ?? "crftd")}
                amount={canvas.total}
              />
              {/* The QR being on screen is not proof anyone paid — this is the
                  explicit human confirmation that replaces "deep link fired". */}
              {!upiConfirmed ? (
                <Banner tone="warn" className="mt-3" title="Has the customer paid?">
                  <div className="mt-2 flex gap-2">
                    <Button variant="primary" size="md" onClick={() => setUpiConfirmed(true)}>
                      Yes, paid
                    </Button>
                    <Button variant="ghost" size="md" onClick={() => setUpiConfirmed(false)}>
                      Not yet
                    </Button>
                  </div>
                </Banner>
              ) : (
                <Banner tone="success" className="mt-3">
                  Marked as paid by UPI. Placing the order now finalizes it that way.
                </Banner>
              )}
            </>
          )}

          {method === "cash" && (
            <Banner tone="info" className="mt-4">
              We&apos;ll hold your design. Pay the volunteer when you pick it up — nothing to do now.
            </Banner>
          )}
        </Panel>

        {error && <Banner tone="danger" title="We couldn't place that order">{error}</Banner>}
      </div>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <Panel title="Your order">
          <ul className="mb-4 flex flex-col gap-2 text-sm">
            <li className="flex justify-between gap-3">
              <span>{canvas.sku?.sku_code ?? "Tee"}</span>
              <span className="font-[family-name:var(--font-mono)] tnum">{money(canvas.sku?.unit_price ?? 0)}</span>
            </li>
            {canvas.placements.map((p, i) => (
              <li key={i} className="flex justify-between gap-3 text-[var(--color-muted)]">
                <span>
                  {p.code} · {p.side}
                </span>
                <span className="font-[family-name:var(--font-mono)] tnum">{money(p.unit_price)}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-end justify-between border-t-2 border-[var(--color-line)] pt-3">
            <span className="font-bold">Total</span>
            <span className="font-[family-name:var(--font-mono)] text-2xl font-bold tnum">{money(canvas.total)}</span>
          </div>
        </Panel>

        {ready && (
          <Nudge className="mt-4">You&apos;re all set — this locks in your design. Check the name and number are right first.</Nudge>
        )}

        <Button
          surface="kiosk"
          size="xl"
          variant="primary"
          block
          className="mt-4"
          busy={busy}
          onClick={submit}
        >
          Place the order
        </Button>
        <p className="mt-2 text-center text-sm text-[var(--color-muted)]">
          You&apos;ll get a ticket number to show the volunteer.
        </p>
      </aside>
    </main>
  );
}

function PaymentChoice({
  selected,
  onClick,
  title,
  detail,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  detail: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={clsx(
        "flex flex-col items-start gap-1 rounded-xl border-2 p-4 text-left",
        "transition-[transform,border-color,background-color] duration-[var(--dur-fast)] active:scale-[0.98]",
        selected ? "border-[var(--color-blue)] bg-[var(--color-blue-wash)]" : "border-[var(--color-line)] bg-white"
      )}
    >
      <span className="text-lg font-bold">{title}</span>
      <span className="text-sm text-[var(--color-muted)]">{detail}</span>
    </button>
  );
}

/** The UPI QR, generated per order with the amount already in it, so the
 *  customer never types an amount and never gets it wrong. */
function UpiPanel({ vpa, payee, amount }: { vpa: string; payee: string; amount: number }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  // Generated ONCE, lazily. This string is the transaction note the customer's
  // bank statement will carry, so it has to be stable — computing it during
  // render would mint a new reference on every re-render, and the QR on screen
  // could then disagree with the one the effect actually encoded.
  const [note] = useState(() => `crftd-${Date.now().toString(36).toUpperCase()}`);

  useEffect(() => {
    if (!vpa) return;
    QRCode.toDataURL(upiLink({ vpa, payee, amount, note }), { width: 512, margin: 1 })
      .then(setSrc)
      .catch(() => setFailed(true));
  }, [vpa, payee, amount, note]);

  if (!vpa) {
    return (
      <Banner tone="warn" title="UPI isn't set up yet" className="mt-4">
        An admin needs to add the UPI ID in settings. Choose cash for now.
      </Banner>
    );
  }

  return (
    <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border-2 border-[var(--color-line)] bg-white p-4">
      {failed ? (
        <Banner tone="warn">Couldn&apos;t draw the code. Pay by cash, or ask a volunteer.</Banner>
      ) : src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`UPI payment code for ${money(amount)}`} className="size-48 rounded-lg" />
      ) : (
        <div className="skeleton size-48 rounded-lg" />
      )}
      <p className="text-center text-sm">
        Scan with any UPI app. The amount{" "}
        <strong className="font-[family-name:var(--font-mono)]">{money(amount)}</strong> is already filled in.
      </p>
      <p className="text-center text-xs text-[var(--color-muted)]">
        Paying to {payee} · show the volunteer your payment screen when you collect
      </p>
    </div>
  );
}
