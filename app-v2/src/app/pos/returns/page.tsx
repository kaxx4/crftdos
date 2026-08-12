import { PosShell } from "@/features/pos/PosShell";
import { ReturnsScreen } from "@/features/pos/ReturnsScreen";

export default function Page() {
  return (
    <PosShell title="Returns">
      <ReturnsScreen />
    </PosShell>
  );
}
