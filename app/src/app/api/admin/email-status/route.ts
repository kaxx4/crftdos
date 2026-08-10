import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE.admin)?.value;
  return verifySession("admin", token);
}

// PRD §16 item 9, blocking Phase 4: "a verified domain for email, or I drop
// email and ship WhatsApp-only." Not something code can populate — domain
// verification means adding DNS records at your registrar — but this gives
// a straight answer to "is it done yet" instead of making you check the
// Resend dashboard, and read once RESEND_API_KEY exists in .env.local.
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return NextResponse.json({
      configured: false,
      message: "RESEND_API_KEY is not set in .env.local. Email delivery is off; WhatsApp and on-screen still work.",
    });
  }

  const res = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${key}` },
  }).catch(() => null);

  if (!res || !res.ok) {
    return NextResponse.json({
      configured: true,
      reachable: false,
      message: "RESEND_API_KEY is set but the Resend API call failed — check the key is valid.",
    });
  }

  const body = await res.json();
  type Domain = { id: string; name: string; status: string; region: string };
  const domains: Domain[] = body.data || [];
  const verified = domains.filter((d) => d.status === "verified");

  return NextResponse.json({
    configured: true,
    reachable: true,
    domains: domains.map((d) => ({ name: d.name, status: d.status })),
    verifiedCount: verified.length,
    message:
      domains.length === 0
        ? "No domains added in Resend yet. Add one at resend.com/domains, then add the DNS records it gives you."
        : verified.length > 0
        ? `${verified.length} domain(s) verified — email delivery can be wired in.`
        : `${domains.length} domain(s) added but none verified yet — add the DNS records Resend's dashboard shows for each.`,
  });
}
