import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const token = req.cookies.get(SESSION_COOKIE.stall)?.value;
  const session = await verifySession("stall", token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await params;
  const admin = supabaseAdmin();
  const { data: ticket } = await admin
    .from("stall_design_tickets")
    .select("*")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (!ticket) return NextResponse.json({ error: "No ticket with that code" }, { status: 404 });
  if (ticket.status !== "open") return NextResponse.json({ error: `Ticket is ${ticket.status}` }, { status: 409 });
  if (new Date(ticket.expires_at) < new Date()) {
    await admin.from("stall_design_tickets").update({ status: "expired" }).eq("id", ticket.id);
    return NextResponse.json({ error: "Ticket expired" }, { status: 409 });
  }

  return NextResponse.json({ ticket });
}
