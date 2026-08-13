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
 *  recoverable from the UI.
 *
 *  This is the one page in the admin set that is NOT the admin register. It is
 *  touched on a phone or a tablet, once, by whoever is setting the device up,
 *  so it runs at POS sizes: 16px body, 56px targets, one thing per row.
 *
 *  Colour budget: cobalt marks the bound stall, yellow carries the unbound
 *  warning. Nothing else. */

import Link from "next/link";
import { getBackend } from "@/lib/backend";
import { useDeviceId } from "@/lib/hooks/useDeviceId";
import { useEnvironment } from "@/lib/hooks/useEnvironment";
import { Badge, Banner, Button, EmptyState, Heading, Mono, Panel, Skeleton, Text } from "@/components/ui";

export default function SettingsPage() {
  const { environment, environments, bind, loading } = useEnvironment();
  const deviceId = useDeviceId();

  const open = environments.filter((e) => e.is_active);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-[var(--space-5)] p-[var(--space-4)]">
      <header>
        <Heading level={1} step="xxl">
          Device settings
        </Heading>
        <Text step="md" muted className="mt-[var(--space-2)]">
          Choose which stall this device is selling for. Everything it records — sales, stock, tickets — goes into that
          stall, and it cannot be moved afterwards from here.
        </Text>
      </header>

      {!loading && !environment && (
        <Banner tone="warn" title="This device isn't assigned yet">
          Nothing should be sold on it until you pick a stall below.
        </Banner>
      )}

      <Panel title="Selling for">
        {loading ? (
          <div className="flex flex-col gap-[var(--space-2)]">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : open.length === 0 ? (
          <EmptyState
            headline="No stall is open"
            teach="A device can only be bound to an open stall. Someone with admin access needs to open one first — then it appears in this list."
          />
        ) : (
          <ul className="flex flex-col gap-[var(--space-2)]">
            {open.map((e) => {
              const active = environment?.id === e.id;
              return (
                <li key={e.id}>
                  {/* One tone for the whole list; the bound one is the single
                      primary. Selection is carried by aria-pressed and by the
                      word "Selected", never by colour alone. */}
                  <Button
                    block
                    variant={active ? "primary" : "secondary"}
                    aria-pressed={active}
                    onClick={() => bind(e.id)}
                    className="justify-start gap-[var(--space-3)] px-[var(--space-4)] py-[var(--space-3)] text-left"
                  >
                    <Mono className="shrink-0">{e.prefix}</Mono>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate t-base font-extrabold">{e.name}</span>
                      <span className="block t-sm font-normal capitalize opacity-80">
                        {e.kind === "cloud" ? "General — not a physical stall" : `${e.kind} environment`}
                      </span>
                    </span>
                    {active && <span className="shrink-0 t-label">Selected</span>}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title="Where to next">
        <div className="flex flex-wrap gap-[var(--space-3)]">
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
        <dl className="grid grid-cols-[auto_1fr] gap-x-[var(--space-4)] gap-y-[var(--space-2)] t-base">
          <dt className="text-[var(--color-muted)]">Device</dt>
          <dd>
            <Mono>{deviceId ?? "…"}</Mono>
          </dd>
          <dt className="text-[var(--color-muted)]">Data</dt>
          <dd>
            <Badge tone={getBackend().isMock ? "yellow" : "white"}>
              {getBackend().isMock ? "Demo data" : "Live"}
            </Badge>
          </dd>
        </dl>
        {getBackend().isMock && (
          <Banner tone="warn" className="mt-[var(--space-3)]">
            This build is running on demo data. Nothing recorded here is a real sale, and it lives only in this
            browser.
          </Banner>
        )}
      </Panel>
    </main>
  );
}
