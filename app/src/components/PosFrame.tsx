"use client";
import { ReactNode } from "react";
import { CropCorner } from "./ui";

export function PosFrame({
  kicker,
  title,
  meta,
  children,
  banner,
}: {
  kicker: string;
  title: string;
  meta?: ReactNode;
  children: ReactNode;
  banner?: ReactNode;
}) {
  return (
    <div className="min-h-dvh flex justify-center bg-ink">
      <div className="w-full max-w-[480px] min-h-dvh bg-cream text-ink flex flex-col shadow-[0_0_0_1px_#000]">
        <div className="relative bg-blue text-cream px-3.5 pt-3 pb-2.5">
          <CropCorner />
          <div className="flex justify-between items-start gap-2">
            <div>
              {/* Was 9px at opacity-75, which measured ~4.5:1 on the blue band
                  — fine indoors, unreadable in the direct sunlight PRD §11
                  names as a design constraint. Full opacity at 11px clears
                  the 7:1 target the same section asks for. */}
              <div className="font-extrabold text-[11px] tracking-[0.18em]">{kicker}</div>
              <h1 className="font-extrabold text-2xl leading-tight tracking-wide">{title}</h1>
            </div>
            {meta && <div className="text-right font-mono text-[12px] leading-relaxed">{meta}</div>}
          </div>
        </div>
        {banner}
        <main className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-3.5">{children}</main>
      </div>
    </div>
  );
}
