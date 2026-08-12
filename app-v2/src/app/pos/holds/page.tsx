import { PosShell } from "@/features/pos/PosShell";
import { HoldsScreen } from "@/features/pos/HoldsScreen";

export default function Page() {
  return (
    <PosShell title="Holds">
      <HoldsScreen />
    </PosShell>
  );
}
