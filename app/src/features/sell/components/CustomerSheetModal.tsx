import { BigButton, Field, PanelLabel } from "@/components/ui";

export function CustomerSheetModal({
  collectLater,
  customerName,
  setCustomerName,
  customerPhone,
  setCustomerPhone,
  customerEmail,
  setCustomerEmail,
  customerConsent,
  setCustomerConsent,
  promisedDate,
  setPromisedDate,
  customerErr,
  charging,
  total,
  charge,
  skip,
  close,
}: {
  collectLater: boolean;
  customerName: string;
  setCustomerName: (v: string) => void;
  customerPhone: string;
  setCustomerPhone: (v: string) => void;
  customerEmail: string;
  setCustomerEmail: (v: string) => void;
  customerConsent: boolean;
  setCustomerConsent: (v: boolean) => void;
  promisedDate: string;
  setPromisedDate: (v: string) => void;
  customerErr: string;
  charging: boolean;
  total: number;
  charge: () => void;
  skip: () => void;
  close: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={collectLater ? "Collection details, required" : "Customer details"}
        onClick={(e) => e.stopPropagation()}
        className="bg-cream border-2 border-ink p-4 w-full max-w-sm flex flex-col gap-3 max-h-[85dvh] overflow-y-auto"
      >
        <PanelLabel>Step 7 · {collectLater ? "Collection details (required)" : "Customer details"}</PanelLabel>
        {collectLater && (
          <div className="bg-signal text-cream p-2 font-extrabold text-[12px] tracking-wide uppercase">
            This includes a custom sticker or kiosk design — since it&apos;s not ready today, we need a way to
            reach the customer when it is.
          </div>
        )}
        <Field label="Customer name" placeholder="Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        <Field
          label="Customer phone"
          placeholder={collectLater ? "Phone (required)" : "Phone"}
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)}
        />
        <Field label="Customer email" placeholder="Email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
        {collectLater && (
          <Field
            label="Promised collection date"
            type="date"
            value={promisedDate}
            onChange={(e) => setPromisedDate(e.target.value)}
          />
        )}
        <label className="flex items-center gap-2 text-xs font-bold min-h-[48px]">
          <input
            type="checkbox"
            checked={customerConsent}
            onChange={(e) => setCustomerConsent(e.target.checked)}
            className="w-5 h-5"
          />
          OK to text updates and offers?
        </label>
        {customerErr && <div className="text-signal text-xs font-bold">{customerErr}</div>}
        <div className="flex gap-2">
          <BigButton variant="blue" className="flex-1" onClick={charge}>
            {charging ? "CHARGING…" : `CHARGE ₹${total}`}
          </BigButton>
          {!collectLater && (
            <BigButton variant="ghost" className="flex-1" onClick={skip}>
              SKIP
            </BigButton>
          )}
        </div>
      </div>
    </div>
  );
}
