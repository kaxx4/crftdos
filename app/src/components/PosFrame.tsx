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
              <div className="font-extrabold text-[9px] tracking-[0.2em] opacity-75">{kicker}</div>
              <h1 className="font-extrabold text-2xl leading-tight tracking-wide">{title}</h1>
            </div>
            {meta && <div className="text-right font-mono text-[10px] leading-relaxed opacity-85">{meta}</div>}
          </div>
        </div>
        {banner}
        <main className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-3.5">{children}</main>
      </div>
    </div>
  );
}
