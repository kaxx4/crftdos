"use client";

/** The kiosk, as one route with an internal stage machine.
 *
 *  Deliberately NOT four Next.js routes. The canvas holds live stock
 *  reservations, and a route change would unmount the hook that owns them —
 *  orphaning holds that then sit on real stock for thirty minutes while a
 *  queue waits. Composition state and hold lifetime have to share a lifetime.
 *
 *  The four stages, per the Fresh Plan §2.1 reframe from "attract screen" to
 *  storefront:
 *
 *    storefront  browse templates, or start blank            (this is new)
 *    canvas      compose — the verified core mechanic, carried forward
 *    order       name, phone, payment                        (this is new)
 *    done        ticket + what happens next */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getBackend } from "@/lib/backend";
import { track } from "@/lib/analytics";
import { getKioskSessionId, resetKioskSession } from "@/lib/device";
import { useEnvironment } from "@/lib/hooks/useEnvironment";
import { useAsync } from "@/lib/hooks/useAsync";
import { useCanvas } from "@/lib/hooks/useCanvas";
import type { DesignPayload, Order, StockRow, Template } from "@/lib/domain/types";
import { Banner, Button } from "@/components/ui";
import { EnvironmentChip } from "@/components/EnvironmentChip";
import { Storefront } from "./Storefront";
import { CanvasStage } from "./CanvasStage";
import { OrderStep } from "./OrderStep";
import { DoneStage } from "./DoneStage";

export type KioskStage = "storefront" | "canvas" | "order" | "done";

export function KioskApp() {
  const { environment, bound, loading: envLoading } = useEnvironment();
  const envId = environment?.id ?? null;

  const [stage, setStage] = useState<KioskStage>("storefront");
  const [order, setOrder] = useState<Order | null>(null);
  const canvas = useCanvas(envId);

  const catalogue = useAsync(() => getBackend().getCatalogue(), []);
  const designs = useAsync(
    () => (envId ? getBackend().getKioskCatalogue(envId) : Promise.resolve({ ok: true as const, data: [] })),
    [envId]
  );
  const templates = useAsync(() => getBackend().listTemplates(), []);

  // getCatalogue()'s stock_qty is an org-wide total (every stall + the
  // warehouse, kept in sync by a DB trigger) — GarmentPicker filtering on it
  // directly would let a customer pick a garment that's actually all sold
  // out at THIS environment, only to have it refused at checkout.
  // getKioskCatalogue already solves this correctly for stickers; this does
  // the same for garments, overlaying this environment's own stock rows.
  const locations = useAsync(() => getBackend().listStockLocations(), []);
  const location = locations.data?.find((l) => l.environment_id === envId);
  const localStock = useAsync(
    () => (location ? getBackend().getStock(location.id) : Promise.resolve({ ok: true as const, data: [] as StockRow[] })),
    [location?.id]
  );
  // Not just "has data" — `localStock` resolves to an empty placeholder array
  // the instant `location` is still unresolved (see its fetcher above), so
  // gating on `.data` alone lets this settle one tick early with every SKU's
  // stock_qty defaulted to 0. That's a real, if brief, false "sold out"
  // reading, so this also waits out `locations`/`localStock` still loading.
  const scopedCatalogue = useMemo(() => {
    if (!catalogue.data || !localStock.data || locations.loading || localStock.loading) return null;
    // available_qty, not qty — nets active holds, same as getKioskCatalogue
    // already does for stickers. A garment on hold for another customer
    // isn't available to pick again.
    const byId = new Map(localStock.data.filter((r) => r.sku_type === "product").map((r) => [r.sku_id, r.available_qty]));
    return { ...catalogue.data, skus: catalogue.data.skus.map((s) => ({ ...s, stock_qty: byId.get(s.id) ?? 0 })) };
  }, [catalogue.data, localStock.data, locations.loading, localStock.loading]);

  useEffect(() => {
    if (envId) {
      getKioskSessionId();
      track(envId, "session_started");
    }
  }, [envId]);

  const goto = useCallback(
    (next: KioskStage) => {
      setStage(next);
      if (envId) track(envId, "stage_entered", { stage: next });
    },
    [envId]
  );

  /** Start over. Releases every hold first — an abandoned composition must not
   *  keep transfers reserved while the next customer is standing there. */
  const startOver = useCallback(async () => {
    await canvas.releaseAll();
    if (envId && canvas.placements.length && stage !== "done") {
      track(envId, "order_abandoned", { placements: canvas.placements.length, stage });
    }
    canvas.reset();
    setOrder(null);
    resetKioskSession();
    void designs.reload();
    goto("storefront");
  }, [canvas, envId, stage, designs, goto]);

  const openTemplate = useCallback(
    async (t: Template) => {
      if (!catalogue.data) return;
      const loaded = await canvas.loadPayload(t.payload, catalogue.data.skus);
      if (!loaded) return;
      void getBackend().noteTemplateOpened(t.id);
      if (envId) track(envId, "template_opened", { name: t.name, slug: t.slug });
      goto("canvas");
    },
    [canvas, catalogue.data, envId, goto]
  );

  const startBlank = useCallback(
    (payload?: DesignPayload) => {
      if (envId) track(envId, "blank_started");
      if (payload && catalogue.data) void canvas.loadPayload(payload, catalogue.data.skus);
      goto("canvas");
    },
    [envId, canvas, catalogue.data, goto]
  );

  // An unbound device is a blocking, explained state. A kiosk that silently
  // wrote into the wrong environment would put a whole day's takings in the
  // wrong bucket, and nothing in the UI would ever reveal it.
  if (!envLoading && !bound) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 p-6">
        <p className="font-[family-name:var(--font-display)] text-4xl">Nearly ready.</p>
        <Banner tone="warn" title="This device hasn't been assigned to a stall yet">
          Someone needs to choose which stall this kiosk is selling for, so its orders land in the right place. It
          takes one tap.
        </Banner>
        <Link href="/settings" className="inline-flex w-full">
          <Button surface="kiosk" size="xl" variant="primary" block>
            Open settings
          </Button>
        </Link>
      </main>
    );
  }

  return (
    <div className="min-h-dvh bg-[var(--color-cream)] text-[var(--color-ink)]">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b-2 border-[var(--color-ink)] bg-[var(--color-cream)] px-4 py-2.5">
        <EnvironmentChip />
        <div className="flex items-center gap-2">
          {stage !== "storefront" && stage !== "done" && (
            <Button size="md" variant="ghost" onClick={startOver}>
              Start over
            </Button>
          )}
          <span className="font-[family-name:var(--font-mono)] text-sm font-bold tracking-[0.2em]">CRFTD★</span>
        </div>
      </header>

      {stage === "storefront" && (
        <Storefront
          templates={templates.data ?? []}
          skus={catalogue.data?.skus ?? []}
          loading={templates.loading || catalogue.loading}
          designCount={designs.data?.length ?? 0}
          onOpenTemplate={openTemplate}
          onStartBlank={() => startBlank()}
        />
      )}

      {stage === "canvas" && (
        <CanvasStage
          canvas={canvas}
          catalogue={scopedCatalogue}
          designs={designs.data ?? []}
          designsLoading={designs.loading}
          onBack={startOver}
          onContinue={() => goto("order")}
        />
      )}

      {stage === "order" && (
        <OrderStep
          canvas={canvas}
          environment={environment}
          onBack={() => goto("canvas")}
          onPlaced={(o) => {
            setOrder(o);
            goto("done");
          }}
        />
      )}

      {stage === "done" && order && environment && (
        <DoneStage order={order} environment={environment} onFinish={startOver} />
      )}
    </div>
  );
}
