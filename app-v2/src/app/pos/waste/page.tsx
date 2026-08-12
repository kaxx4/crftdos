import { PosShell } from "@/features/pos/PosShell";
import { WasteScreen } from "@/features/pos/WasteScreen";

export default function Page() {
  return (
    <PosShell title="Log waste">
      <WasteScreen />
    </PosShell>
  );
}
