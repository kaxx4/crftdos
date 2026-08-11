"use client";

/** Device settings — where a device is bound to an environment.
 *
 *  Every surface has this same page and the same chip; the kiosk is not a
 *  special case (Fresh Plan §7, explicit). It is a persisted local setting,
 *  not a login and not a session — an operator sets it once when they unbox
 *  the tablet, and it survives until someone deliberately changes it.
 *
 *  The consequence of getting it wrong is the reason this screen is blunt
 *  about what it does: an order written into the wrong environment is not
 *  recoverable from the UI. */

import Link from "next/link";
import { getBackend } from "@/lib/backend";
import { useDeviceId } from "@/lib/hooks/useDeviceId";
import { useEnvironment } from "@/lib/hooks/useEnvironment";
import { Banner, Button, Panel } from "@/components/ui";
import { clsx } from "@/components/clsx";

export default function SettingsPage() {
  const { environment, environments, bind, loading } = useEnvironment();
  const deviceId = useDeviceId();

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-5 p-4">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">Device settings</h1>
        <p className="mt-1 text-[var(--color-muted)]">
          Choose which stall this device is selling for. Everything it records — sales, stock, tickets — goes into
          that stall.
        </p>
      </header>

      {!loading && !environment && (
        <Banner tone="warn" title="Not assigned yet">
          Pick one below before anyone uses this device.
        </Banner>
      )}

      <Panel title="Selling for">
        {loading ? (
          <p className="text-sm text-[var(--color-muted)]">Loading stalls…</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {environments
              .filter((e) => e.is_active)
              .map((e) => {
                const active = environment?.id === e.id;
                return (
                  <li key={e.id}>
                    <button
                      onClick={() => bind(e.id)}
                      aria-pressed={active}
                      className={clsx(
                        "flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left",
                        "transition-[transform,border-color,background-color] duration-[var(--dur-fast)] active:scale-[0.98]",
                        active ? "border-[var(--color-blue)] bg-[var(--color-blue-wash)]" : "border-[var(--color-line)] bg-white"
                      )}
                    >
                      <span className="rounded-md bg-[var(--color-ink)] px-2 py-1 font-[family-name:var(--font-mono)] text-sm font-bold text-white">
                        {e.prefix}
                      </span>
                      <span className="flex-1">
                        <span className="block font-bold">{e.name}</span>
                        <span className="block text-sm capitalize text-[var(--color-muted)]">
                          {e.kind === "cloud" ? "General / not a physical stall" : `${e.kind} environment`}
                        </span>
                      </span>
                      {active && <span className="font-bold text-[var(--color-blue)]">Selected</span>}
                    </button>
                  </li>
                );
              })}
          </ul>
        )}
      </Panel>

      <Panel title="Where to next">
        <div className="flex flex-wrap gap-2">
          <Link href="/" className="inline-flex">
            <Button variant="secondary">Kiosk</Button>
          </Link>
          <Link href="/pos" className="inline-flex">
            <Button variant="secondary">Volunteer POS</Button>
          </Link>
          <Link href="/admin" className="inline-flex">
            <Button variant="secondary">Admin</Button>
          </Link>
        </div>
      </Panel>

      <Panel title="Diagnostics">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-[var(--color-muted)]">Device</dt>
          <dd className="font-[family-name:var(--font-mono)]">{deviceId ?? "…"}</dd>
          <dt className="text-[var(--color-muted)]">Backend</dt>
          <dd className="font-[family-name:var(--font-mono)]">
            {getBackend().isMock ? "mock (demo data)" : "live"}
          </dd>
        </dl>
        {getBackend().isMock && (
          <Banner tone="warn" className="mt-3">
            This build is running on demo data. Nothing recorded here is a real sale, and it lives only in this
            browser.
          </Banner>
        )}
      </Panel>
    </main>
  );
}
