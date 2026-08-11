import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE, type SessionKind } from "./session";

/** Every route handler that touches `supabaseAdmin()` must call this first.
 *  This IS the auth boundary — middleware passes `/api/*` straight through,
 *  so a handler that skips this check is a full database breach, not a UX
 *  bug (see HANDOFF doc). Returns the verified session payload, or an
 *  already-built 401 NextResponse the caller should return immediately. */
export async function requireSession(
  req: NextRequest,
  kind: SessionKind
): Promise<{ ok: true; deviceId?: string } | { ok: false; response: NextResponse }> {
  const token = req.cookies.get(SESSION_COOKIE[kind])?.value;
  const session = await verifySession(kind, token);
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorised" }, { status: 401 }) };
  }
  return { ok: true, deviceId: typeof session.deviceId === "string" ? session.deviceId : undefined };
}

/** Accepts either a stall or an admin session — used by surfaces both roles
 *  can reach (e.g. order actions on the POS board). */
export async function requireAnySession(
  req: NextRequest,
  kinds: SessionKind[]
): Promise<{ ok: true; kind: SessionKind } | { ok: false; response: NextResponse }> {
  for (const kind of kinds) {
    const token = req.cookies.get(SESSION_COOKIE[kind])?.value;
    const session = await verifySession(kind, token);
    if (session) return { ok: true, kind };
  }
  return { ok: false, response: NextResponse.json({ error: "Unauthorised" }, { status: 401 }) };
}

export function pgErrorCode(e: unknown): string | undefined {
  if (e && typeof e === "object" && "code" in e) return String((e as { code: unknown }).code);
  return undefined;
}

export function errorMessage(e: unknown): string {
  if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  return e instanceof Error ? e.message : "Server error";
}
