import { PosShell } from "@/features/pos/PosShell";
import { OrdersLog } from "@/features/pos/OrdersLog";

export default function Page() {
  return (
    <PosShell title="Orders">
      <OrdersLog />
    </PosShell>
  );
}
