"use client";

/** DETAILS.
 *
 *  The only screen on the kiosk that asks the customer for anything, so it
 *  asks for the least that makes the order fulfillable: a name to call out and
 *  a number to ring. Both labels are visible — a kiosk is used by people who
 *  have never seen it before, and a placeholder that disappears the moment you
 *  start typing is not a label.
 *
 *  NO PAYMENT HAPPENS HERE. The order is placed unpaid and settled with a
 *  volunteer at collection: a stranger's first interaction with this brand
 *  should not be a payment screen they have to trust, and a UPI link is
 *  fire-and-forget anyway — nothing tells the app the money arrived. Stock is
 *  not decremented either; the soft holds taken during composition keep doing
 *  their job until a volunteer preps the order.
 *
 *  Colour budget: COBALT (place the order) + SKY (the what-happens-next
 *  banner). */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBackend } from "@/lib/backend";
import { track } from "@/lib/analytics";
import { getDeviceId } from "@/lib/device";
import { useAction } from "@/lib/hooks/useAsync";
import { money } from "@/lib/money";
import { Banner, Button, Field, Heading, Mono, Panel, Text } from "@/components/ui";
import { KioskFrame } from "../_lib/KioskFrame";
import { Mockup } from "../_lib/Mockup";
import { useKiosk } from "../_lib/session";
import { skuLabel, useStageGuard } from "../_lib/util";

export default function KioskDetailsPage() {
  const router = useRouter();
  const { canvas, catalogue, environment, setOrder } = useKiosk();
  const { sku, placements, total } = canvas;
  const { run, busy, error } = useAction();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);

  useStageGuard(Boolean(sku) && placements.length > 0, "/kiosk/design");

  const nameOk = name.trim().length >= 2;
  const phoneOk = /^[6-9]\d{9}$/.test(phone.replace(/\D/g, ""));

  const submit = async () => {
    setTouched(true);
    if (!nameOk || !phoneOk || !environment) return;
    const payload = canvas.toPayload();
    if (!payload) return;

    const order = await run(() =>
      getBackend().createOrder({
        // Generated once, here: this is the idempotency key, and it is what
        // makes a retry incapable of creating a second order.
        id: crypto.randomUUID(),
        environment_id: environment.id,
        channel: "kiosk",
        shift_id: null,
        device_id: getDeviceId(),
        customer_name: name.trim(),
        customer_phone: phone.replace(/\D/g, ""),
        // Unpaid on purpose — see the note at the top of this file.
        payment_method: "pending",
        paid_cash: 0,
        paid_upi: 0,
        discount_amount: 0,
        discount_reason: null,
        discount_note: null,
        manual_override: false,
        designs: [payload],
        client_created_at: new Date().toISOString(),
      })
    );

    if (order) {
      track(environment.id, "order_completed", { total: order.total });
      setOrder(order);
      router.push("/kiosk/done");
    }
  };

  if (!sku) return null;

  return (
    <KioskFrame
      eyebrow="Step 4 of 4"
      title="Who's it for?"
      teach="We need a name to call out and a number to ring when your tee is pressed. Nothing else, and we don't keep it."
      back={{ href: "/kiosk/design", label: "Back to my design" }}
      foot={
        <>
          <div>
            <p className="t-label text-white/80">To pay at the counter</p>
            <p className="t-xl font-[family-name:var(--font-mono)] tnum text-white">{money(total)}</p>
          </div>
          <Button surface="kiosk" size="xl" variant="primary" busy={busy} onClick={() => void submit()}>
            Place my order →
          </Button>
        </>
      }
    >
      {error && (
        <Banner tone="warn" title="That didn't go through">
          {error} Nothing has been ordered and your design is still here — tap &ldquo;Place my order&rdquo; again, or
          ask a volunteer.
        </Banner>
      )}

      {/* Last screen before the ticket, so it earns the same rise-in energy
          as every other step rather than landing flat right before the
          payoff — `stagger` on the three blocks below, same device the
          catalogue grids already use. */}
      <div className="stagger flex flex-col gap-[var(--space-5)]">
        <Panel className="flex flex-col gap-[var(--space-4)]">
          <Field
            surface="kiosk"
            label="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="First name is fine"
            autoComplete="given-name"
            hint="This is what a volunteer will call out."
            error={touched && !nameOk ? "We need a name to call out when it's ready." : undefined}
          />
          <Field
            surface="kiosk"
            label="Phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="numeric"
            placeholder="10 digits"
            autoComplete="tel"
            hint="Only used to tell you your tee is ready."
            error={touched && !phoneOk ? "That doesn't look like a 10-digit mobile number." : undefined}
          />
        </Panel>

        <Panel title="What you're getting" className="flex flex-col gap-[var(--space-4)] sm:flex-row">
          <Mockup sku={sku} placements={placements} side="front" className="w-full sm:w-[180px] sm:shrink-0" />
          <div className="flex flex-col gap-[var(--space-2)]">
            <Heading level={2} step="lg">
              {skuLabel(sku, catalogue)}
            </Heading>
            <Text step="base" muted>
              {placements.length} transfer{placements.length === 1 ? "" : "s"} —{" "}
              {placements.map((p) => p.code).join(", ")}
            </Text>
            <Text step="md">
              <Mono>{money(total)}</Mono>
            </Text>
          </div>
        </Panel>

        <Banner tone="info" title="You pay when you collect">
          Nothing is charged here. A volunteer presses your tee, calls your name, and takes cash or UPI at the
          counter.
        </Banner>
      </div>
    </KioskFrame>
  );
}
