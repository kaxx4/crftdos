"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PosFrame } from "@/components/PosFrame";
import { FirstRunHint } from "@/components/FirstRunHint";
import { BigButton, Field, PanelLabel } from "@/components/ui";
import { getDeviceId } from "@/lib/deviceId";

export default function ShiftOpenPage() {
  const router = useRouter();
  const [name, setName] = useState(`Stall — ${new Date().toLocaleDateString("en-IN")}`);
  const [venue, setVenue] = useState("");
  const [eventName, setEventName] = useState("");
  const [pressOnSite, setPressOnSite] = useState(true);
  const [float, setFloat] = useState("0");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`/api/shift/current?deviceId=${getDeviceId()}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.shift) router.replace("/sell");
      });
  }, [router]);

  async function open() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/shift/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          venue,
          event_name: eventName || undefined,
          press_on_site: pressOnSite,
          opening_float: Number(float) || 0,
          deviceId: getDeviceId(),
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setErr(j.error || "Could not open shift");
        return;
      }
      router.push("/sell");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PosFrame
        helpTopic="first" kicker="VOLUNTEER · SHIFT" title="Open shift">
        <FirstRunHint
          id="shiftopen"
          title="Opening the stall"
          points={[
            "Only the first phone needs to fill this in. Every other phone joins the same shift automatically.",
            "Press on site means custom and kiosk designs go to a live press queue. Off means collect-later, and a promised date becomes compulsory.",
            "Opening gives this phone its own block of receipt numbers — without one it can't take payment.",
          ]}
        />
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <PanelLabel as="div">Shift name</PanelLabel>
          <Field label="Shift name" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5">
          <PanelLabel as="div">Venue</PanelLabel>
          <Field label="Venue" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="e.g. School quad" />
        </label>
        <label className="flex flex-col gap-1.5">
          <PanelLabel as="div">Event (multi-day, optional)</PanelLabel>
          <Field label="Event name (multi-day, optional)" value={eventName} onChange={(e) => setEventName(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5">
          <PanelLabel as="div">Opening float (₹)</PanelLabel>
          <Field label="Opening float in rupees" type="number" value={float} onChange={(e) => setFloat(e.target.value)} />
        </label>
        <div className="border-2 border-ink bg-white p-3 flex items-center justify-between gap-2.5">
          <div>
            <PanelLabel>Press on site</PanelLabel>
            <div className="text-[13px] text-muted max-w-[26ch]">
              {pressOnSite
                ? "ON — custom stickers or kiosk designs go into a live press queue: someone presses them while the customer waits."
                : "OFF — custom stickers or kiosk designs become collect-later: the customer picks a pickup date and we press it before then."}
            </div>
          </div>
          <button
            onClick={() => setPressOnSite((v) => !v)}
            className={`border-2 border-ink px-3 py-2 font-extrabold text-xs min-h-[48px] ${
              pressOnSite ? "bg-blue text-cream" : "bg-white text-ink"
            }`}
          >
            {pressOnSite ? "ON" : "OFF"}
          </button>
        </div>
        {err && (
          <div className="bg-signal text-cream p-2.5 font-extrabold text-[13px] tracking-wide uppercase">{err}</div>
        )}
        <BigButton onClick={open} disabled={busy || !name}>
          {busy ? "OPENING…" : "OPEN SHIFT"}
        </BigButton>
        <div className="font-mono text-[13px] text-muted">
          This assigns this device 100 receipt numbers of its own, so it can charge sales even if it goes offline.
        </div>
      </div>
    </PosFrame>
  );
}
