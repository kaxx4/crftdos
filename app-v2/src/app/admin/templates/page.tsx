"use client";

/** Template management.
 *
 *  Templates are what the kiosk storefront merchandises, and they are a
 *  genuinely separate thing from presets: presets are editable starting points
 *  that already existed; templates are curated, featured, and have a sales
 *  count behind them. Marking one featured puts it in "Most popular" on the
 *  kiosk home page.
 *
 *  A template whose transfers have been deactivated is filtered out on read
 *  rather than blocked on write, so deactivating a design never stops an admin
 *  mid-edit — the template just quietly stops being offered. */

import { getBackend } from "@/lib/backend";
import { useAction, useAsync } from "@/lib/hooks/useAsync";
import { money } from "@/lib/money";
import { AdminShell } from "@/features/admin/AdminShell";
import { DesignPreview } from "@/features/kiosk/DesignPreview";
import { Banner, Button, EmptyState, Panel, Skeleton } from "@/components/ui";

export default function TemplatesPage() {
  const templates = useAsync(() => getBackend().listTemplates({ includeInactive: true }), []);
  const catalogue = useAsync(() => getBackend().getCatalogue(), []);
  const { run, busy, error } = useAction();

  const toggle = async (id: string, patch: { is_featured?: boolean; is_active?: boolean }) => {
    const t = templates.data?.find((x) => x.id === id);
    if (!t) return;
    const res = await run(() => getBackend().saveTemplate({ ...t, ...patch }));
    if (res) void templates.reload();
  };

  return (
    <AdminShell title="Templates">
      <Banner tone="info" className="mb-4">
        These are what customers see first on the kiosk. Featured ones appear under &ldquo;Most popular&rdquo;. A
        customer can always edit a template after opening it — it&apos;s a starting point, not a fixed product.
      </Banner>

      {error && <Banner tone="danger" className="mb-4">{error}</Banner>}

      {templates.loading || catalogue.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      ) : !templates.data?.length ? (
        <EmptyState
          headline="No templates yet"
          teach="Templates are the designs the kiosk shows on its home page. Without any, customers only get the blank canvas — which most of them won't use."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {templates.data.map((t) => {
            const sku = catalogue.data?.skus.find((s) => s.id === t.payload.product_sku_id);
            const price = (sku?.unit_price ?? 0) + t.payload.placements.reduce((n, p) => n + p.unit_price, 0);
            return (
              <Panel key={t.id}>
                <div className="mb-3 rounded-lg bg-[var(--color-cream-2)]">
                  <DesignPreview sku={sku} placements={t.payload.placements} />
                </div>
                <p className="text-lg font-bold">{t.name}</p>
                {t.blurb && <p className="text-sm text-[var(--color-muted)]">{t.blurb}</p>}
                <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <div className="flex gap-1.5">
                    <dt className="text-[var(--color-muted)]">Price</dt>
                    <dd className="font-[family-name:var(--font-mono)] font-bold tnum">{money(price)}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="text-[var(--color-muted)]">Sold</dt>
                    <dd className="font-[family-name:var(--font-mono)] font-bold tnum">{t.times_used}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="text-[var(--color-muted)]">Transfers</dt>
                    <dd className="font-[family-name:var(--font-mono)] font-bold tnum">{t.payload.placements.length}</dd>
                  </div>
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={t.is_featured ? "primary" : "secondary"}
                    busy={busy}
                    onClick={() => toggle(t.id, { is_featured: !t.is_featured })}
                  >
                    {t.is_featured ? "Featured" : "Feature it"}
                  </Button>
                  <Button size="sm" variant="ghost" busy={busy} onClick={() => toggle(t.id, { is_active: !t.is_active })}>
                    {t.is_active ? "Hide from kiosk" : "Show on kiosk"}
                  </Button>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
