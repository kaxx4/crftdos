import { PosShell } from "@/features/pos/PosShell";
import { MoreScreen } from "@/features/pos/MoreScreen";

export default function Page() {
  return (
    <PosShell title="More">
      <MoreScreen />
    </PosShell>
  );
}
