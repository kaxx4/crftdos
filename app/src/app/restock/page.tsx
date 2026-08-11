"use client";
import { useEffect, useState } from "react";
import { PosFrame } from "@/components/PosFrame";
import { FirstRunHint } from "@/components/FirstRunHint";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TabBar } from "@/components/TabBar";
import { Banner, Mono, PanelLabel } from "@/components/ui";

type Item = { type: "product" | "sticker"; id: string; code: string; stock: number; par?: number };

export default function RestockPage() {
  const [belowPar, setBelowPar] = useState<Item[]>([]);
  const [deadStock, setDeadStock] = useState<Item[]>([]);
  const [tab, setTab] = useState<"par" | "dead">("par");

  async function load() {
    const j = await fetch("/api/restock").then((r) => r.json());
    setBelowPar(j.belowPar || []);
    setDeadStock(j.deadStock || []);
  }
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const j = await fetch("/api/restock").then((r) => r.json());
      if (cancelled) return;
      setBelowPar(j.belowPar || []);
      setDeadStock(j.deadStock || []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // A styled dialog rather than window.prompt: the native one can't say what
  // the number means, and on mobile Safari it can be suppressed outright.
  const [restockTarget, setRestockTarget] = useState<Item | null>(null);
  const [restockErr, setRestockErr] = useState("");

  async function confirmRestock(raw: string) {
    const item = restockTarget;
    setRestockTarget(null);
    const qty = Number(raw);
    if (!item || !Number.isFinite(qty) || qty === 0) return;
    setRestockErr("");
    try {
      const res = await fetch("/api/restock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: item.type, id: item.id, qty }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setRestockErr(j.error || "Couldn't record that — stock is unchanged. Try again.");
        return;
      }
      load();
    } catch {
      setRestockErr("No connection — stock is unchanged. Try again once you're back online.");
    }
  }

  return (
    <div className="contents">
      <PosFrame
        helpTopic="wrong"
        nav={<TabBar />} kicker="VOLUNTEER · RESTOCK" title="Restock">
        <FirstRunHint
          id="restock"
          title="Keeping the shelf full"
          points={[
            "Below par means fewer left than the level set for that item — restock these first.",
            "Dead stock has never sold. Worth moving to the front of the table or discounting.",
            "Adding stock here counts items in; it doesn't record a sale.",
          ]}
        />
        <div className="flex gap-1.5">
          <button
            onClick={() => setTab("par")}
            aria-pressed={tab === "par"}
            className={`border-2 border-ink px-3 min-h-[48px] min-w-[48px] text-[13px] font-extrabold rounded-[var(--radius-pos-sm)] ${tab === "par" ? "bg-ink text-cream" : "bg-white"}`}
          >
            BELOW PAR ({belowPar.length})
          </button>
          <button
            onClick={() => setTab("dead")}
            aria-pressed={tab === "dead"}
            className={`border-2 border-ink px-3 min-h-[48px] min-w-[48px] text-[13px] font-extrabold rounded-[var(--radius-pos-sm)] ${tab === "dead" ? "bg-ink text-cream" : "bg-white"}`}
          >
            DEAD STOCK ({deadStock.length})
          </button>
        </div>

        {tab === "par" && (
          <div className="flex flex-col gap-1.5">
            <PanelLabel>Below par — restock soon</PanelLabel>
            {belowPar.map((i) => (
              <div key={i.id} className="border-2 border-signal bg-white p-2.5 flex justify-between items-center">
                <div>
                  <div className="font-extrabold text-sm">{i.code}</div>
                  <Mono>
                    {i.stock} / par {i.par}
                  </Mono>
                </div>
                <button onClick={() => setRestockTarget(i)} className="bg-blue text-cream text-[13px] font-extrabold px-4 min-h-[48px] min-w-[48px] rounded-[var(--radius-pos-md)] touch-manipulation transition-transform duration-[var(--dur-press)] ease-out active:scale-[0.97]">
                  RESTOCK
                </button>
              </div>
            ))}
            {belowPar.length === 0 && (
              <div className="text-center text-sm text-muted py-6">Everything's stocked — nothing below par.</div>
            )}
          </div>
        )}

        {tab === "dead" && (
          <div className="flex flex-col gap-1.5">
            <PanelLabel>Dead stock — hasn't sold</PanelLabel>
            <div className="font-mono text-[13px] text-muted">
              In stock, but hasn't sold at all in the data we have so far.
            </div>
            {deadStock.map((i) => (
              <div key={i.id} className="border border-ink bg-white p-2 flex justify-between text-sm">
                <span>{i.code}</span>
                <Mono>{i.stock} in stock, 0 sold</Mono>
              </div>
            ))}
            {deadStock.length === 0 && (
              <div className="text-center text-sm text-muted py-6">
                Nothing here — every item in stock has sold at least once. Nice.
              </div>
            )}
          </div>
        )}
        {restockErr && (
          <Banner tone="signal" transient>
            <span>{restockErr}</span>
          </Banner>
        )}
        <ConfirmDialog
          open={!!restockTarget}
          tone="normal"
          title="Add stock"
          body={
            restockTarget
              ? `How many of ${restockTarget.code} are you adding? This is counted in, not sold — it goes straight onto the shelf count.`
              : ""
          }
          confirmLabel="ADD TO STOCK"
          numberLabel="How many?"
          numberDefault="10"
          onConfirm={confirmRestock}
          onCancel={() => setRestockTarget(null)}
        />
      </PosFrame>
    </div>
  );
}
