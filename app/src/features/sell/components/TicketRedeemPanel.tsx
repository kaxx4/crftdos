import { BigButton, Field, Panel, PanelLabel } from "@/components/ui";

export function TicketRedeemPanel({
  ticketCode,
  setTicketCode,
  ticketErr,
  redeemTicket,
  loadingTicket,
}: {
  ticketCode: string;
  setTicketCode: (v: string) => void;
  ticketErr: string;
  redeemTicket: () => void;
  loadingTicket: boolean;
}) {
  return (
    <Panel accent>
      <PanelLabel color="var(--color-blue)">Step 1 · Load a design ticket (optional)</PanelLabel>
      <div className="flex gap-2">
        <Field
          label="Kiosk design ticket code"
          value={ticketCode}
          onChange={(e) => setTicketCode(e.target.value.toUpperCase())}
          placeholder="A7K2"
          className="uppercase tracking-widest font-extrabold text-xl"
        />
        <BigButton variant="blue" onClick={redeemTicket} className="px-4" disabled={loadingTicket}>
          {loadingTicket ? "LOADING…" : "LOAD"}
        </BigButton>
      </div>
      {ticketErr && (
        <div className="bg-signal text-cream p-2 font-extrabold text-[12px] tracking-wide uppercase motion-safe:animate-[pos-enter_var(--dur-pos)_var(--ease-out-strong)_both]">
          {ticketErr}
        </div>
      )}
    </Panel>
  );
}
