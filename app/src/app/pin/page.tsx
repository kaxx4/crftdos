"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
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

  // The keydown handler is bound once, so it must not close over stale state.
  // Refs give it the live values without re-binding the listener on every
  // keystroke.
  const busyRef = useRef(false);
  busyRef.current = busy;
  const submitRef = useRef<(p: string) => void>(() => {});

  submitRef.current = (p: string) => void submit(p);

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

  const press = useCallback(
    (k: string) => {
      if (busyRef.current) return;
      if (k === "CLR") return setPin("");
      if (k === "OK") {
        setPin((p) => {
          if (p.length >= 4) submitRef.current(p);
          return p;
        });
        return;
      }
      setPin((p) => {
        if (p.length >= 8) return p;
        const next = p + k;
        // Auto-submit at 4 keeps the till fast, but only when the PIN is
        // exactly 4 long — a longer PIN is finished with OK/Enter.
        if (next.length === 4) submitRef.current(next);
        return next;
      });
    },
    []
  );

  // Keyboard entry. The keypad is right for a phone till, but /admin is
  // desktop-first per PRD §11 and an admin signs in on a keyboard — before
  // this, typing did nothing and a keyboard-only user had to tab through
  // twelve buttons for every digit.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        press(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        setPin((p) => p.slice(0, -1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        press("OK");
      } else if (e.key === "Escape") {
        e.preventDefault();
        setPin("");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  return (
    <PosFrame kicker={`STALL OS · ${kind.toUpperCase()} PIN`} title="Sign in">
      <div className="flex flex-col gap-4 py-5">
        <div className="font-extrabold text-[13px] tracking-[0.16em] uppercase">
          Enter {kind} PIN
        </div>
        {/* Announced, so a screen-reader user knows a digit landed — the
            bullets alone are purely visual feedback. */}
        <div
          role="status"
          aria-live="polite"
          aria-label={`${pin.length} of 4 digits entered`}
          className="font-extrabold text-[44px] tracking-[0.3em] min-h-[56px] border-b-[3px] border-ink"
        >
          <span aria-hidden="true">{"•".repeat(pin.length)}</span>
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
          <div role="alert" className="bg-signal text-cream p-2.5 font-extrabold text-[13px] tracking-[0.1em] uppercase">
            {err}
          </div>
        )}
        {process.env.NODE_ENV !== "production" && (
          <div className="font-mono text-[12px] text-muted border border-dashed border-hairline p-2.5">
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
