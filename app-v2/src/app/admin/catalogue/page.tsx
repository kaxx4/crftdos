"use client";

/** Catalogue and settings.
 *
 *  Read-mostly for now, plus the settings the kiosk genuinely cannot work
 *  without: the UPI destination. That one is load-bearing — with no VPA
 *  configured, the kiosk's UPI option renders as an explained warning rather
 *  than a broken QR, which is the right failure but not a good one to ship
 *  with.
 *
 *  Print dimensions get a column of their own because a null there is not
 *  cosmetic: a design with no physical size cannot be rendered at true scale,
 *  so the kiosk filters it out entirely and it silently stops being sellable
 *  through the canvas. That needs to be visible somewhere. */

import { useState } from "react";
import { getBackend } from "@/lib/backend";
import { useAction, useAsync } from "@/lib/hooks/useAsync";
import { money } from "@/lib/money";
import { AdminShell, ScrollX } from "@/features/admin/AdminShell";
import { Banner, Button, Field, Panel, Skeleton } from "@/components/ui";
import { clsx } from "@/components/clsx";

export default function CataloguePage() {
  const catalogue = useAsync(() => getBackend().getCatalogue(), []);
  const settings = useAsync(() => getBackend().getSettings(), []);
  const { run, busy } = useAction();

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

  const missingDims = (catalogue.data?.designs ?? []).filter((d) => d.print_w_cm == null || d.print_h_cm == null);

  return (
    <AdminShell title="Catalogue">
      <Panel title="Kiosk payment" className="mb-5">
        <p className="mb-3 max-w-[70ch] text-sm text-[var(--color-muted)]">
          The kiosk builds a payment QR per order with the amount already filled in, so customers never type it. This
          is the account it pays into.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="UPI ID"
            value={vpa}
            onChange={(e) => {
              setVpa(e.target.value);
              setSaved(false);
            }}
            placeholder="terraroots@okhdfcbank"
          />
          <Field
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
        <div className="mt-3 flex items-center gap-3">
          <Button variant="primary" busy={busy} onClick={save}>
            Save
          </Button>
          {saved && <span className="text-sm font-semibold text-[var(--color-teal)]">Saved.</span>}
        </div>
        <Banner tone="info" className="mt-3">
          This doesn&apos;t confirm payment. A UPI link is one-way — a volunteer still checks the customer&apos;s
          payment screen at handover.
        </Banner>
      </Panel>

      {missingDims.length > 0 && (
        <Banner tone="warn" title={`${missingDims.length} transfer(s) have no print size`} className="mb-5">
          The kiosk hides these completely, because it can&apos;t show them at true physical size and an order it
          can&apos;t size is an order the stall can&apos;t press. They can still be sold from a volunteer&apos;s phone:{" "}
          {missingDims.map((d) => d.code).join(", ")}.
        </Banner>
      )}

      <Panel title="Transfers">
        {catalogue.loading ? (
          <Skeleton className="h-64" />
        ) : (
          <ScrollX>
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-[var(--color-ink)] text-left">
                  {["Code", "Name", "Size", "Print (cm)", "Bin", "Cost", "Price", "Margin"].map((h) => (
                    <th key={h} scope="col" className="py-2 pr-4 font-bold last:text-right">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {catalogue.data?.designs.map((d) => (
                  <tr key={d.id} className="border-b border-[var(--color-line)]">
                    <th scope="row" className="py-2.5 pr-4 text-left font-[family-name:var(--font-mono)] font-bold">
                      {d.code}
                    </th>
                    <td className="py-2.5 pr-4">{d.name}</td>
                    <td className="py-2.5 pr-4">{d.size_class}</td>
                    <td
                      className={clsx(
                        "py-2.5 pr-4 font-[family-name:var(--font-mono)] tnum",
                        d.print_w_cm == null && "font-bold text-[var(--color-signal)]"
                      )}
                    >
                      {d.print_w_cm == null ? "not set" : `${d.print_w_cm} × ${d.print_h_cm}`}
                    </td>
                    <td className="py-2.5 pr-4 text-[var(--color-muted)]">{d.bin_location}</td>
                    <td className="py-2.5 pr-4 font-[family-name:var(--font-mono)] tnum">{money(d.unit_cost)}</td>
                    <td className="py-2.5 pr-4 font-[family-name:var(--font-mono)] tnum">{money(d.unit_price)}</td>
                    <td className="py-2.5 text-right font-[family-name:var(--font-mono)] font-bold tnum">
                      {money(d.unit_price - d.unit_cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollX>
        )}
      </Panel>

      <Panel title="Garments" className="mt-5">
        {catalogue.loading ? (
          <Skeleton className="h-40" />
        ) : (
          <p className="text-sm text-[var(--color-muted)]">
            {catalogue.data?.skus.filter((s) => s.is_active).length} active SKUs across{" "}
            {catalogue.data?.colors.length} colours and {catalogue.data?.fits.length} fits.
          </p>
        )}
      </Panel>
    </AdminShell>
  );
}
