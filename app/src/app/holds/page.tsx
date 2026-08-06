import { PosFrame } from "@/components/PosFrame";
import { TabBar } from "@/components/TabBar";

export default function HoldsPage() {
  return (
    <div className="min-h-dvh flex flex-col">
      <PosFrame kicker="STALL OS · HOLDS" title="Holds">
        <div className="border-2 border-dashed border-ink bg-white p-4 text-sm text-neutral-600">
          Holds (reserve-by-name, 2h expiry) are Phase 3 per PRD §15.
        </div>
      </PosFrame>
      <TabBar />
    </div>
  );
}
