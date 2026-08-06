import { PosFrame } from "@/components/PosFrame";
import { TabBar } from "@/components/TabBar";

export default function RestockPage() {
  return (
    <div className="min-h-dvh flex flex-col">
      <PosFrame kicker="STALL OS · RESTOCK" title="Restock">
        <div className="border-2 border-dashed border-ink bg-white p-4 text-sm text-neutral-600">
          Restock queue, print queue and dead-stock views are Phase 3 (PRD §15). Stock counts can already be
          corrected from <strong>Stock → Products/Stickers</strong>.
        </div>
      </PosFrame>
      <TabBar />
    </div>
  );
}
