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
 *  mid-edit — the template just quietly stops being offered.
 *
 *  This is the one admin screen that is a card grid rather than a table, and
 *  the reason is that the artwork is the content — a template is chosen by
 *  looking at it, not by reconciling it against a column of figures.
 *
 *  Colour budget: acid on the featured badge and nothing else. Twelve cards
 *  each carrying a coloured action is the confetti failure in its purest
 *  form, so both toggles are neutral and state is carried by badges. */

import { getBackend } from "@/lib/backend";
import { useAction, useAsync } from "@/lib/hooks/useAsync";
import { money } from "@/lib/money";
import { AdminShell } from "@/features/admin/AdminShell";
import { DesignPreview } from "@/components/DesignPreview";
import { Badge, Banner, Button, EmptyState, Heading, Mono, Panel, Skeleton, Text } from "@/components/ui";

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
    <AdminShell
      title="Templates"
      lede="What customers see first on the kiosk. Featured ones appear under “Most popular”. A customer can always edit a template after opening it — it's a starting point, not a fixed product."
    >
      {error && (
        <Banner tone="danger" title="Couldn't save that template">
          {error}
        </Banner>
      )}

      {templates.error && (
        <Banner tone="danger" title="Couldn't load templates">
          {templates.error}
        </Banner>
      )}

      {templates.loading || catalogue.loading ? (
        <div className="grid gap-[var(--space-5)] sm:grid-cols-2 xl:grid-cols-3">
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
        <div className="grid gap-[var(--space-5)] sm:grid-cols-2 xl:grid-cols-3">
          {templates.data.map((t) => {
            const sku = catalogue.data?.skus.find((s) => s.id === t.payload.product_sku_id);
            const price = (sku?.unit_price ?? 0) + t.payload.placements.reduce((n, p) => n + p.unit_price, 0);
            return (
              <Panel key={t.id} className="flex flex-col gap-[var(--space-3)]">
                <div className="overflow-hidden rounded-[var(--radius-md)] border-[3px] border-[var(--color-ink)] bg-[var(--color-paper-2)]">
                  <DesignPreview sku={sku} placements={t.payload.placements} />
                </div>

                <div className="flex flex-wrap items-start justify-between gap-[var(--space-2)]">
                  <Heading level={3} step="lg">
                    {t.name}
                  </Heading>
                  <div className="flex flex-wrap gap-[var(--space-1)]">
                    {t.is_featured && <Badge tone="acid">Featured</Badge>}
                    {!t.is_active && <Badge tone="white">Hidden</Badge>}
                  </div>
                </div>

                {t.blurb && (
                  <Text step="sm" muted>
                    {t.blurb}
                  </Text>
                )}

                <dl className="grid grid-cols-3 gap-[var(--space-2)] border-t-2 border-[var(--color-line-soft)] pt-[var(--space-3)]">
                  {[
                    { label: "Price", value: money(price) },
                    { label: "Sold", value: t.times_used },
                    { label: "Transfers", value: t.payload.placements.length },
                  ].map((f) => (
                    <div key={f.label}>
                      <dt className="t-label text-[var(--color-muted)]">{f.label}</dt>
                      <dd className="t-md">
                        <Mono>{f.value}</Mono>
                      </dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-auto flex flex-wrap gap-[var(--space-2)] pt-[var(--space-1)]">
                  <Button
                    size="sm"
                    surface="admin"
                    variant="secondary"
                    busy={busy}
                    aria-pressed={t.is_featured}
                    onClick={() => toggle(t.id, { is_featured: !t.is_featured })}
                  >
                    {t.is_featured ? "Un-feature" : "Feature it"}
                  </Button>
                  <Button
                    size="sm"
                    surface="admin"
                    variant="ghost"
                    busy={busy}
                    onClick={() => toggle(t.id, { is_active: !t.is_active })}
                  >
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
