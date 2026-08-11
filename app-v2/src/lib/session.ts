import { SignJWT, jwtVerify } from "jose";

export type SessionKind = "stall" | "admin" | "kiosk";

const secretKey = () => {
  const s = process.env.PIN_SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error("PIN_SESSION_SECRET missing or too short — set it in .env.local");
  }
  return new TextEncoder().encode(s);
};

export const SESSION_COOKIE: Record<SessionKind, string> = {
  stall: "stallos_stall_session",
  admin: "stallos_admin_session",
  kiosk: "stallos_kiosk_session",
};

const TTL_SECONDS: Record<SessionKind, number> = {
  stall: 60 * 60 * 14, // one long shift
  admin: 60 * 60 * 4,
  kiosk: 60 * 60 * 14,
};

export async function signSession(kind: SessionKind, deviceId?: string) {
  return await new SignJWT({ kind, deviceId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + TTL_SECONDS[kind])
    .sign(secretKey());
}

export async function verifySession(kind: SessionKind, token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.kind !== kind) return null;
    return payload;
  } catch {
    return null;
  }
}

export function cookieMaxAge(kind: SessionKind) {
  return TTL_SECONDS[kind];
}
