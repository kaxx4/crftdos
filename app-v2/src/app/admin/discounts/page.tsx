"use client";

/** Discount / freebie audit.
 *
 *  Every order that discounted or gave something away writes a row to
 *  `stall_admin_audit` at order time. There's nothing in the `Backend`
 *  contract for this — it's an admin-only audit view, not a domain concept
 *  the mock needs to simulate — so this fetches the raw route directly,
 *  same pattern as `/admin/pins`. */

import { AdminShell } from "@/features/admin/AdminShell";
import { Banner, Mono, Panel, Skeleton, EmptyState } from "@/components/ui";
import { useAsync } from "@/lib/hooks/useAsync";
import { ok, err, type Result } from "@/lib/backend/contract";
import { money } from "@/lib/money";
import { clsx } from "@/components/clsx";

type AuditEntry = {
  id: string;
  actor: string;
  action: "discount_applied" | "freebie_given";
  detail: { order_id?: string; amount?: number; reason?: string; note?: string } | null;
  created_at: string;
};

async function fetchEntries(): Promise<Result<AuditEntry[]>> {
  try {
    const res = await fetch("/api/admin/discounts");
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return err(j.error ?? "Failed to load");
    return ok((j.entries ?? []) as AuditEntry[]);
  } catch {
    return err("Failed to load");
  }
}

export default function DiscountsPage() {
  const entries = useAsync(fetchEntries, []);

  return (
    <AdminShell title="Discounts">
      <p className="mb-4 max-w-[70ch] text-sm text-[var(--color-muted)]">
        Every order with a discount or a freebie writes a row here at sale time. Freebies are called out — giving
        something away for nothing is a bigger deal than knocking a bit off the price.
      </p>

      {entries.error && <Banner tone="danger" className="mb-4" title="Couldn't load discounts">{entries.error}</Banner>}

      {entries.loading ? (
        <Skeleton className="h-40" />
      ) : !entries.data || entries.data.length === 0 ? (
        <Panel>
          <EmptyState
            headline="No discounts or freebies logged"
            teach="This fills in as staff apply discounts or give things away at the till. Nothing to review yet."
          />
        </Panel>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.data.map((e) => {
            const freebie = e.action === "freebie_given";
            return (
              <Panel key={e.id} tight className={clsx(freebie && "border-[var(--color-signal)]")}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span
                      className={clsx(
                        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wide",
                        freebie
                          ? "bg-[var(--color-signal-wash)] text-[var(--color-signal)]"
                          : "bg-[var(--color-blue-wash)] text-[var(--color-blue)]"
                      )}
                    >
                      {freebie ? "Freebie" : "Discount"}
                    </span>
                    <p className="mt-1.5 text-sm">
                      <span className="font-semibold">{e.actor}</span>
                      {e.detail?.order_id && (
                        <span className="text-[var(--color-muted)]"> · order {e.detail.order_id}</span>
                      )}
                    </p>
                    {(e.detail?.reason || e.detail?.note) && (
                      <p className="mt-0.5 text-sm text-[var(--color-muted)]">
                        {e.detail?.reason}
                        {e.detail?.reason && e.detail?.note ? " — " : ""}
                        {e.detail?.note}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <Mono className={clsx("text-base font-bold", freebie && "text-[var(--color-signal)]")}>
                      {money(e.detail?.amount ?? 0)}
                    </Mono>
                    <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                      {new Date(e.created_at).toLocaleString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "2-digit",
                        month: "short",
                      })}
                    </p>
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
