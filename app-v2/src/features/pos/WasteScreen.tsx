"use client";

/** Log waste.
 *
 *  Every transfer or blank ruined in the press, logged with a reason, so the
 *  stock count stays honest and the org can eventually see which designs
 *  press worse than others. `logWaste` needs the environment this device is
 *  bound to, same as an order or a return.
 *
 *  Logging waste destroys stock and cannot be undone from this surface, so the
 *  commit is a two-tap `ConfirmAction` in the pinned foot rather than a plain
 *  red button sitting in the middle of a form.
 *
 *  Colour budget: none — no real per-entry status here, only the shared
 *  info/success/error banners every screen carries. */

import { useMemo, useState } from "react";
import Link from "next/link";
import { getBackend } from "@/lib/backend";
import { useEnvironment } from "@/lib/hooks/useEnvironment";
import { useAction, useAsync } from "@/lib/hooks/useAsync";
import type { LogWasteInput } from "@/lib/backend";
import type { ProductSku, StickerDesign, WasteReason } from "@/lib/domain/types";
import {
  Badge,
  Banner,
  Button,
  Chip,
  ConfirmAction,
  EmptyState,
  Field,
  Mono,
  Panel,
  PosScreen,
  Skeleton,
  Text,
} from "@/components/ui";

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
      <PosScreen>
        <PosScreen.Body>
          <Banner tone="warn" title="Assign this phone to a stall first">
            Waste is logged against the stall this device is bound to.
          </Banner>
        </PosScreen.Body>
        <PosScreen.Foot>
          <Link href="/settings" className="inline-flex w-full">
            <Button variant="primary" size="xl" block>
              Choose this phone&apos;s stall
            </Button>
          </Link>
        </PosScreen.Foot>
      </PosScreen>
    );
  }

  const chosenLabel = chosen ? (chosen.kind === "sku" ? chosen.item.sku_code : chosen.item.code) : null;
  const ready = Boolean(chosen) && Number(qty) > 0;

  return (
    <PosScreen>
      <PosScreen.Body className="stagger">
        <Banner tone="info">
          Log every transfer or blank ruined in the press, even when it feels like paperwork. It takes the item out
          of stock with a reason, so the count stays honest.
        </Banner>

        {toast && <Banner tone="success">{toast}</Banner>}

        <Panel title="What was ruined">
          <div className="flex flex-col gap-[var(--space-3)]">
            <Field
              label="Sticker or product code"
              placeholder="e.g. S-014 or M-BLK-L"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setChosen(null);
              }}
              hint="Start typing a code and pick it from the list."
            />

            {!chosen && (results.skus.length > 0 || results.designs.length > 0) && (
              <ul className="flex flex-col divide-y-2 divide-[var(--color-line-soft)] overflow-hidden rounded-[var(--radius-lg)] border-[3px] border-[var(--color-ink)]">
                {results.designs.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => pick({ kind: "design", item: d })}
                      className="flex min-h-[var(--tap-pos)] w-full items-center justify-between gap-[var(--space-3)] bg-white px-[var(--space-3)] text-left t-base hover:bg-[var(--color-paper-2)]"
                    >
                      <span className="min-w-0 truncate">
                        <Mono className="font-bold">{d.code}</Mono>
                        <span className="ml-2">{d.name}</span>
                      </span>
                      <Badge tone="white">Sticker</Badge>
                    </button>
                  </li>
                ))}
                {results.skus.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => pick({ kind: "sku", item: s })}
                      className="flex min-h-[var(--tap-pos)] w-full items-center justify-between gap-[var(--space-3)] bg-white px-[var(--space-3)] text-left t-base hover:bg-[var(--color-paper-2)]"
                    >
                      <Mono className="font-bold">{s.sku_code}</Mono>
                      <Badge tone="white">Product</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {chosen && (
              <div className="animate-pop rounded-[var(--radius-lg)] border-[3px] border-[var(--color-ink)] bg-[var(--color-yellow)] p-[var(--space-3)] t-md">
                {chosen.kind === "sku" ? chosen.item.sku_code : `${chosen.item.code} — ${chosen.item.name}`}
              </div>
            )}

            <Field label="Quantity wasted" type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />

            <div className="flex flex-col gap-[var(--space-1)]">
              <span className="t-label">Reason</span>
              <div className="flex flex-wrap gap-[var(--space-2)]">
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
          </div>
        </Panel>

        <Panel title="Recently logged here">
          {waste.loading ? (
            <div className="flex flex-col gap-[var(--space-2)]">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : !waste.data?.length ? (
            <EmptyState
              headline="Nothing logged yet"
              teach="Anything ruined in the press gets logged here so the stall's counts stay accurate — and so we can see which designs press badly."
            />
          ) : (
            <ul className="stagger flex flex-col divide-y-2 divide-[var(--color-line-soft)]">
              {waste.data.map((w) => (
                <li
                  key={w.id}
                  className="flex items-center justify-between gap-[var(--space-3)] py-[var(--space-3)] t-base"
                >
                  <span>{REASON_LABEL[w.reason] ?? w.reason}</span>
                  <Mono className="text-[var(--color-muted)]">
                    {new Date(w.created_at).toLocaleString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "2-digit",
                      month: "short",
                    })}
                  </Mono>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </PosScreen.Body>

      <PosScreen.Foot className="flex flex-col gap-[var(--space-2)]">
        <div className="flex items-end justify-between gap-[var(--space-3)]">
          <span className="t-label text-white/80">Removing from stock</span>
          <Text className="t-base font-extrabold">
            {chosenLabel ? (
              <>
                <Mono>{Number(qty) || 0}</Mono> × <Mono>{chosenLabel}</Mono>
              </>
            ) : (
              "Nothing picked yet"
            )}
          </Text>
        </div>
        <ConfirmAction
          variant="danger"
          size="xl"
          block
          busy={busy}
          disabled={!ready}
          label={chosen ? "Log waste (removes stock)" : "Pick what was ruined"}
          confirmLabel={`Confirm — remove ${Number(qty) || 0} × ${chosenLabel ?? ""} from stock?`}
          onConfirm={submit}
        />
      </PosScreen.Foot>
    </PosScreen>
  );
}
