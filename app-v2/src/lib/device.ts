"use client";

/** Device identity and environment binding.
 *
 *  An environment binding is a PERSISTED LOCAL DEVICE SETTING, not a login and
 *  not a session (Fresh Plan §7). An operator picks it once on the settings
 *  page; every read and write from that device then carries it. It is never a
 *  security boundary — it is attribution.
 *
 *  The device id is likewise not a security control. It is the key that ties a
 *  device to its receipt block, which is why clearing browser storage orphans
 *  a device from its block and surfaces as "no receipt numbers left". */

const DEVICE_KEY = "stallos_device_id";
const ENV_KEY = "stallos_environment_id";
const SESSION_KEY = "kiosk_session_id";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = "dev-" + crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

/** The environment this device writes into. Null means unbound — surfaces must
 *  treat that as a blocking, explained state rather than silently defaulting,
 *  because a sale written into the wrong environment is not recoverable from
 *  the UI. */
export function getBoundEnvironmentId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ENV_KEY);
}

export function setBoundEnvironmentId(id: string) {
  localStorage.setItem(ENV_KEY, id);
  // Same-tab listeners don't get `storage`; nudge them explicitly so the
  // environment chip in the corner updates the instant the binding changes.
  window.dispatchEvent(new CustomEvent("stallos:environment"));
}

/** One UUID per customer session, in SESSION storage rather than local: a
 *  fresh tab is a fresh customer. Scopes kiosk hold reservations and is the
 *  join key for interaction analytics. */
export function getKioskSessionId(): string {
  if (typeof window === "undefined") return "server";
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function resetKioskSession(): string {
  sessionStorage.removeItem(SESSION_KEY);
  return getKioskSessionId();
}
