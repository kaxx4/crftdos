"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PosFrame } from "@/components/PosFrame";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "CLR", "0", "OK"];

function PinInner() {
  const params = useSearchParams();
  const router = useRouter();
  const kind = (params.get("kind") as "stall" | "admin" | "kiosk") || "stall";
  const next = params.get("next") || (kind === "admin" ? "/admin" : kind === "kiosk" ? "/" : "/sell");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(fullPin: string) {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/auth/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, pin: fullPin, deviceId: getDeviceId() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error || "Incorrect PIN");
        setPin("");
        return;
      }
      router.push(next);
    } finally {
      setBusy(false);
    }
  }

  function press(k: string) {
    if (busy) return;
    if (k === "CLR") return setPin("");
    if (k === "OK") {
      if (pin.length >= 4) submit(pin);
      return;
    }
    if (pin.length < 8) {
      const p = pin + k;
      setPin(p);
      if (p.length === 4) submit(p);
    }
  }

  return (
    <PosFrame kicker={`STALL OS · ${kind.toUpperCase()} PIN`} title="Sign in">
      <div className="flex flex-col gap-4 py-5">
        <div className="font-extrabold text-[11px] tracking-[0.16em] uppercase">
          Enter {kind} PIN
        </div>
        <div className="font-extrabold text-[44px] tracking-[0.3em] min-h-[56px] border-b-[3px] border-ink">
          {"•".repeat(pin.length)}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {KEYS.map((k) => (
            <button
              key={k}
              onClick={() => press(k)}
              disabled={busy}
              className={`min-h-[56px] border-2 border-ink font-extrabold text-xl ${
                k === "OK" ? "bg-blue text-cream" : k === "CLR" ? "bg-signal text-cream" : "bg-white text-ink"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
        {err && (
          <div className="bg-signal text-cream p-2.5 font-extrabold text-[11px] tracking-[0.1em] uppercase">
            {err}
          </div>
        )}
        {process.env.NODE_ENV !== "production" && (
          <div className="font-mono text-[11px] text-muted border border-dashed border-hairline p-2.5">
            Demo PINs — stall 1111 · admin 1234 · kiosk 2222
          </div>
        )}
      </div>
    </PosFrame>
  );
}

function getDeviceId() {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem("stallos_device_id");
  if (!id) {
    id = "dev-" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem("stallos_device_id", id);
  }
  return id;
}

export default function PinPage() {
  return (
    <Suspense>
      <PinInner />
    </Suspense>
  );
}
