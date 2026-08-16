"use client";

/** Discount / freebie audit.
 *
 *  Every order that discounted or gave something away writes a row to
 *  `stall_admin_audit` at order time (live only — see below for mock).
 *
 *  This used to be a stack of cards, one per entry, each with its own border.
 *  An audit log is read by scanning down a column looking for the one number
 *  that is too big, which is what a table is for and what a card list actively
 *  prevents.
 *
 *  Colour budget: yellow and sky. Yellow marks the number and the rows
 *  that need a second look; sky is the ordinary case. The rows themselves are
 *  one tone — an audit log where rows are individually coloured is a log that
 *  looks alarming when nothing is wrong.
 *
 *  `stall_admin_audit` only exists in Postgres, so the live path still hits
 *  the raw route. But `/api/admin/discounts` calls Supabase unconditionally —
 *  it doesn't go through `getBackend()` — so under the mock backend (which is
 *  what this app runs as until the live migrations + credentials land) that
 *  fetch always 500s and this page was permanently a dead end. The mock has
 *  no separate audit table, but every discounted/freebie order already
 *  carries `discount_amount`/`discount_reason`/`discount_note`, which is the
 *  same information `stall_admin_audit` stores — so in mock mode this derives
 *  the same rows from `listOrders` instead of the broken fetch. */

import { AdminShell, NumHead } from "@/features/admin/AdminShell";
import { Badge, Banner, EmptyState, Panel, Skeleton, Stat, Table, Td, Th } from "@/components/ui";
import { useAsync } from "@/lib/hooks/useAsync";
import { getBackend } from "@/lib/backend";
import { ok, err, type Result } from "@/lib/backend/contract";
import { money } from "@/lib/money";

type AuditEntry = {
  id: string;
  actor: string;
  action: "discount_applied" | "freebie_given";
  detail: { order_id?: string; amount?: number; reason?: string; note?: string } | null;
  created_at: string;
};

async function fetchEntriesFromMock(): Promise<Result<AuditEntry[]>> {
  const res = await getBackend().listOrders({ limit: 500 });
  if (!res.ok) return err(res.error);
  const entries = res.data
    .filter((o) => o.discount_amount > 0)
    .map(
      (o): AuditEntry => ({
        id: o.id,
        actor: o.device_id ?? "device",
        action: o.discount_reason === "freebie" ? "freebie_given" : "discount_applied",
        detail: {
          order_id: o.id,
          amount: o.discount_amount,
          reason: o.discount_reason ?? undefined,
          note: o.discount_note ?? undefined,
        },
        created_at: o.created_at,
      })
    )
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return ok(entries);
}

async function fetchEntriesFromApi(): Promise<Result<AuditEntry[]>> {
  try {
    const res = await fetch("/api/admin/discounts");
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return err(j.error ?? "Failed to load");
    return ok((j.entries ?? []) as AuditEntry[]);
  } catch {
    return err("Failed to load");
  }
}

function fetchEntries(): Promise<Result<AuditEntry[]>> {
  return getBackend().isMock ? fetchEntriesFromMock() : fetchEntriesFromApi();
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
          <div className="stagger grid gap-[var(--space-3)] sm:grid-cols-3">
            <Stat label="Given away" value={money(givenAway)} sub={`${freebies.length} freebies`} emphasis tone="yellow" />
            <Stat label="Knocked off" value={money(knockedOff)} sub={`${rows.length - freebies.length} discounts`} />
            <Stat label="Entries" value={rows.length} sub="Across every stall" />
          </div>

          <Panel title="Every discount and freebie" className="animate-rise">
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
