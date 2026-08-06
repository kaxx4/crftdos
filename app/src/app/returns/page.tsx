import { PosFrame } from "@/components/PosFrame";
import { TabBar } from "@/components/TabBar";

export default function ReturnsPage() {
  return (
    <div className="min-h-dvh flex flex-col">
      <PosFrame kicker="STALL OS · RETURNS" title="Returns">
        <div className="border-2 border-dashed border-ink bg-white p-4 text-sm text-neutral-600">
          Returns & exchanges are Phase 3 per PRD §15.
        </div>
      </PosFrame>
      <TabBar />
    </div>
  );
}
