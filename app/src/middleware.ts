import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

// Route guards. "/" is the kiosk — a public, unauthenticated customer
// showcase, so it needs no PIN at all. Sell moved to /sell and needs the
// stall PIN it used to get for free at the root. Admin needs its own PIN
// even for someone already inside the stall session.
const PUBLIC_PATHS = ["/pin", "/api/auth/pin", "/_next", "/favicon.ico", "/fonts"];
const PUBLIC_EXACT_PATHS = ["/"];

// Any request for a static file under /public (mockups, sticker cutouts,
// manifest, etc.) must never be caught by the PIN gate — that was a real bug:
// unauthenticated <img> requests were getting redirected to the PIN HTML
// page, which the browser then tried (and failed) to render as an image.
const STATIC_FILE = /\.(svg|png|jpe?g|webp|gif|ico|css|js|json|txt|woff2?|ttf|webmanifest)$/i;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    PUBLIC_EXACT_PATHS.includes(pathname) ||
    STATIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    // API routes do their own auth checks per-handler.
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    const token = req.cookies.get(SESSION_COOKIE.admin)?.value;
    const session = await verifySession("admin", token);
    if (!session) {
      return NextResponse.redirect(
        new URL(`/pin?kind=admin&next=${pathname}`, req.url)
      );
    }
    return NextResponse.next();
  }

  // Everything else is the stall (volunteer) surface.
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
