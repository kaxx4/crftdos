"use client";

/** Log waste.
 *
 *  Every transfer or blank ruined in the press, logged with a reason, so the
 *  stock count stays honest and the org can eventually see which designs
 *  press worse than others. `logWaste` needs the environment this device is
 *  bound to, same as an order or a return. */

import { useMemo, useState } from "react";
import { getBackend } from "@/lib/backend";
import { useEnvironment } from "@/lib/hooks/useEnvironment";
import { useAction, useAsync } from "@/lib/hooks/useAsync";
import type { LogWasteInput } from "@/lib/backend";
import type { ProductSku, StickerDesign, WasteReason } from "@/lib/domain/types";
import { Banner, Button, Chip, EmptyState, Field, Panel, Skeleton } from "@/components/ui";

const REASONS: { value: WasteReason; label: string }[] = [
  { value: "misalignment", label: "Misalignment" },
  { value: "peel_failure", label: "Peel failure" },
  { value: "temperature", label: "Wrong temperature" },
  { value: "print_defect", label: "Print defect" },
  { value: "garment_defect", label: "Garment defect" },
  { value: "other", label: "Other" },
];
const REASON_LABEL: Record<WasteReason, string> = Object.fromEntries(
  REASONS.map((r) => [r.value, r.label])
) as Record<WasteReason, string>;

export function WasteScreen() {
  const { environment, bound } = useEnvironment();
  const catalogue = useAsync(() => getBackend().getCatalogue(), []);
  const waste = useAsync(
    () =>
      environment
        ? getBackend().listWaste({ environment_id: environment.id, limit: 30 })
        : Promise.resolve({ ok: true as const, data: [] }),
    [environment?.id]
  );

  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<{ kind: "sku"; item: ProductSku } | { kind: "design"; item: StickerDesign } | null>(
    null
  );
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState<WasteReason>("misalignment");
  const [note, setNote] = useState("");
  const [toast, setToast] = useState("");

  const { run, busy, error, clearError } = useAction();

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return { skus: [], designs: [] };
    const skus = (catalogue.data?.skus ?? []).filter((s) => s.sku_code.toLowerCase().includes(q)).slice(0, 8);
    const designs = (catalogue.data?.designs ?? [])
      .filter((d) => d.code.toLowerCase().includes(q) || d.name.toLowerCase().includes(q))
      .slice(0, 8);
    return { skus, designs };
  }, [search, catalogue.data]);

  function pick(item: { kind: "sku"; item: ProductSku } | { kind: "design"; item: StickerDesign }) {
    setChosen(item);
    setSearch(item.kind === "sku" ? item.item.sku_code : item.item.code);
    clearError();
  }

  async function submit() {
    if (!chosen || !environment) return;
    const n = Number(qty) || 0;
    if (n <= 0) return;

    const input: LogWasteInput = {
      environment_id: environment.id,
      sticker_id: chosen.kind === "design" ? chosen.item.id : null,
      sticker_qty: chosen.kind === "design" ? n : 0,
      product_sku_id: chosen.kind === "sku" ? chosen.item.id : null,
      product_qty: chosen.kind === "sku" ? n : 0,
      reason,
      note: note.trim() || null,
    };

    const res = await run(() => getBackend().logWaste(input));
    if (res) {
      const label = chosen.kind === "sku" ? chosen.item.sku_code : chosen.item.code;
      setToast(`Logged — ${label} stock reduced.`);
      setChosen(null);
      setSearch("");
      setQty("1");
      setNote("");
      void waste.reload();
    }
  }

  if (!bound) {
    return (
      <div className="p-4">
        <Banner tone="warn" title="Assign this phone to a stall first">
          Waste is logged against the stall this device is bound to.
        </Banner>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-3">
      <Banner tone="info">
        Log every transfer or blank ruined in the press, even when it feels like paperwork. It takes the item out of
        stock with a reason, so the count stays honest.
      </Banner>

      {toast && <Banner tone="success">{toast}</Banner>}

      <Panel title="Log waste">
        <div className="flex flex-col gap-3">
          <Field
            label="Sticker or product code"
            placeholder="e.g. S-014 or M-BLK-L"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setChosen(null);
            }}
          />

          {!chosen && (results.skus.length > 0 || results.designs.length > 0) && (
            <ul className="flex flex-col divide-y divide-[var(--color-line)] rounded-lg border-2 border-[var(--color-line)]">
              {results.designs.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => pick({ kind: "design", item: d })}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-black/5"
                  >
                    <span>
                      <span className="font-[family-name:var(--font-mono)] font-bold">{d.code}</span>
                      <span className="ml-2">{d.name}</span>
                    </span>
                    <span className="text-xs text-[var(--color-muted)]">sticker</span>
                  </button>
                </li>
              ))}
              {results.skus.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => pick({ kind: "sku", item: s })}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-black/5"
                  >
                    <span className="font-[family-name:var(--font-mono)] font-bold">{s.sku_code}</span>
                    <span className="text-xs text-[var(--color-muted)]">product</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {chosen && (
            <div className="rounded-lg border-2 border-[var(--color-blue)] bg-[var(--color-blue-wash)] p-3 text-sm font-bold">
              {chosen.kind === "sku" ? chosen.item.sku_code : `${chosen.item.code} — ${chosen.item.name}`}
            </div>
          )}

          <Field label="Quantity wasted" type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />

          <div>
            <p className="mb-1.5 text-sm font-semibold">Reason</p>
            <div className="flex flex-wrap gap-1.5">
              {REASONS.map((r) => (
                <Chip key={r.value} selected={reason === r.value} onClick={() => setReason(r.value)}>
                  {r.label}
                </Chip>
              ))}
            </div>
          </div>

          <Field
            label="Note (optional)"
            placeholder="Anything worth flagging"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          {error && <Banner tone="danger">{error}</Banner>}

          <Button variant="danger" size="lg" block busy={busy} disabled={!chosen || Number(qty) <= 0} onClick={submit}>
            Log waste (removes stock)
          </Button>
        </div>
      </Panel>

      <Panel title="Recently logged here">
        {waste.loading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : !waste.data?.length ? (
          <EmptyState
            headline="Nothing logged yet"
            teach="Damaged or unsellable stock goes here so counts stay accurate."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--color-line)]">
            {waste.data.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>{REASON_LABEL[w.reason] ?? w.reason}</span>
                <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-muted)]">
                  {new Date(w.created_at).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
