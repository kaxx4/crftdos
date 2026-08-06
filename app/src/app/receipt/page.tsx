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
      router.replace("/");
      return;
    }
    setData(JSON.parse(raw));
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
          <div className="font-extrabold text-[9px] tracking-[0.2em] mt-1">
            TERRAROOTS FOUNDATION · LEGAL NAME PENDING (PRD §16.5)
          </div>
        </div>
        <div className="h-2 bg-blue mx-4" />
        <div className="px-4 pb-4 pt-1 flex flex-col gap-2.5">
          <div className="flex justify-between font-mono text-[11px]">
            <span>{data.receipt_no}</span>
            <span>{new Date(data.clientCreatedAt).toLocaleString("en-IN")}</span>
          </div>
          <div className="font-mono text-[11px] text-neutral-600">{data.shiftName}</div>
          {!data.synced && (
            <div className="bg-signal text-ink p-2 font-extrabold text-[10px] tracking-wide uppercase">
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
                  <div className="font-mono text-[10px] text-neutral-600">
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
            <span className="font-extrabold text-[9px] tracking-[0.14em] max-w-[14ch]">RAISED FOR AQUATERRA</span>
            <span className="font-extrabold text-2xl">₹{raised}</span>
          </div>
          <div className="text-[11px] text-neutral-700 leading-relaxed">
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
          className="bg-blue text-cream border-2 border-ink font-extrabold text-[11px] tracking-wide min-h-[52px] flex items-center justify-center"
        >
          SEND ON WHATSAPP
        </a>
        <button
          disabled
          title="Email delivery is Phase 4 (needs a verified sending domain — PRD §16.9)"
          className="bg-cream text-neutral-400 border-2 border-ink font-extrabold text-[11px] tracking-wide min-h-[52px]"
        >
          EMAIL (PHASE 4)
        </button>
      </div>
      <BigButton variant="ghost" onClick={() => router.push("/")}>
        NEXT CUSTOMER
      </BigButton>
    </PosFrame>
  );
}
