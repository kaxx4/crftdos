import { PosShell } from "@/features/pos/PosShell";
import { StockScreen } from "@/features/pos/StockScreen";

export default function Page() {
  return (
    <PosShell title="Stock at this stall">
      <StockScreen />
    </PosShell>
  );
}
