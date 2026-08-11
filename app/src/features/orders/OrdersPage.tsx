"use client";
import { useState } from "react";
import { PosFrame } from "@/components/PosFrame";
import { TabBar } from "@/components/TabBar";
import { Banner } from "@/components/ui";
import { PressQueue } from "@/components/PressQueue";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FirstRunHint } from "@/components/FirstRunHint";
import { Collections } from "@/components/Collections";

import { useOrdersBoot } from "./hooks/useOrdersBoot";
import { useOrderFulfillment } from "./hooks/useOrderFulfillment";
import { useShiftClose } from "./hooks/useShiftClose";

import { QueueTabs } from "./components/QueueTabs";
import { OrderList } from "./components/OrderList";
import { CloseShiftPanel } from "./components/CloseShiftPanel";
import { ShiftSummaryCard } from "./components/ShiftSummaryCard";

/** Orchestrator: composes hooks, renders layout, owns only the press/
 *  collections tab selection — everything else lives in the hooks below. */
export function OrdersPage() {
  const { shift, orders, setOrders } = useOrdersBoot();
  const [tab, setTab] = useState<"press" | "collections">("press");

  const fulfillment = useOrderFulfillment(setOrders);
  const shiftClose = useShiftClose(shift);

  const pending = orders.filter((o) => o.fulfillment_status === "pending_press" && !o.voided_at);
  const collecting = orders.filter((o) => o.fulfillment_status === "collect_later" && !o.voided_at);

  return (
    <div className="contents">
      <PosFrame helpTopic="close" nav={<TabBar />} kicker="STALL OS · ORDERS" title="Orders">
        <QueueTabs
          tab={tab}
          setTab={setTab}
          pendingCount={pending.length}
          collectingCount={collecting.length}
        />
        {/* Pending items pin to the top with a live wait timer and the press
            sheet the heat-press operator actually works from. */}
        <FirstRunHint
          id="orders"
          title="What this screen is for"
          points={[
            "Anything waiting to be pressed is pinned at the top, oldest first, with how long it's been waiting.",
            "The press sheet shows exactly where each sticker goes — that's what the person on the heat press works from.",
            "Charged the wrong thing? Find the receipt number below and tap VOID. Stock goes back automatically.",
          ]}
        />
        {fulfillment.fulfilErr && (
          <Banner tone="signal" transient>
            <span>{fulfillment.fulfilErr}</span>
          </Banner>
        )}
        {tab === "press" ? (
          <PressQueue
            orders={pending}
            onPress={fulfillment.pressOrder}
            onHandOver={fulfillment.handOverOrder}
            busyId={fulfillment.fulfilBusy}
          />
        ) : (
          <Collections orders={collecting} onCollect={fulfillment.collectOrder} busyId={fulfillment.fulfilBusy} />
        )}

        <OrderList orders={orders} onVoid={fulfillment.setVoidTarget} />

        <CloseShiftPanel
          countedCash={shiftClose.countedCash}
          setCountedCash={shiftClose.setCountedCash}
          closing={shiftClose.closing}
          setClosing={shiftClose.setClosing}
          closeBlockedErr={shiftClose.closeBlockedErr}
          closeResult={shiftClose.closeResult}
          onClose={shiftClose.closeShift}
        />

        <ShiftSummaryCard
          summary={shiftClose.summary}
          canvasRef={shiftClose.canvasRef}
          onShare={shiftClose.shareSummary}
          onDownload={shiftClose.downloadSummary}
        />

        <ConfirmDialog
          open={!!fulfillment.voidTarget}
          title="Void this sale?"
          body={
            fulfillment.voidTarget
              ? `${fulfillment.voidTarget.receipt_no} for ₹${fulfillment.voidTarget.total} will be cancelled and every item on it goes back into stock. The receipt number stays used — that's deliberate, so the numbering has no gaps.`
              : ""
          }
          confirmLabel="VOID SALE"
          reasonLabel="Why is this being voided?"
          onConfirm={fulfillment.confirmVoid}
          onCancel={() => fulfillment.setVoidTarget(null)}
        />
      </PosFrame>
    </div>
  );
}
