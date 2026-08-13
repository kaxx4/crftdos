import { NextResponse } from "next/server";

// PIN auth removed — the device-level role toggle (Volunteer / Kiosk /
// Admin) now controls which view renders, with no credential gate.
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts).*)"],
};
