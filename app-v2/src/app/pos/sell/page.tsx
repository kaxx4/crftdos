import { PosShell } from "@/features/pos/PosShell";
import { WalkUpSale } from "@/features/pos/WalkUpSale";

export default function Page() {
  return (
    <PosShell title="Record sale">
      <WalkUpSale />
    </PosShell>
  );
}
