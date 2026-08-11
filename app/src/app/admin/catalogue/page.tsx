"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Design = { id: string; code: string; name: string | null; bin_location: string | null };
type ImportResult = { code: string; status: "created" | "updated" | "error"; error?: string };
type CutoutResult = { file: string; code: string; status: "ok" | "error"; error?: string };

const CSV_TEMPLATE =
  "code,name,size_class,stock_qty,unit_cost,unit_price,bin_location,print_w_cm,print_h_cm,tags\n" +
  "M-014,Ramen Bowl,M,10,60,149,Box 2 / Tab M / 011-020,14,14,anime|food\n";

export default function CataloguePage() {
  const [designs, setDesigns] = useState<Design[]>([]);
  const [qrs, setQrs] = useState<Record<string, string>>({});

  const [csvText, setCsvText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[] | null>(null);
  const [importErr, setImportErr] = useState("");

  const [uploading, setUploading] = useState(false);
  const [cutoutResults, setCutoutResults] = useState<CutoutResult[] | null>(null);

  async function load() {
    const j = await fetch("/api/admin/pricing").then((r) => r.json());
    const ds: Design[] = j.designs || [];
    setDesigns(ds);
    const entries = await Promise.all(
      ds.map(async (d) => [d.id, await QRCode.toDataURL(`crftd:s:${d.code}`, { margin: 0, width: 120 })] as const)
    );
    setQrs(Object.fromEntries(entries));
  }
  useEffect(() => {
    load();
  }, []);

  async function runImport() {
    if (!csvText.trim()) return;
    setImporting(true);
    setImportErr("");
    setImportResults(null);
    const res = await fetch("/api/admin/catalogue/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv: csvText }),
    });
    const j = await res.json();
    setImporting(false);
    if (!res.ok) {
      setImportErr(j.error || "Import failed");
      return;
    }
    setImportResults(j.results);
    await load();
  }

  async function uploadCutouts(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setCutoutResults(null);
    const fd = new FormData();
    for (const f of Array.from(files)) fd.append("files", f);
    const res = await fetch("/api/admin/catalogue/cutouts", { method: "POST", body: fd });
    const j = await res.json();
    setUploading(false);
    setCutoutResults(j.results || null);
    await load();
  }

  return (
    <div className="min-h-dvh bg-cream text-ink p-6 flex flex-col gap-8">
      <h1 className="sr-only">Catalogue</h1>
      <div className="print:hidden flex flex-col gap-8 w-full max-w-[1400px]">
        <div>
          <div className="font-extrabold text-lg mb-1">Bulk import sticker designs</div>
          <div className="font-mono text-xs text-muted mb-2">
            Columns needed: code, name, size class, stock, cost, price, bin location. Matched by code — re-import
            the same file after fixing a typo and it updates existing rows instead of creating duplicates.
          </div>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={CSV_TEMPLATE}
            rows={6}
            className="w-full border-2 border-ink p-2 font-mono text-xs"
          />
          <div className="flex gap-2 mt-2 items-center">
            <button
              onClick={runImport}
              disabled={importing || !csvText.trim()}
              className="bg-blue text-cream px-4 py-2 font-extrabold text-sm disabled:opacity-50"
            >
              {importing ? "IMPORTING…" : "IMPORT CSV"}
            </button>
            <button
              onClick={() => setCsvText(CSV_TEMPLATE)}
              className="border-2 border-ink px-4 py-2 font-extrabold text-sm bg-white"
            >
              LOAD TEMPLATE
            </button>
          </div>
          {importErr && <div className="text-signal font-bold text-sm mt-2">{importErr}</div>}
          {importResults && (
            <div className="font-mono text-xs mt-2 max-h-40 overflow-y-auto border-2 border-ink bg-white p-2">
              {importResults.map((r, i) => (
                <div key={i} className={r.status === "error" ? "text-signal" : "text-ok"}>
                  {r.code}: {r.status}
                  {r.error ? ` — ${r.error}` : ""}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="font-extrabold text-lg mb-1">Bulk upload cutout PNGs</div>
          <div className="font-mono text-xs text-muted mb-2">
            Transparent PNGs, named after the design code (e.g. <strong>M-014.png</strong>). Select every file at
            once — each one matches to a design by its filename.
          </div>
          <input type="file" accept="image/png" multiple onChange={(e) => uploadCutouts(e.target.files)} disabled={uploading} />
          {uploading && <div className="font-mono text-xs mt-2">Uploading…</div>}
          {cutoutResults && (
            <div className="font-mono text-xs mt-2 max-h-40 overflow-y-auto border-2 border-ink bg-white p-2">
              {cutoutResults.map((r, i) => (
                <div key={i} className={r.status === "error" ? "text-signal" : "text-ok"}>
                  {r.file}: {r.status}
                  {r.error ? ` — ${r.error}` : ""}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-4 print:hidden">
          <div className="font-extrabold text-lg">Sticker QR label sheet</div>
          <button onClick={() => window.print()} className="bg-blue text-cream px-4 py-2 font-extrabold text-sm">
            PRINT A4 SHEET
          </button>
        </div>
        <div className="font-mono text-xs text-muted mb-4 print:hidden">
          Each QR code links straight to that sticker. Camera scanning at the till stays off until labels are
          printed and it's turned on in Settings.
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 print:grid-cols-3">
          {designs.map((d) => (
            <div key={d.id} className="border-2 border-ink p-2 flex flex-col items-center gap-1 bg-white">
              {qrs[d.id] && <img src={qrs[d.id]} alt="" className="w-20 h-20 max-w-full" />}
              <div className="font-extrabold text-sm font-mono">{d.code}</div>
              <div className="text-[12px] text-muted text-center">{d.bin_location || "Bin not set"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
