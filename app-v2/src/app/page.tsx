import { redirect } from "next/navigation";

/** The kiosk is the site root and is PUBLIC — no PIN.
 *
 *  It is the only surface an unauthenticated visitor should ever land on, and
 *  it is the same URL whether it is running on a tablet at a physical stall or
 *  opened from a shared link. There is no separate "online mode" build: the
 *  device's environment binding is what distinguishes a stall kiosk from a
 *  remote one, exactly as it does for every other device.
 *
 *  The screens themselves live under /kiosk rather than here, and this is
 *  load-bearing rather than tidiness: the flow holds live stock reservations,
 *  and the provider that owns their lifetime sits in the kiosk subtree's
 *  layout so it survives navigation between steps. A layout at THIS level
 *  would be the root layout, and POS and admin would inherit it too. So the
 *  public entry point stays here and the subtree owns its own session. */
export default function Page() {
  redirect("/kiosk");
}
