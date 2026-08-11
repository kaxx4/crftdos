import { PosShell } from "@/features/pos/PosShell";
import { Board } from "@/features/pos/Board";

export default function Page() {
  return (
    <PosShell title="Board">
      <Board />
    </PosShell>
  );
}
