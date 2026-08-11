"use client";
import { RefObject } from "react";
import { BigButton } from "@/components/ui";
import type { Summary } from "../types";

export function ShiftSummaryCard({
  summary,
  canvasRef,
  onShare,
  onDownload,
}: {
  summary: Summary | null;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onShare: () => void;
  onDownload: () => void;
}) {
  if (!summary) return null;
  return (
    <div className="flex flex-col gap-2">
      <canvas ref={canvasRef} className="w-full border-2 border-ink" />
      <div className="grid grid-cols-2 gap-2">
        <BigButton variant="blue" onClick={onShare}>
          SHARE
        </BigButton>
        <BigButton variant="ghost" onClick={onDownload}>
          DOWNLOAD
        </BigButton>
      </div>
    </div>
  );
}
