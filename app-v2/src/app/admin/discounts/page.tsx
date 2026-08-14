"use client";

/** Discount / freebie audit.
 *
 *  Every order that discounted or gave something away writes a row to
 *  `stall_admin_audit` at order time. There's nothing in the `Backend`
 *  contract for this — it's an admin-only audit view, not a domain concept
 *  the mock needs to simulate — so this fetches the raw route directly,
 *  same pattern as `/admin/pins`.
 *
 *  This used to be a stack of cards, one per entry, each with its own border.
 *  An audit log is read by scanning down a column looking for the one number
 *  that is too big, which is what a table is for and what a card list actively
 *  prevents.
 *
 *  Colour budget: yellow and sky. Yellow marks the number and the rows
 *  that need a second look; sky is the ordinary case. The rows themselves are
 *  one tone — an audit log where rows are individually coloured is a log that
 *  looks alarming when nothing is wrong. */

import { AdminShell, NumHead } from "@/features/admin/AdminShell";
import { Badge, Banner, EmptyState, Panel, Skeleton, Stat, Table, Td, Th } from "@/components/ui";
import { useAsync } from "@/lib/hooks/useAsync";
import { ok, err, type Result } from "@/lib/backend/contract";
import { money } from "@/lib/money";

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

  const rows = entries.data ?? [];
  const freebies = rows.filter((e) => e.action === "freebie_given");
  const givenAway = freebies.reduce((n, e) => n + (e.detail?.amount ?? 0), 0);
  const knockedOff = rows
    .filter((e) => e.action !== "freebie_given")
    .reduce((n, e) => n + (e.detail?.amount ?? 0), 0);

  return (
    <AdminShell
      title="Discounts"
      lede="Every order with a discount or a freebie writes a row here at sale time. Freebies are called out — giving something away for nothing is a bigger deal than knocking a bit off the price."
    >
      {entries.error && (
        <Banner tone="danger" title="Couldn't load discounts">
          {entries.error}
        </Banner>
      )}

      {entries.loading ? (
        <Skeleton className="h-56" />
      ) : rows.length === 0 ? (
        <EmptyState
          headline="No discounts or freebies logged"
          teach="This fills in as staff apply discounts or give things away at the till. Nothing to review yet — and nothing you need to do to make it start recording."
        />
      ) : (
        <>
          <div className="grid gap-[var(--space-3)] sm:grid-cols-3">
            <Stat label="Given away" value={money(givenAway)} sub={`${freebies.length} freebies`} emphasis tone="yellow" />
            <Stat label="Knocked off" value={money(knockedOff)} sub={`${rows.length - freebies.length} discounts`} />
            <Stat label="Entries" value={rows.length} sub="Across every stall" />
          </div>

          <Panel title="Every discount and freebie">
            <Table
              className="min-w-[860px]"
              caption="Discounts and freebies, newest first"
              head={["When", "Who", "Kind", "Order", "Reason", <NumHead key="a">Amount</NumHead>]}
            >
              {rows.map((e) => {
                const freebie = e.action === "freebie_given";
                return (
                  <tr key={e.id}>
                    <Th className="font-normal whitespace-nowrap text-[var(--color-muted)]">
                      {new Date(e.created_at).toLocaleString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "2-digit",
                        month: "short",
                      })}
                    </Th>
                    <Td className="font-extrabold">{e.actor}</Td>
                    <Td>
                      {/* Two states of one field, not decoration on a list. */}
                      <Badge tone={freebie ? "yellow" : "sky"}>{freebie ? "Freebie" : "Discount"}</Badge>
                    </Td>
                    <Td mono className="text-[var(--color-muted)]">
                      {e.detail?.order_id ?? "—"}
                    </Td>
                    <Td className="text-[var(--color-muted)]">
                      {[e.detail?.reason, e.detail?.note].filter(Boolean).join(" — ") || "—"}
                    </Td>
                    <Td mono className="text-right font-bold">
                      {money(e.detail?.amount ?? 0)}
                    </Td>
                  </tr>
                );
              })}
            </Table>
          </Panel>
        </>
      )}
    </AdminShell>
  );
}
