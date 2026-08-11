"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Banner, Button } from "@/components/ui";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "CLR", "0", "OK"];

function getDeviceId() {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem("stallos_device_id");
  if (!id) {
    id = "dev-" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem("stallos_device_id", id);
  }
  return id;
}

function PinInner() {
  const params = useSearchParams();
  const router = useRouter();
  const kind = (params.get("kind") as "stall" | "admin" | "kiosk") || "stall";
  const next = params.get("next") || (kind === "admin" ? "/admin" : kind === "kiosk" ? "/" : "/pos");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // Bound once; refs give the handler live values without re-binding on
  // every keystroke. Assignment happens in an effect, not during render —
  // mutating a ref while rendering is undefined behaviour under the React
  // Compiler's rules even though it worked under the old runtime.
  const busyRef = useRef(false);
  const submitRef = useRef<(p: string) => void>(() => {});

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

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

  useEffect(() => {
    submitRef.current = (p: string) => void submit(p);
  });

  const press = useCallback((k: string) => {
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
      const nextPin = p + k;
      // Auto-submit at 4 digits keeps the till fast; a longer PIN needs OK.
      if (nextPin.length === 4) submitRef.current(nextPin);
      return nextPin;
    });
  }, []);

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
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 p-6">
      <div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-muted)]">
        Stall OS · {kind.toUpperCase()} PIN
      </div>
      <h1 className="text-2xl font-extrabold">Sign in</h1>

      <div
        role="status"
        aria-live="polite"
        aria-label={`${pin.length} of 4 digits entered`}
        className="min-h-[56px] border-b-2 border-[var(--color-ink)] font-extrabold text-[44px] tracking-[0.3em]"
      >
        <span aria-hidden="true">{"•".repeat(pin.length)}</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {KEYS.map((k) => (
          <Button
            key={k}
            size="xl"
            variant={k === "OK" ? "primary" : k === "CLR" ? "danger" : "secondary"}
            onClick={() => press(k)}
            disabled={busy}
          >
            {k}
          </Button>
        ))}
      </div>

      {err && (
        <Banner tone="danger" title="Sign-in failed">
          {err}
        </Banner>
      )}

      {process.env.NODE_ENV !== "production" && (
        <p className="rounded-md border border-dashed border-[var(--color-line)] p-2.5 font-mono text-xs text-[var(--color-muted)]">
          Demo PINs — stall 1111 · admin 1234 · kiosk 2222
        </p>
      )}
    </main>
  );
}

export default function PinPage() {
  return (
    <Suspense>
      <PinInner />
    </Suspense>
  );
}
