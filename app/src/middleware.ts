import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

// Route guards. Kiosk is a fully separate locked surface; admin needs its
// own PIN even for someone already inside the stall session; the stall
// session covers Sell/Orders/Stock/Restock and everything under /.
const PUBLIC_PATHS = ["/pin", "/api/auth/pin", "/_next", "/favicon.ico", "/fonts"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    // API routes do their own auth checks per-handler.
    return NextResponse.next();
  }

  if (pathname.startsWith("/kiosk")) {
    const token = req.cookies.get(SESSION_COOKIE.kiosk)?.value;
    const session = await verifySession("kiosk", token);
    if (!session) {
      return NextResponse.redirect(new URL("/pin?kind=kiosk&next=/kiosk", req.url));
    }
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
