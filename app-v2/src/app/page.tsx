import { KioskApp } from "@/features/kiosk/KioskApp";

/** The kiosk sits at the site root and is PUBLIC — no PIN.
 *
 *  It is the only surface an unauthenticated visitor should ever land on, and
 *  it is the same URL whether it is running on a tablet at a physical stall or
 *  opened from a shared link. There is no separate "online mode" build: the
 *  device's environment binding is what distinguishes a stall kiosk from a
 *  remote one, exactly as it does for every other device. */
export default function Page() {
  return <KioskApp />;
}
