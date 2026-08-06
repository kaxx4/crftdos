import { PosFrame } from "@/components/PosFrame";
import { TabBar } from "@/components/TabBar";

export default function WastePage() {
  return (
    <div className="min-h-dvh flex flex-col">
      <PosFrame kicker="STALL OS · WASTE" title="Waste">
        <div className="border-2 border-dashed border-ink bg-white p-4 text-sm text-neutral-600">
          Waste logging is Phase 3 per PRD §15.
        </div>
      </PosFrame>
      <TabBar />
    </div>
  );
}
