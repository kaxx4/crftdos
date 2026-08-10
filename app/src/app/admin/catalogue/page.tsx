"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Design = { id: string; code: string; name: string | null; bin_location: string | null };

export default function CataloguePage() {
  const [designs, setDesigns] = useState<Design[]>([]);
  const [qrs, setQrs] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/admin/pricing")
      .then((r) => r.json())
      .then(async (j) => {
        const ds: Design[] = j.designs || [];
        setDesigns(ds);
        const entries = await Promise.all(
          ds.map(async (d) => [d.id, await QRCode.toDataURL(`crftd:s:${d.code}`, { margin: 0, width: 120 })] as const)
        );
        setQrs(Object.fromEntries(entries));
      });
  }, []);

  return (
    <div className="min-h-dvh bg-cream text-ink p-6">
      <div className="flex justify-between items-center mb-4 print:hidden">
        <div className="font-extrabold text-lg">Sticker QR label sheet</div>
        <button onClick={() => window.print()} className="bg-blue text-cream px-4 py-2 font-extrabold text-sm">
          PRINT A4 SHEET
        </button>
      </div>
      <div className="font-mono text-xs text-muted mb-4 print:hidden">
        Encodes crftd:s:&lt;code&gt; per PRD §9. Camera scanning stays off by default until labels are printed and a
        settings flag is flipped — not built this pass.
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 print:grid-cols-3">
        {designs.map((d) => (
          <div key={d.id} className="border-2 border-ink p-2 flex flex-col items-center gap-1 bg-white">
            {qrs[d.id] && <img src={qrs[d.id]} alt="" className="w-20 h-20 max-w-full" />}
            <div className="font-extrabold text-sm font-mono">{d.code}</div>
            <div className="text-[10px] text-muted text-center">{d.bin_location || "no bin set"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
