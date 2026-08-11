import { BigButton, Field, PanelLabel } from "@/components/ui";

export function AdminPinModal({
  adminPinValue,
  setAdminPinValue,
  adminPinErr,
  submitAdminPin,
  close,
}: {
  adminPinValue: string;
  setAdminPinValue: (v: string) => void;
  adminPinErr: string;
  submitAdminPin: () => void;
  close: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-cream border-2 border-ink p-4 w-full max-w-xs flex flex-col gap-3">
        <PanelLabel>This discount needs an admin&apos;s PIN</PanelLabel>
        <Field
          label="Admin PIN"
          type="password"
          value={adminPinValue}
          onChange={(e) => setAdminPinValue(e.target.value)}
          autoFocus
        />
        {adminPinErr && <div className="text-signal text-xs font-bold">{adminPinErr}</div>}
        <div className="flex gap-2">
          <BigButton variant="blue" className="flex-1" onClick={submitAdminPin}>
            UNLOCK
          </BigButton>
          <BigButton variant="ghost" className="flex-1" onClick={close}>
            CANCEL
          </BigButton>
        </div>
      </div>
    </div>
  );
}
