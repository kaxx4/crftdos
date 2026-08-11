"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PosFrame } from "@/components/PosFrame";
import { BigButton } from "@/components/ui";

type ReceiptItem = {
  product_sku_id: string | null;
  qty: number;
  unit_price: number;
  stickers: { code?: string; description?: string; unit_price: number }[];
};

type ReceiptData = {
  receipt_no: string;
  synced: boolean;
  shiftName: string;
  items: ReceiptItem[];
  subtotal: number;
  discountAmount: number;
  discountReason?: string;
  total: number;
  paymentMethod: string;
  clientCreatedAt: string;
};

export default function ReceiptPage() {
  const router = useRouter();
  const [data, setData] = useState<ReceiptData | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("last_receipt");
    if (!raw) {
      router.replace("/sell");
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a one-shot sessionStorage handoff, not a value derivable from render
      setData(parsed);
    } catch {
      sessionStorage.removeItem("last_receipt");
      router.replace("/sell");
    }
  }, [router]);

  if (!data) return null;

  const raised = data.total; // net-of-cost figure needs COGS; shown as gross here until cost fields are wired end-to-end
  const waNumber = ""; // TerraRoots WhatsApp business number — not supplied yet
  const waText = encodeURIComponent(
    `crftd receipt ${data.receipt_no}\nTotal ₹${data.total}\nThank you for supporting AquaTerra!`
  );

  return (
    <PosFrame kicker="STALL OS · RECEIPT" title="Receipt">
      <div className="relative bg-cream border-2 border-ink">
        <span className="absolute top-1.5 left-1.5 w-3 h-3 border-t-2 border-l-2 border-ink" />
        <span className="absolute top-1.5 right-1.5 w-3 h-3 border-t-2 border-r-2 border-ink" />
        <span className="absolute bottom-1.5 left-1.5 w-3 h-3 border-b-2 border-l-2 border-ink" />
        <span className="absolute bottom-1.5 right-1.5 w-3 h-3 border-b-2 border-r-2 border-ink" />
        <div className="pt-5 px-4 pb-2 text-center">
          <div className="font-extrabold text-4xl tracking-wide text-blue">CRFTD</div>
          {/* This is a document a customer keeps. It previously read
              "LEGAL NAME PENDING (PRD §16.5)" — an internal to-do printed on
              a receipt. The registered legal name and any registration number
              are still outstanding from the client (PRD §16.5); until they
              arrive, show the trading name only rather than advertising the
              gap. Do not put spec references on customer-facing output. */}
          <div className="font-extrabold text-[12px] tracking-[0.2em] mt-1">
            TERRAROOTS FOUNDATION
          </div>
        </div>
        <div className="h-2 bg-blue mx-4" />
        <div className="px-4 pb-4 pt-1 flex flex-col gap-2.5">
          <div className="flex justify-between font-mono text-[13px]">
            <span>{data.receipt_no}</span>
            <span>{new Date(data.clientCreatedAt).toLocaleString("en-IN")}</span>
          </div>
          <div className="font-mono text-[13px] text-muted">{data.shiftName}</div>
          {!data.synced && (
            <div className="bg-signal text-cream p-2 font-extrabold text-[12px] tracking-wide uppercase">
              Offline sale — number confirms once this device syncs
            </div>
          )}
          <div className="border-t-2 border-b-2 border-ink py-2 flex flex-col gap-2">
            {data.items.map((it, i) => (
              <div key={i} className="flex flex-col gap-0.5">
                <div className="flex justify-between text-sm font-bold">
                  <span>{it.product_sku_id ? "Garment" : "Sticker"}</span>
                  <span className="font-extrabold text-base">
                    ₹{it.unit_price + it.stickers.reduce((s, st) => s + st.unit_price, 0)}
                  </span>
                </div>
                {it.stickers.length > 0 && (
                  <div className="font-mono text-[12px] text-muted">
                    {it.stickers.map((s) => s.code || s.description).join(", ")}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1 text-[13px]">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>₹{data.subtotal}</span>
            </div>
            {data.discountAmount > 0 && (
              <div className="flex justify-between text-signal font-bold">
                <span>Discount ({data.discountReason})</span>
                <span>-₹{data.discountAmount}</span>
              </div>
            )}
            <div className="flex justify-between font-extrabold text-base">
              <span>Total ({data.paymentMethod.toUpperCase()})</span>
              <span>₹{data.total}</span>
            </div>
          </div>
          <div className="bg-blue text-cream p-2.5 flex justify-between items-center">
            <span className="font-extrabold text-[12px] tracking-[0.14em] max-w-[14ch]">RAISED FOR AQUATERRA</span>
            <span className="font-extrabold text-2xl">₹{raised}</span>
          </div>
          <div className="text-[13px] text-muted leading-relaxed">
            Proceeds support AquaTerra welfare work. Hand wash recommended. DTF transfers rated 10–15 washes
            minimum. No change-of-mind returns.
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <a
          href={waNumber ? `https://wa.me/${waNumber}?text=${waText}` : `https://wa.me/?text=${waText}`}
          target="_blank"
          rel="noreferrer"
          className="bg-blue text-cream border-2 border-ink font-extrabold text-[13px] tracking-wide min-h-[52px] flex items-center justify-center"
        >
          SEND ON WHATSAPP
        </a>
        {/* Label and tooltip said "EMAIL (PHASE 4)" and cited PRD §16.9 — the
            customer is being shown our roadmap. A disabled control should say
            what the customer can do about it, in their terms, or not appear at
            all. Email needs a verified sending domain before it can work. */}
        <button
          disabled
          title="Emailed receipts aren't set up yet — send on WhatsApp or show this screen."
          className="bg-cream text-muted border-2 border-ink font-extrabold text-[13px] tracking-wide min-h-[52px]"
        >
          EMAIL — NOT AVAILABLE YET
        </button>
      </div>
      <BigButton variant="ghost" onClick={() => router.push("/sell")}>
        NEXT CUSTOMER
      </BigButton>
    </PosFrame>
  );
}
