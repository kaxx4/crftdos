"use client";
import { PosFrame } from "@/components/PosFrame";
import { FirstRunHint } from "@/components/FirstRunHint";
import { TabBar } from "@/components/TabBar";

import { useSellBoot } from "./hooks/useSellBoot";
import { useOutboxStatus } from "./hooks/useOutboxStatus";
import { useCatalogueFilters } from "./hooks/useCatalogueFilters";
import { useCart } from "./hooks/useCart";
import { useStickerSearch } from "./hooks/useStickerSearch";
import { useTicketRedemption } from "./hooks/useTicketRedemption";
import { useDiscountGate } from "./hooks/useDiscountGate";
import { useAdminStepUp } from "./hooks/useAdminStepUp";
import { usePaymentSplit } from "./hooks/usePaymentSplit";
import { useCustomerSheet } from "./hooks/useCustomerSheet";
import { useCharge } from "./hooks/useCharge";

import { TicketRedeemPanel } from "./components/TicketRedeemPanel";
import { CartList } from "./components/CartList";
import { GarmentPicker } from "./components/GarmentPicker";
import { StickerPicker } from "./components/StickerPicker";
import { DiscountPanel } from "./components/DiscountPanel";
import { PaymentPanel } from "./components/PaymentPanel";
import { ChargeFooter } from "./components/ChargeFooter";
import { AdminPinModal } from "./components/AdminPinModal";
import { CustomerSheetModal } from "./components/CustomerSheetModal";
import { UndoToast } from "./components/UndoToast";
import { StatusBanners } from "./components/StatusBanners";

/** Orchestrator: composes hooks, renders layout, owns no business state of
 *  its own. Derived values that span multiple hooks (subtotal, total,
 *  cartHasFulfillmentTrigger) are computed by the hooks that need them and
 *  threaded through as plain arguments — see the Component Architecture
 *  doc's ownership map for why nothing here reaches into a store. */
