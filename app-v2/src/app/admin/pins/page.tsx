"use client";

/** PIN management (stall / admin / kiosk).
 *
 *  Every write here re-verifies the ADMIN'S OWN current PIN server-side, on
 *  top of the session cookie already gating this page — a walked-away
 *  unlocked admin session is the realistic threat model for "who can change
 *  the PINs everyone else's access depends on."
 *
 *  The admin PIN itself can never be deleted from here, only rotated — a
 *  delete path for it would let one careless click lock every admin out of
 *  the console with no recovery short of a raw database edit. */

import { useState } from "react";
import { AdminShell } from "@/features/admin/AdminShell";
import { Banner, Button, Field, Panel, Skeleton } from "@/components/ui";
import { useAsync } from "@/lib/hooks/useAsync";
import { ok, err, type Result } from "@/lib/backend/contract";

type Kind = "stall" | "admin" | "kiosk";
type PinStatus = Record<Kind, { configured: boolean; updated_at: string | null }>;

const LABELS: Record<Kind, { title: string; blurb: string }> = {
  stall: { title: "Stall PIN", blurb: "What volunteers enter to open the POS on a device." },
  admin: { title: "Admin PIN", blurb: "What gets into this console. Changing it signs out every other admin session." },
  kiosk: { title: "Kiosk PIN", blurb: "Rarely needed — only for staff-only kiosk diagnostics, not customer use." },
};

async function fetchStatus(): Promise<Result<PinStatus>> {
  try {
    const res = await fetch("/api/admin/pins");
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return err(j.error ?? "Failed to load");
    return ok(j as PinStatus);
  } catch {
    return err("Failed to load");
  }
}

function PinRow({ kind, status, onChanged }: { kind: Kind; status: PinStatus[Kind] | undefined; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const reset = () => {
    setOpen(false);
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    setError("");
    setConfirmDelete(false);
  };

  const save = async () => {
    if (!currentPin) return setError("Enter your current admin PIN to confirm this change.");
    if (newPin !== confirmPin) return setError("The new PIN and confirmation don't match.");
    if (!/^\d{4,8}$/.test(newPin)) return setError("PIN must be 4-8 digits.");
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/pins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, current_pin: currentPin, new_pin: newPin }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Failed to save");
      reset();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    if (!currentPin) return setError("Enter your current admin PIN to confirm this.");
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/pins", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, current_pin: currentPin }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Failed to delete");
      reset();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold">{LABELS[kind].title}</p>
          <p className="text-sm text-[var(--color-muted)]">{LABELS[kind].blurb}</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            {status?.configured ? (
              <>Configured{status.updated_at ? ` · last changed ${new Date(status.updated_at).toLocaleString()}` : ""}</>
            ) : (
              <span className="font-semibold text-[var(--color-signal)]">Not set — nobody can sign in as this role.</span>
            )}
          </p>
        </div>
        {!open && (
          <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
            Change
          </Button>
        )}
      </div>

      {open && (
        <div className="mt-4 flex flex-col gap-3 border-t-2 border-[var(--color-line)] pt-4">
          <Field
            label="Your current admin PIN"
            value={currentPin}
            onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))}
            type="password"
            inputMode="numeric"
            hint="Required for any change here, including to this PIN itself."
          />
          {!confirmDelete && (
            <>
              <Field
                label={`New ${LABELS[kind].title.toLowerCase()}`}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                type="password"
                inputMode="numeric"
                hint="4-8 digits."
              />
              <Field
                label="Confirm new PIN"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                type="password"
                inputMode="numeric"
              />
            </>
          )}
          {error && <Banner tone="danger">{error}</Banner>}
          {confirmDelete ? (
            <Banner tone="danger" title="Delete this PIN?">
              No device will be able to sign in as {kind} until it&apos;s set again.
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="danger" busy={busy} onClick={del}>
                  Yes, delete it
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
              </div>
            </Banner>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" busy={busy} disabled={!newPin || !confirmPin} onClick={save}>
                Save new PIN
              </Button>
              {kind !== "admin" && status?.configured && (
                <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                  Delete PIN
                </Button>
              )}
              <Button variant="ghost" onClick={reset}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

export default function PinsPage() {
  const status = useAsync(fetchStatus, []);

  return (
    <AdminShell title="PINs">
      <p className="mb-4 max-w-[70ch] text-sm text-[var(--color-muted)]">
        PINs are stored as one-way hashes — nobody, including the console, can read one back out once it&apos;s set.
        Losing a PIN means resetting it here, not recovering it.
      </p>
      {status.error && <Banner tone="danger" className="mb-4">{status.error}</Banner>}
      {status.loading ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="flex flex-col gap-4">
          {(["stall", "admin", "kiosk"] as const).map((k) => (
            <PinRow key={k} kind={k} status={status.data?.[k]} onChanged={status.reload} />
          ))}
        </div>
      )}
    </AdminShell>
  );
}
