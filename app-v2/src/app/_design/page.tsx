"use client";

/** The design gallery.
 *
 *  Every token and every primitive in every variant, on one page, so the
 *  direction can be judged at a glance and a regression is visible rather than
 *  argued about.
 *
 *  NOTE ON THE PATH: `_design` is a Next private folder and is NOT routable.
 *  This module is re-exported from `app/design/page.tsx`, which is where you
 *  actually view it: /design. */

import { useState } from "react";
import {
  AdminPage,
  Badge,
  Banner,
  BlockGrid,
  Button,
  Card,
  Chip,
  ConfirmAction,
  EmptyState,
  Field,
  FieldShell,
  Heading,
  Mono,
  Nudge,
  Panel,
  PosScreen,
  Rail,
  Sheet,
  Skeleton,
  Stat,
  Sticker,
  Table,
  Td,
  Text,
  Th,
  type Tone,
} from "@/components/ui";

const BRIGHT: Tone[] = ["pink", "acid", "yellow", "orange", "lilac", "sky"];
const DEEP: Tone[] = ["ink", "cobalt", "pinkDeep", "acidDeep", "orangeDeep", "signal"];
const NEUTRAL: Tone[] = ["paper", "white"];

const TYPE_STEPS = [
  ["mega", "t-mega", "56 / 0.92 / -0.03em / 800", "Kiosk hero only"],
  ["xxl", "t-xxl", "40 / 0.98 / -0.025em / 800", "Page title, headline number"],
  ["xl", "t-xl", "30 / 1.06 / -0.02em / 800", "Section title, POS total"],
  ["lg", "t-lg", "22 / 1.18 / -0.015em / 700", "Panel heading, sheet title"],
  ["md", "t-md", "18 / 1.35 / -0.01em / 600", "Lead paragraph, large control"],
  ["base", "t-base", "16 / 1.5 / 0 / 400", "Body — the floor for POS text"],
  ["sm", "t-sm", "14 / 1.45 / 0 / 400", "Secondary, table cells, hints"],
  ["xs", "t-xs", "12 / 1.35 / 0.02em / 600", "Badges, dense metadata"],
  ["label", "t-label", "12 / 1.2 / 0.14em / 800 caps", "Eyebrows, field labels, table heads"],
] as const;

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-[var(--space-3)]">
      <h2 className="t-xl border-b-[3px] border-[var(--color-ink)] pb-2">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignGallery() {
  const [sheet, setSheet] = useState(false);
  const [chip, setChip] = useState("upi");

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-[var(--space-7)] p-[var(--space-5)]">
      <header className="flex flex-col gap-[var(--space-3)]">
        <Heading level={1} step="mega" display>
          Stall OS
        </Heading>
        <Text step="md" muted>
          Loud Y2K colour-block. Flat saturated panels, heavy black type, hard ink edges, sticker
          energy. Light mode only. Everything on this page is a token or a primitive — if a screen
          needs something that is not here, extend the primitives, do not hand-roll CSS.
        </Text>
        <div className="flex flex-wrap gap-[var(--space-3)]">
          <Sticker tone="pink">signature</Sticker>
          <Sticker tone="acid" tilt="r">
            AA everywhere
          </Sticker>
          <Sticker tone="yellow">no confetti</Sticker>
        </div>
      </header>

      {/* ── Colour ─────────────────────────────────────────────────────── */}
      <Row title="1 · Colour">
        <Text step="sm" muted>
          Bright blocks take INK text. Deep blocks take WHITE text. There is no third option and
          the primitives will not let you build one.
        </Text>

        <p className="t-label">Bright blocks — ink foreground</p>
        <div className="grid grid-cols-2 gap-[var(--space-2)] sm:grid-cols-3">
          {BRIGHT.map((t) => (
            <Panel key={t} tone={t} tight>
              <p className="t-lg">{t}</p>
              <p className="t-xs">ink · AA pass</p>
            </Panel>
          ))}
        </div>

        <p className="t-label">Deep blocks — white foreground</p>
        <div className="grid grid-cols-2 gap-[var(--space-2)] sm:grid-cols-3">
          {DEEP.map((t) => (
            <Panel key={t} tone={t} tight>
              <p className="t-lg">{t}</p>
              <p className="t-xs">white · AA pass</p>
            </Panel>
          ))}
        </div>

        <p className="t-label">Neutrals — the majority of every screen</p>
        <div className="grid grid-cols-2 gap-[var(--space-2)] sm:grid-cols-3">
          {NEUTRAL.map((t) => (
            <Panel key={t} tone={t} tight>
              <p className="t-lg">{t}</p>
              <p className="t-xs text-[var(--color-muted)]">muted text 7.1:1</p>
            </Panel>
          ))}
        </div>

        <Banner tone="warn" title="Proportion rule">
          At most TWO block colours on one screen, plus ink, plus neutrals. Blocks may cover no
          more than about a third of the visible area. Signal is not one of the two — it is
          reserved for stop.
        </Banner>
      </Row>

      {/* ── Type ───────────────────────────────────────────────────────── */}
      <Row title="2 · Type">
        <Panel tone="white">
          <ul className="flex flex-col gap-[var(--space-4)]">
            {TYPE_STEPS.map(([name, cls, metrics, role]) => (
              <li key={name} className="flex flex-col gap-1 border-b-2 border-[var(--color-line-soft)] pb-3 last:border-0">
                <span className={cls}>Charge ₹450 — SB-014</span>
                <span className="t-xs text-[var(--color-muted)]">
                  <Mono>{name}</Mono> · {metrics} · {role}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel tone="lilac">
          <p className="t-display t-xl">Fraunces 900 italic — display only</p>
          <p className="t-sm mt-2">Never body, never a control label, never below the xl step.</p>
        </Panel>
      </Row>

      {/* ── Buttons ────────────────────────────────────────────────────── */}
      <Row title="3 · Buttons">
        <Panel tone="white" title="POS scale — 56px floor, 76px for the charge action">
          <div className="flex flex-wrap items-center gap-[var(--space-3)]">
            <Button variant="primary" size="md">Primary</Button>
            <Button variant="secondary" size="md">Secondary</Button>
            <Button variant="ghost" size="md">Ghost</Button>
            <Button variant="danger" size="md">Void sale</Button>
            <Button variant="primary" size="md" busy>Charging</Button>
            <Button variant="secondary" size="md" disabled>Disabled</Button>
          </div>
          <div className="mt-[var(--space-4)] flex flex-wrap gap-[var(--space-3)]">
            <Button variant="primary" size="lg">Large</Button>
            <Button variant="primary" size="xl">Charge ₹450</Button>
          </div>
          <div className="mt-[var(--space-4)] flex flex-wrap gap-[var(--space-3)]">
            {(["pink", "acid", "yellow", "orange"] as Tone[]).map((t) => (
              <Button key={t} variant="block" tone={t} size="md">
                {t} block
              </Button>
            ))}
          </div>
        </Panel>

        <Panel tone="white" title="Admin scale — 40px, density is the point">
          <div className="flex flex-wrap items-center gap-[var(--space-2)]">
            <Button surface="admin" size="sm" variant="primary">Save</Button>
            <Button surface="admin" size="sm" variant="secondary">Cancel</Button>
            <Button surface="admin" size="sm" variant="ghost">Reset</Button>
            <ConfirmAction
              surface="admin"
              size="sm"
              label="Delete price band"
              confirmLabel="Tap again to delete"
              onConfirm={() => {}}
            />
          </div>
        </Panel>

        <Panel tone="white" title="Two-tap guard — the armed state escalates">
          <ConfirmAction
            block
            size="lg"
            label="Refund ₹450"
            confirmLabel="Tap again to refund ₹450"
            onConfirm={() => {}}
          />
        </Panel>
      </Row>

      {/* ── Chips, badges, stickers ────────────────────────────────────── */}
      <Row title="4 · Chips, badges, stickers">
        <Panel tone="white" title="Chip — selection">
          <Rail>
            {["cash", "upi", "split", "later"].map((m) => (
              <Chip key={m} selected={chip === m} onClick={() => setChip(m)}>
                {m.toUpperCase()}
              </Chip>
            ))}
          </Rail>
        </Panel>
        <Panel tone="white" title="Badge — status, non-interactive">
          <div className="flex flex-wrap gap-[var(--space-2)]">
            <Badge tone="acid">Paid</Badge>
            <Badge tone="yellow">Pending</Badge>
            <Badge tone="sky">Held</Badge>
            <Badge tone="signal">Void</Badge>
            <Badge tone="ink">Demo</Badge>
          </div>
        </Panel>
        <Panel tone="white" title="Sticker — at most one per panel">
          <div className="flex flex-wrap items-center gap-[var(--space-4)]">
            <Sticker tone="pink">New</Sticker>
            <Sticker tone="acid" tilt="r">Free</Sticker>
            <Sticker tone="orange">Low stock</Sticker>
          </div>
        </Panel>
      </Row>

      {/* ── Panels ─────────────────────────────────────────────────────── */}
      <Row title="5 · Panels — the signature surface">
        <BlockGrid cols={3}>
          <Panel tone="white" title="Default">
            <Text step="sm">Most panels on most screens are white or paper.</Text>
          </Panel>
          <Panel tone="yellow" title="Accent" lift>
            <Text step="sm">One lifted hero panel per screen, maximum.</Text>
          </Panel>
          <Panel tone="cobalt" title="Deep">
            <Text step="sm">White text is chosen for you.</Text>
          </Panel>
        </BlockGrid>
        <Card tone="pink" tilt="r" lift>
          <Heading level={3} step="xl">
            Card is an alias of Panel
          </Heading>
          <Text step="sm">Tilt + lift is the full sticker treatment. Use it once, deliberately.</Text>
        </Card>
      </Row>

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <Row title="6 · Stats">
        <BlockGrid cols={4}>
          <Stat label="Raised for AquaTerra" value="₹18,400" sub="Gross minus stock cost" emphasis />
          <Stat label="Gross" value="₹31,250" sub="74 orders" />
          <Stat label="Cost of goods" value="₹12,850" />
          <Stat label="Items sold" value="96" />
        </BlockGrid>
      </Row>

      {/* ── Fields ─────────────────────────────────────────────────────── */}
      <Row title="7 · Fields">
        <Panel tone="white">
          <div className="grid gap-[var(--space-4)] sm:grid-cols-2">
            <Field label="Customer name" placeholder="Optional" />
            <Field label="Phone" inputMode="tel" hint="Used for the digital receipt only." />
            <Field label="Cash (₹)" inputMode="numeric" error="Cash + UPI must add up to ₹450." />
            <FieldShell label="Payment method" hint="Chips, not a select.">
              <Rail>
                <Chip selected surface="admin">Cash</Chip>
                <Chip surface="admin">UPI</Chip>
              </Rail>
            </FieldShell>
          </div>
        </Panel>
      </Row>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <Row title="8 · Table — admin only, scrolls inside itself">
        <Table head={["Code", "Design", "Sold", "Gross"]} caption="Top designs">
          {[
            ["SB-014", "Sea Bloom", "24", "₹9,600"],
            ["TR-002", "TerraRoots", "18", "₹7,200"],
            ["AQ-101", "Aquaterra Wave", "11", "₹4,400"],
          ].map((r) => (
            <tr key={r[0]}>
              <Th className="font-[family-name:var(--font-mono)]">{r[0]}</Th>
              <Td>{r[1]}</Td>
              <Td mono>{r[2]}</Td>
              <Td mono>{r[3]}</Td>
            </tr>
          ))}
        </Table>
      </Row>

      {/* ── Feedback ───────────────────────────────────────────────────── */}
      <Row title="9 · Feedback & guidance">
        <Banner tone="info" title="Info">Sky ground, ink text.</Banner>
        <Banner tone="success" title="Sale recorded">Acid ground, ink text.</Banner>
        <Banner tone="warn" title="Check this">Yellow ground, ink text.</Banner>
        <Banner tone="danger" title="Charge failed">
          Signal fills. It is the only red on the screen and it means stop.
        </Banner>
        <Nudge>Contextual guidance attached to a specific thing, not a page-level note.</Nudge>
        <EmptyState
          headline="Nothing sold yet"
          teach="As soon as a stall makes its first sale the totals appear here, live. You don't need to refresh."
          action={<Button variant="primary">Open a shift</Button>}
        />
        <div className="flex gap-[var(--space-3)]">
          <Skeleton className="h-20 flex-1" />
          <Skeleton className="h-20 flex-1" />
        </div>
      </Row>

      {/* ── Layout scaffolds ───────────────────────────────────────────── */}
      <Row title="10 · Layout scaffolds">
        <Text step="sm" muted>
          A POS screen is three fixed regions. Only the middle one scrolls; the primary action can
          never scroll away.
        </Text>
        <div className="h-[420px] overflow-hidden rounded-[var(--radius-lg)] border-[3px] border-[var(--color-ink)]">
          <PosScreen className="h-full bg-[var(--color-paper)]">
            <PosScreen.Head>
              <div className="flex items-center justify-between">
                <p className="t-label">Walk-up sale</p>
                <Badge tone="acid">Shift open</Badge>
              </div>
            </PosScreen.Head>
            <PosScreen.Body>
              {Array.from({ length: 6 }).map((_, i) => (
                <Panel key={i} tone="white" tight title={`Section ${i + 1}`}>
                  <Text step="sm">Body scrolls. Nothing decisive lives here.</Text>
                </Panel>
              ))}
            </PosScreen.Body>
            <PosScreen.Foot>
              <div className="mb-2 flex items-end justify-between">
                <span className="t-label opacity-80">Total</span>
                <Mono className="t-xl">₹450</Mono>
              </div>
              <Button variant="primary" size="xl" block>
                Charge
              </Button>
            </PosScreen.Foot>
          </PosScreen>
        </div>

        <AdminPage
          title="Admin page scaffold"
          action={<Button surface="admin" size="sm" variant="primary">New</Button>}
        >
          <BlockGrid cols={2}>
            <Panel tone="white" title="Dense">
              <Text step="sm">Admin is information first. Colour is an accent, not a ground.</Text>
            </Panel>
            <Panel tone="white" title="Dense">
              <Text step="sm">40px targets, 14px body, tables not cards.</Text>
            </Panel>
          </BlockGrid>
        </AdminPage>
      </Row>

      {/* ── Sheet ──────────────────────────────────────────────────────── */}
      <Row title="11 · Sheet">
        <Button variant="secondary" onClick={() => setSheet(true)}>
          Open sheet
        </Button>
        <Sheet
          open={sheet}
          onClose={() => setSheet(false)}
          title="Sheet title"
          footer={
            <Button variant="primary" block onClick={() => setSheet(false)}>
              Done
            </Button>
          }
        >
          <Text>Escape closes it. The backdrop is ink, not neutral black.</Text>
        </Sheet>
      </Row>

      {/* ── Scales ─────────────────────────────────────────────────────── */}
      <Row title="12 · Spacing, radius, borders, shadow">
        <Panel tone="white" title="Spacing — closed set">
          <div className="flex flex-wrap items-end gap-[var(--space-3)]">
            {["1", "2", "3", "4", "5", "6", "7", "8"].map((s) => (
              <div key={s} className="flex flex-col items-center gap-1">
                <div
                  className="bg-[var(--color-cobalt)]"
                  style={{ width: `var(--space-${s})`, height: `var(--space-${s})` }}
                />
                <span className="t-xs">{s}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel tone="white" title="Radius — closed set">
          <div className="flex flex-wrap gap-[var(--space-3)]">
            {["xs", "sm", "md", "lg", "xl", "2xl", "pill"].map((r) => (
              <div key={r} className="flex flex-col items-center gap-1">
                <div
                  className="size-16 border-[3px] border-[var(--color-ink)] bg-[var(--color-yellow)]"
                  style={{ borderRadius: `var(--radius-${r})` }}
                />
                <span className="t-xs">{r}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel tone="white" title="Borders & shadow — hard offset only, never blur">
          <div className="flex flex-wrap gap-[var(--space-5)]">
            {(["1", "2", "3"] as const).map((b) => (
              <div key={b} className="flex flex-col items-center gap-1">
                <div
                  className="size-16 rounded-[var(--radius-md)] border-[var(--color-ink)] bg-white"
                  style={{ borderWidth: `var(--border-${b})` }}
                />
                <span className="t-xs">border-{b}</span>
              </div>
            ))}
            <div className="flex flex-col items-center gap-1">
              <div className="size-16 rounded-[var(--radius-md)] border-[3px] border-[var(--color-ink)] bg-white shadow-[var(--shadow-sticker)]" />
              <span className="t-xs">sticker</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="size-16 rounded-[var(--radius-md)] border-[3px] border-[var(--color-ink)] bg-white shadow-[var(--shadow-block)]" />
              <span className="t-xs">block</span>
            </div>
          </div>
        </Panel>
      </Row>
    </main>
  );
}
