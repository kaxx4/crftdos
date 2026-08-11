import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAnySession } from "@/lib/apiAuth";

export async function GET(req: NextRequest) {
  const auth = await requireAnySession(req, ["stall", "admin"]);
  if (!auth.ok) return auth.response;

  const environmentId = req.nextUrl.searchParams.get("environment_id");

  const admin = supabaseAdmin();
  let q = admin.from("stall_kiosk_events").select("session_id, environment_id, event, detail").limit(20000);
  if (environmentId) q = q.eq("environment_id", environmentId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Ev = { session_id: string; event: string; detail: Record<string, unknown> | null };
  const ev = (data ?? []) as Ev[];

  const sessions = new Set(ev.map((e) => e.session_id));
  const completed = new Set(ev.filter((e) => e.event === "order_completed").map((e) => e.session_id));

  const stageOrder = ["storefront", "canvas", "order", "done"];
  const funnel = stageOrder.map((stage) => ({
    stage,
    sessions: new Set(
      ev.filter((e) => e.event === "stage_entered" && e.detail?.stage === stage).map((e) => e.session_id)
    ).size,
  }));

  const picks = new Map<string, number>();
  for (const e of ev) if (e.event === "sticker_placed" && typeof e.detail?.code === "string") picks.set(e.detail.code as string, (picks.get(e.detail.code as string) ?? 0) + 1);

  const opens = new Map<string, number>();
  for (const e of ev) if (e.event === "template_opened" && typeof e.detail?.name === "string") opens.set(e.detail.name as string, (opens.get(e.detail.name as string) ?? 0) + 1);

  const designNames = new Map<string, string>();
  if (picks.size) {
    const { data: designs } = await admin.from("stall_sticker_designs").select("code, name").in("code", [...picks.keys()]);
    for (const d of designs ?? []) designNames.set(d.code, d.name);
  }

  return NextResponse.json({
    sessions: sessions.size,
    completed: completed.size,
    abandoned: sessions.size - completed.size,
    funnel,
    topPicked: [...picks.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([code, p]) => ({ code, name: designNames.get(code) ?? code, picks: p })),
    topTemplates: [...opens.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, o]) => ({ name, opens: o, conversions: 0 })),
    overlapBlocks: ev.filter((e) => e.event === "overlap_blocked").length,
  });
}
