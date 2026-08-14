"use client";

/** Catalogue and the settings the kiosk genuinely cannot work without.
 *
 *  Read-mostly for now, plus the UPI destination. That one is load-bearing —
 *  with no VPA configured, the kiosk's UPI option renders as an explained
 *  warning rather than a broken QR, which is the right failure but not a good
 *  one to ship with. So an unset VPA is announced at the top of the page, not
 *  discovered by scrolling to a form.
 *
 *  Print dimensions get a column of their own because a null there is not
 *  cosmetic: a design with no physical size cannot be rendered at true scale,
 *  so the kiosk filters it out entirely and it silently stops being sellable
 *  through the canvas.
 *
 *  Colour budget: yellow for the two attention states, cobalt for Save. */

import { useState } from "react";
import { getBackend } from "@/lib/backend";
import { useAction, useAsync } from "@/lib/hooks/useAsync";
import { money } from "@/lib/money";
import { AdminShell, NumHead } from "@/features/admin/AdminShell";
import {
  Badge,
  Banner,
  Button,
  EmptyState,
  Field,
  Panel,
  Skeleton,
  Table,
  Td,
  Text,
  Th,
} from "@/components/ui";

export default function CataloguePage() {
  const catalogue = useAsync(() => getBackend().getCatalogue(), []);
  const settings = useAsync(() => getBackend().getSettings(), []);
  const { run, busy, error, clearError } = useAction();

  /** Edits are held as an optional draft OVER the loaded value rather than
   *  copied into state by an effect. No effect means no window where the form
   *  shows a stale copy, and no risk of a reload silently clobbering something
   *  half-typed. */
  const [draft, setDraft] = useState<{ vpa: string; payee: string } | null>(null);
  const [saved, setSaved] = useState(false);

  const vpa = draft?.vpa ?? String(settings.data?.upi_vpa ?? "");
  const payee = draft?.payee ?? String(settings.data?.upi_payee_name ?? "");
  const setVpa = (v: string) => setDraft({ vpa: v, payee });
  const setPayee = (v: string) => setDraft({ vpa, payee: v });

  const save = async () => {
    await run(() => getBackend().setSetting("upi_vpa", vpa.trim()));
    await run(() => getBackend().setSetting("upi_payee_name", payee.trim()));
    setSaved(true);
    setDraft(null);
    void settings.reload();
  };

  const designs = catalogue.data?.designs ?? [];
  const missingDims = designs.filter((d) => d.print_w_cm == null || d.print_h_cm == null);
  const vpaMissing = !settings.loading && String(settings.data?.upi_vpa ?? "").trim() === "";

  return (
    <AdminShell
      title="Catalogue"
      lede="What the stall can sell, what each thing costs us, and what it charges. Editing prices happens on the Pricing page."
    >
      {catalogue.error && (
        <Banner tone="danger" title="Couldn't load the catalogue">
          {catalogue.error}
        </Banner>
      )}

      {vpaMissing && (
        <Banner tone="warn" title="The kiosk can't take UPI payments yet">
          No UPI ID is set, so the kiosk shows customers an explanation instead of a payment QR. Set one under
          &ldquo;Kiosk payment account&rdquo; at the bottom of this page.
        </Banner>
      )}

      {missingDims.length > 0 && (
        <Banner tone="warn" title={`${missingDims.length} transfer${missingDims.length === 1 ? "" : "s"} have no print size`}>
          The kiosk hides these completely, because it can&apos;t show them at true physical size and an order it
          can&apos;t size is an order the stall can&apos;t press. They can still be sold from a volunteer&apos;s phone:{" "}
          {missingDims.map((d) => d.code).join(", ")}.
        </Banner>
      )}

      <Panel title="Transfers">
        {catalogue.loading ? (
          <Skeleton className="h-64" />
        ) : designs.length === 0 ? (
          <EmptyState
            headline="No transfers in the catalogue"
            teach="Transfers are the printed designs a customer picks on the kiosk. Until at least one exists with a print size, the kiosk canvas has nothing to offer."
          />
        ) : (
          <Table
            className="min-w-[820px]"
            caption="Every transfer, with its print size, cost and price"
            head={[
              "Code",
              "Name",
              "Size",
              "Print (cm)",
              "Bin",
              <NumHead key="c">Cost</NumHead>,
              <NumHead key="p">Price</NumHead>,
              <NumHead key="m">Margin</NumHead>,
            ]}
          >
            {designs.map((d) => (
              <tr key={d.id}>
                <Th className="font-[family-name:var(--font-mono)]">{d.code}</Th>
                <Td>{d.name}</Td>
                <Td>{d.size_class}</Td>
                <Td mono>
                  {d.print_w_cm == null ? (
                    /* Not an error — an omission that quietly removes the item
                       from the kiosk. Attention, not stop. */
                    <Badge tone="yellow">Not set</Badge>
                  ) : (
                    `${d.print_w_cm} × ${d.print_h_cm}`
                  )}
                </Td>
                <Td className="text-[var(--color-muted)]">{d.bin_location}</Td>
                <Td mono className="text-right">
                  {money(d.unit_cost)}
                </Td>
                <Td mono className="text-right">
                  {money(d.unit_price)}
                </Td>
                <Td mono className="text-right font-bold">
                  {money(d.unit_price - d.unit_cost)}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      <Panel title="Garments">
        {catalogue.loading ? (
          <Skeleton className="h-16" />
        ) : (
          <Text step="sm" muted>
            {catalogue.data?.skus.filter((s) => s.is_active).length} active SKUs across{" "}
            {catalogue.data?.colors.length} colours and {catalogue.data?.fits.length} fits. Prices and costs for these
            live on the Pricing page.
          </Text>
        )}
      </Panel>

      <Panel title="Kiosk payment account">
        <Text step="sm" muted className="mb-[var(--space-3)] max-w-[70ch]">
          The kiosk builds a payment QR per order with the amount already filled in, so customers never type it. This
          is the account it pays into.
        </Text>

        {error && (
          <Banner
            tone="danger"
            title="Couldn't save that"
            className="mb-[var(--space-3)]"
            action={
              <Button size="sm" surface="admin" variant="ghost" onClick={clearError}>
                Dismiss
              </Button>
            }
          >
            {error}
          </Banner>
        )}

        <div className="grid gap-[var(--space-3)] sm:grid-cols-2">
          <Field
            surface="admin"
            label="UPI ID"
            value={vpa}
            onChange={(e) => {
              setVpa(e.target.value);
              setSaved(false);
            }}
            placeholder="terraroots@okhdfcbank"
            hint="The VPA the money lands in."
          />
          <Field
            surface="admin"
            label="Payee name"
            value={payee}
            onChange={(e) => {
              setPayee(e.target.value);
              setSaved(false);
            }}
            placeholder="TerraRoots Foundation"
            hint="Shown in the customer's UPI app before they pay."
          />
        </div>

        <div className="mt-[var(--space-3)] flex flex-wrap items-center gap-[var(--space-3)]">
          <Button surface="admin" size="sm" variant="primary" busy={busy} onClick={save}>
            Save payment account
          </Button>
          {saved && (
            <span className="t-sm font-extrabold text-[var(--color-acid-deep)]" role="status">
              Saved.
            </span>
          )}
        </div>

        <Banner tone="info" className="mt-[var(--space-3)]">
          This doesn&apos;t confirm payment. A UPI link is one-way — a volunteer still checks the customer&apos;s
          payment screen at handover.
        </Banner>
      </Panel>
    </AdminShell>
  );
}