export function SellPage() {
  const boot = useSellBoot();
  const outboxStatus = useOutboxStatus();

  const catalogueFilters = useCatalogueFilters(boot.skus, boot.initialColorId, boot.initialFitId);
  const cart = useCart(boot.colors, boot.fits);
  const ticket = useTicketRedemption(cart.addTicketGarments);
  const stickerSearch = useStickerSearch(
    boot.designs,
    boot.recentCounts,
    boot.setRecentCounts,
    boot.shift,
    cart.addSticker
  );

  const discount = useDiscountGate(cart.subtotal);
  const adminStepUp = useAdminStepUp(discount.needsAdminGate);
  const total = Math.max(0, cart.subtotal - discount.discountAmount);
  const paymentSplit = usePaymentSplit(total);
  const customerSheet = useCustomerSheet(cart.cartHasFulfillmentTrigger, boot.shift?.press_on_site);

  const charge = useCharge({
    shift: boot.shift,
    block: boot.block,
    setBlock: boot.setBlock,
    refreshOutboxCount: outboxStatus.refreshOutboxCount,

    garments: cart.garments,
    standalone: cart.standalone,
    cartEmpty: cart.cartEmpty,
    cartHasFulfillmentTrigger: cart.cartHasFulfillmentTrigger,
    subtotal: cart.subtotal,
    resetCart: cart.resetCart,
    restoreCart: cart.restore,

    discountAmt: discount.discountAmt,
    discountPct: discount.discountPct,
    discountAmount: discount.discountAmount,
    discountReason: discount.discountReason,
    resetDiscount: discount.resetDiscount,
    restoreDiscount: discount.restoreDiscount,

    needsAdminGate: discount.needsAdminGate,
    discountUnlocked: adminStepUp.discountUnlocked,
    adminPinValue: adminStepUp.adminPinValue,
    setAdminPinPrompt: adminStepUp.setAdminPinPrompt,
    resetAdminStepUp: adminStepUp.resetAdminStepUp,

    payment: paymentSplit.payment,
    setPayment: paymentSplit.setPayment,
    cashAmt: paymentSplit.cashAmt,
    setCashAmt: paymentSplit.setCashAmt,
    upiAmt: paymentSplit.upiAmt,
    setUpiAmt: paymentSplit.setUpiAmt,
    splitOk: paymentSplit.splitOk,
    resetPayment: paymentSplit.resetPayment,

    collectLater: customerSheet.collectLater,
    promisedDate: customerSheet.promisedDate,
    customerName: customerSheet.customerName,
    customerPhone: customerSheet.customerPhone,
    customerEmail: customerSheet.customerEmail,
    customerConsent: customerSheet.customerConsent,
    setCustomerErr: customerSheet.setCustomerErr,
    setCustomerSheetOpen: customerSheet.setCustomerSheetOpen,
    resetCustomerSheet: customerSheet.resetCustomerSheet,

    redeemedTicketCode: ticket.redeemedTicketCodes[0],
    resetTicketState: ticket.resetTicketState,

    total,
  });

  if (boot.loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-ink text-cream font-mono text-sm">
        Loading stall…
      </div>
    );
  }

  const targetGarment = cart.garments.find((g) => g.key === cart.targetGarmentKey) || null;

  return (
    <div className="contents">
      <PosFrame
        helpTopic="sell"
        nav={<TabBar />}
        footer={
          <ChargeFooter
            total={total}
            cartEmpty={cart.cartEmpty}
            charging={charge.charging}
            splitOk={paymentSplit.splitOk}
            hasShiftAndBlock={!!boot.shift && !!boot.block}
            onCharge={charge.openCharge}
          />
        }
        kicker="STALL OS · SELL"
        title={boot.shift?.name || "Sell"}
        meta={
          <>
            <div>{boot.shift?.venue}</div>
            <div>
              {boot.block
                ? `${boot.block.next_no - boot.block.start_no}/${boot.block.end_no - boot.block.start_no + 1} used`
                : ""}
            </div>
          </>
        }
        banner={
          <StatusBanners
            online={outboxStatus.online}
            pendingOutbox={outboxStatus.pendingOutbox}
            catalogueAge={boot.catalogueAge}
            blockJoinFailed={boot.blockJoinFailed}
          />
        }
      >
        {/* Shown once per device. A volunteer is often handed this phone
            minutes before doors open with no training, and until now the app
            said nothing on first open. Inline and skippable, never a blocking
            overlay — there may already be a customer waiting. */}
        <FirstRunHint
          id="sell"
          title="First time on the till?"
          points={[
            "Work down the screen: pick the garment, then tap the stickers that go on it. The blue outline shows which garment stickers are being added to.",
            "Under each sticker is its bin location, like Box 2 / Tab M — that's the box to physically go and get it from.",
            "If a customer shows you a code or QR from the tablet, scan or type it in Step 1 and their whole design loads.",
          ]}
        />
        <TicketRedeemPanel
          ticketCode={ticket.ticketCode}
          setTicketCode={ticket.setTicketCode}
          ticketErr={ticket.ticketErr}
          redeemTicket={ticket.redeemTicket}
          loadingTicket={ticket.loadingTicket}
        />

        <CartList
          garments={cart.garments}
          standalone={cart.standalone}
          total={total}
          targetGarmentKey={cart.targetGarmentKey}
          setTargetGarmentKey={cart.setTargetGarmentKey}
          removeGarment={cart.removeGarment}
          removeStickerFromGarment={cart.removeStickerFromGarment}
          removeStandalone={cart.removeStandalone}
        />

        <GarmentPicker
          colors={boot.colors}
          fits={boot.fits}
          colorId={catalogueFilters.colorId}
          setColorId={catalogueFilters.setColorId}
          fitId={catalogueFilters.fitId}
          setFitId={catalogueFilters.setFitId}
          sizesForSelection={catalogueFilters.sizesForSelection}
          addGarment={cart.addGarment}
        />

        <StickerPicker
          targetGarmentLabel={targetGarment?.label ?? null}
          stickerQuery={stickerSearch.stickerQuery}
          setStickerQuery={stickerSearch.setStickerQuery}
          sizeFilter={stickerSearch.sizeFilter}
          setSizeFilter={stickerSearch.setSizeFilter}
          recentTop8={stickerSearch.recentTop8}
          designs={boot.designs}
          stickerResults={stickerSearch.stickerResults}
          addSticker={stickerSearch.addSticker}
          addCustomSticker={cart.addCustomSticker}
        />

        <DiscountPanel
          discountAmt={discount.discountAmt}
          setDiscountAmt={discount.setDiscountAmt}
          discountPct={discount.discountPct}
          setDiscountPct={discount.setDiscountPct}
          discountReason={discount.discountReason}
          setDiscountReason={discount.setDiscountReason}
          needsAdminGate={discount.needsAdminGate}
          discountUnlocked={adminStepUp.discountUnlocked}
        />

        <PaymentPanel
          payment={paymentSplit.payment}
          setPayment={paymentSplit.setPayment}
          cashAmt={paymentSplit.cashAmt}
          setCashAmt={paymentSplit.setCashAmt}
          upiAmt={paymentSplit.upiAmt}
          setUpiAmt={paymentSplit.setUpiAmt}
          splitTotal={paymentSplit.splitTotal}
          splitOk={paymentSplit.splitOk}
          total={total}
        />

        <div className="h-2" />
      </PosFrame>

      {adminStepUp.adminPinPrompt && (
        <AdminPinModal
          adminPinValue={adminStepUp.adminPinValue}
          setAdminPinValue={adminStepUp.setAdminPinValue}
          adminPinErr={adminStepUp.adminPinErr}
          submitAdminPin={adminStepUp.submitAdminPin}
          close={() => adminStepUp.setAdminPinPrompt(false)}
        />
      )}

      {customerSheet.customerSheetOpen && (
        <CustomerSheetModal
          collectLater={customerSheet.collectLater}
          customerName={customerSheet.customerName}
          setCustomerName={customerSheet.setCustomerName}
          customerPhone={customerSheet.customerPhone}
          setCustomerPhone={customerSheet.setCustomerPhone}
          customerEmail={customerSheet.customerEmail}
          setCustomerEmail={customerSheet.setCustomerEmail}
          customerConsent={customerSheet.customerConsent}
          setCustomerConsent={customerSheet.setCustomerConsent}
          promisedDate={customerSheet.promisedDate}
          setPromisedDate={customerSheet.setPromisedDate}
          customerErr={customerSheet.customerErr}
          charging={charge.charging}
          total={total}
          charge={charge.charge}
          skip={() => {
            customerSheet.setCustomerName("");
            customerSheet.setCustomerPhone("");
            customerSheet.setCustomerEmail("");
            customerSheet.setCustomerConsent(false);
            charge.charge();
          }}
          close={() => customerSheet.setCustomerSheetOpen(false)}
        />
      )}

      {charge.undo && <UndoToast onUndo={charge.doUndo} />}
    </div>
  );
}
