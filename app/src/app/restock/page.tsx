"use client";
import { useEffect, useState } from "react";
import { PosFrame } from "@/components/PosFrame";
import { TabBar } from "@/components/TabBar";
import { Mono } from "@/components/ui";

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
    load();
  }, []);

  async function restock(item: Item) {
    const qty = Number(window.prompt(`Restock ${item.code} by how many?`, "10"));
    if (!qty) return;
    await fetch("/api/restock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: item.type, id: item.id, qty }),
    });
    load();
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <PosFrame kicker="STALL OS · RESTOCK" title="Restock">
        <div className="flex gap-1.5">
          <button
            onClick={() => setTab("par")}
            className={`border-2 border-ink px-3 py-2 text-xs font-extrabold ${tab === "par" ? "bg-ink text-cream" : "bg-white"}`}
          >
            BELOW PAR ({belowPar.length})
          </button>
          <button
            onClick={() => setTab("dead")}
            className={`border-2 border-ink px-3 py-2 text-xs font-extrabold ${tab === "dead" ? "bg-ink text-cream" : "bg-white"}`}
          >
            DEAD STOCK ({deadStock.length})
          </button>
        </div>

        {tab === "par" && (
          <div className="flex flex-col gap-1.5">
            {belowPar.map((i) => (
              <div key={i.id} className="border-2 border-signal bg-white p-2.5 flex justify-between items-center">
                <div>
                  <div className="font-extrabold text-sm">{i.code}</div>
                  <Mono>
                    {i.stock} / par {i.par}
                  </Mono>
                </div>
                <button onClick={() => restock(i)} className="bg-blue text-cream text-[10px] font-extrabold px-3 py-2">
                  RESTOCK
                </button>
              </div>
            ))}
            {belowPar.length === 0 && <div className="text-center text-sm text-neutral-600 py-6">Nothing below par.</div>}
          </div>
        )}

        {tab === "dead" && (
          <div className="flex flex-col gap-1.5">
            <div className="font-mono text-[11px] text-neutral-600">
              In stock but zero sales recorded — simplest correct definition, not a real analytics window yet.
            </div>
            {deadStock.map((i) => (
              <div key={i.id} className="border border-ink bg-white p-2 flex justify-between text-sm">
                <span>{i.code}</span>
                <Mono>{i.stock} in stock, 0 sold</Mono>
              </div>
            ))}
            {deadStock.length === 0 && <div className="text-center text-sm text-neutral-600 py-6">No dead stock.</div>}
          </div>
        )}
      </PosFrame>
      <TabBar />
    </div>
  );
}
