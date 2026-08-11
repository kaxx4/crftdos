import { Banner } from "@/components/ui";

export function StatusBanners({
  online,
  pendingOutbox,
  catalogueAge,
  blockJoinFailed,
}: {
  online: boolean;
  pendingOutbox: number;
  catalogueAge: string | null;
  blockJoinFailed: boolean;
}) {
  return (
    <>
      {!online && (
        <Banner tone="signal">
          <span>You&apos;re offline — sales are saved on this phone and will send once you&apos;re back online</span>
          <span>{pendingOutbox} queued</span>
        </Banner>
      )}
      {online && pendingOutbox > 0 && (
        <Banner tone="blue">
          <span>Sending queued sales…</span>
          <span>{pendingOutbox} pending</span>
        </Banner>
      )}
      {catalogueAge && (
        // Selling from a cached catalogue is fine; selling from one without
        // knowing it is not. Stock counts shown here predate whatever the
        // other devices have sold since.
        <Banner tone="signal">
          <span>Showing saved stock counts — may be a few sales behind</span>
          <span>{catalogueAge}</span>
        </Banner>
      )}
      {blockJoinFailed && (
        <Banner tone="signal">
          <span>This phone can&apos;t print receipt numbers yet</span>
          <span>reload the page, or ask another volunteer to help</span>
        </Banner>
      )}
    </>
  );
}
