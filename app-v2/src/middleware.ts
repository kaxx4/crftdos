import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

// Route guards. "/" is the kiosk, now staff-operated (not a public
// self-serve showcase) and gated behind the kiosk PIN. Everything under
// /pos is the stall (volunteer) surface and needs the stall PIN. /admin
// needs its own PIN even for someone already inside the stall session.
// "/settings" binds a device to an environment. It must be reachable before
// any PIN exists for that device, so it stays public on every surface.
const PUBLIC_PATHS = ["/pin", "/settings", "/api/auth/pin", "/api/auth/verify", "/_next", "/favicon.ico", "/fonts"];

// Any request for a static file under /public (mockups, sticker cutouts,
// manifest, etc.) must never be caught by the PIN gate — an unauthenticated
// <img> request redirected to the PIN HTML page fails to render as an image.
const STATIC_FILE = /\.(svg|png|jpe?g|webp|gif|ico|css|js|json|txt|woff2?|ttf|webmanifest)$/i;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p)) || STATIC_FILE.test(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    // API routes do their own auth checks per-handler. This IS the auth
    // boundary for the service-role client — every handler must call
    // verifySession itself. See HANDOFF doc: forgetting this is a full
    // database breach, not a UX bug.
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    const token = req.cookies.get(SESSION_COOKIE.admin)?.value;
    const session = await verifySession("admin", token);
    if (!session) {
      return NextResponse.redirect(new URL(`/pin?kind=admin&next=${pathname}`, req.url));
    }
    return NextResponse.next();
  }

  if (pathname === "/") {
    const token = req.cookies.get(SESSION_COOKIE.kiosk)?.value;
    const session = await verifySession("kiosk", token);
    if (!session) {
      return NextResponse.redirect(new URL(`/pin?kind=kiosk&next=${pathname}`, req.url));
    }
    return NextResponse.next();
  }

  // Everything else (/pos, /settings) is the stall (volunteer) surface.
  const token = req.cookies.get(SESSION_COOKIE.stall)?.value;
  const session = await verifySession("stall", token);
  if (!session) {
    return NextResponse.redirect(new URL(`/pin?kind=stall&next=${pathname}`, req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts).*)"],
};
