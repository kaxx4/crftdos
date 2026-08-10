"use client";
import { useEffect, useRef, useState } from "react";

type Combo = {
  color_id: string;
  fit_id: string;
  colorName: string;
  fitName: string;
  sizes: string[];
  mockup_front: string | null;
  mockup_back: string | null;
  print_area: { front?: Rect; back?: Rect } | null;
};
type Rect = { x: number; y: number; w: number; h: number; cm_w: number; cm_h: number };

// PRD §16 items 7-8, blocking Phase 2: tee mockup photos and print-area
// measurements per colour/fit/side, "the printable rectangle in centimetres
// and where it sits on the mockup." This is the tool that populates them —
// upload a photo, drag a rectangle over the printable area, enter its real
// size in cm. Every SKU sharing that colour+fit gets the result; see the
// API route for why sizes are grouped rather than measured individually.
export default function MockupsPage() {
  const [combos, setCombos] = useState<Combo[]>([]);
  const [selected, setSelected] = useState<Combo | null>(null);
  const [side, setSide] = useState<"front" | "back">("front");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [cmW, setCmW] = useState("30");
  const [cmH, setCmH] = useState("40");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const imgRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  async function load() {
    const j = await fetch("/api/admin/mockups").then((r) => r.json());
    setCombos(j.combos || []);
  }
  useEffect(() => {
    load();
  }, []);

  function select(c: Combo) {
    setSelected(c);
    setSide("front");
    setFile(null);
    setPreviewUrl(null);
    setMsg("");
    const existing = c.print_area?.front;
    setRect(existing ?? null);
    setCmW(existing ? String(existing.cm_w) : "30");
    setCmH(existing ? String(existing.cm_h) : "40");
  }

  function switchSide(s: "front" | "back") {
    setSide(s);
    setFile(null);
    setPreviewUrl(null);
    const existing = selected?.print_area?.[s];
    setRect(existing ?? null);
    setCmW(existing ? String(existing.cm_w) : "30");
    setCmH(existing ? String(existing.cm_h) : "40");
  }

  function onFile(f: File | null) {
    setFile(f);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
  }

  const currentImage = previewUrl || (side === "front" ? selected?.mockup_front : selected?.mockup_back) || null;

  function pct(e: React.PointerEvent) {
    const box = imgRef.current?.getBoundingClientRect();
    if (!box) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(1, (e.clientX - box.left) / box.width)),
      y: Math.max(0, Math.min(1, (e.clientY - box.top) / box.height)),
    };
  }

  function onDown(e: React.PointerEvent) {
    if (!currentImage) return;
    dragStart.current = pct(e);
    setRect((r) => (r ? { ...r, w: 0, h: 0 } : { x: 0, y: 0, w: 0, h: 0, cm_w: Number(cmW) || 0, cm_h: Number(cmH) || 0 }));
  }
  function onMove(e: React.PointerEvent) {
    if (!dragStart.current) return;
    const p = pct(e);
    const x = Math.min(dragStart.current.x, p.x);
    const y = Math.min(dragStart.current.y, p.y);
    const w = Math.abs(p.x - dragStart.current.x);
    const h = Math.abs(p.y - dragStart.current.y);
    setRect({ x, y, w, h, cm_w: Number(cmW) || 0, cm_h: Number(cmH) || 0 });
  }
  function onUp() {
    dragStart.current = null;
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    setMsg("");
    const fd = new FormData();
    fd.set("color_id", selected.color_id);
    fd.set("fit_id", selected.fit_id);
    fd.set("side", side);
    if (file) fd.set("file", file);
    if (rect && rect.w > 0.01 && rect.h > 0.01) {
      fd.set("print_area", JSON.stringify({ ...rect, cm_w: Number(cmW) || 0, cm_h: Number(cmH) || 0 }));
    }
    const res = await fetch("/api/admin/mockups", { method: "POST", body: fd });
    const j = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMsg(j.error || "Save failed");
      return;
    }
    setMsg(`Saved — ${j.skusUpdated} SKU(s) updated.`);
    await load();
    const fresh = (await fetch("/api/admin/mockups").then((r) => r.json())).combos as Combo[];
    const again = fresh.find((c) => c.color_id === selected.color_id && c.fit_id === selected.fit_id);
    if (again) select(again);
  }

  return (
    <div className="min-h-dvh bg-cream text-ink p-4 md:p-8 flex flex-col gap-6 w-full max-w-[1400px] mx-auto">
      <div>
        <div className="font-extrabold text-lg">Tee mockups &amp; print areas</div>
        <div className="font-mono text-xs text-muted mt-1">
          PRD §16.7–8. One mockup + print rectangle per colour/fit/side, applied to every size that shares it.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
        <div className="flex flex-col gap-1.5 max-h-[70vh] overflow-y-auto">
          {combos.map((c) => {
            const done = !!(c.mockup_front && c.mockup_back && c.print_area?.front && c.print_area?.back);
            return (
              <button
                key={`${c.color_id}:${c.fit_id}`}
                onClick={() => select(c)}
                className={`text-left border-2 p-2.5 ${
                  selected?.color_id === c.color_id && selected?.fit_id === c.fit_id
                    ? "border-blue bg-blue/10"
                    : "border-ink bg-white"
                }`}
              >
                <div className="font-extrabold text-sm">
                  {c.colorName} · {c.fitName}
                </div>
                <div className="font-mono text-[11px] text-muted">
                  {c.sizes.join(", ")} · {done ? "complete" : "incomplete"}
                </div>
              </button>
            );
          })}
          {combos.length === 0 && <div className="text-sm text-muted">Loading…</div>}
        </div>

        {selected ? (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              {(["front", "back"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => switchSide(s)}
                  className={`border-2 border-ink px-3 py-2 font-extrabold text-sm ${
                    side === s ? "bg-ink text-cream" : "bg-white"
                  }`}
                >
                  {s.toUpperCase()}
                  {selected.print_area?.[s] ? " ✓" : ""}
                </button>
              ))}
            </div>

            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => onFile(e.target.files?.[0] || null)} />

            {currentImage ? (
              <div
                ref={imgRef}
                className="relative border-2 border-ink bg-white select-none touch-none max-w-[500px]"
                style={{ aspectRatio: "4/5" }}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
              >
                <img src={currentImage} alt={`${selected.colorName} ${selected.fitName} ${side}`} className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
                {rect && rect.w > 0 && rect.h > 0 && (
                  <div
                    className="absolute border-2 border-dashed border-blue bg-blue/10 pointer-events-none"
                    style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` }}
                  />
                )}
                <div className="absolute bottom-1 left-1 right-1 bg-ink/80 text-cream text-[10px] font-mono px-1.5 py-1 pointer-events-none">
                  Drag to mark the printable area
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-hairline p-8 text-center text-sm text-muted max-w-[500px]">
                No {side} mockup yet — choose a file above.
              </div>
            )}

            <div className="flex gap-2 max-w-[300px]">
              <label className="flex-1 flex flex-col gap-1">
                <span className="text-xs font-bold">Print width (cm)</span>
                <input value={cmW} onChange={(e) => setCmW(e.target.value)} className="border-2 border-ink p-2" />
              </label>
              <label className="flex-1 flex flex-col gap-1">
                <span className="text-xs font-bold">Print height (cm)</span>
                <input value={cmH} onChange={(e) => setCmH(e.target.value)} className="border-2 border-ink p-2" />
              </label>
            </div>

            {msg && <div className="font-mono text-xs">{msg}</div>}
            <button
              onClick={save}
              disabled={saving}
              className="bg-blue text-cream px-4 py-3 font-extrabold text-sm disabled:opacity-50 max-w-[300px]"
            >
              {saving ? "SAVING…" : "SAVE"}
            </button>
          </div>
        ) : (
          <div className="text-sm text-muted">Pick a colour/fit combination to start.</div>
        )}
      </div>
    </div>
  );
}
