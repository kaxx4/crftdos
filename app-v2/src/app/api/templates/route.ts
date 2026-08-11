import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAnySession } from "@/lib/apiAuth";

// GET is used by BOTH the public kiosk storefront (which has no session) and
// the admin templates screen (includeInactive=1, requires admin). Only the
// admin/inactive path is gated — the kiosk read is the same public catalogue
// data the sticker designs themselves already expose.
export async function GET(req: NextRequest) {
  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "1";
  if (includeInactive) {
    const auth = await requireAnySession(req, ["admin"]);
    if (!auth.ok) return auth.response;
  }

  const admin = supabaseAdmin();
  let q = admin.from("stall_templates").select("*, designs:stall_sticker_designs!inner(id, is_active)");
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Filter-on-read: a template referencing a since-deactivated design
  // degrades by disappearing rather than failing when a customer opens it.
  type Row = { is_active: boolean; is_featured: boolean; times_used: number; payload: { placements?: { sticker_design_id: string }[] } };
  let rows = (data ?? []) as unknown as Row[];
  if (!includeInactive) rows = rows.filter((t) => t.is_active);

  rows.sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || b.times_used - a.times_used);
  return NextResponse.json({ templates: rows });
}

export async function POST(req: NextRequest) {
  const auth = await requireAnySession(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { id, name, payload, slug, blurb, preview_path, is_featured, is_active, sort } = body as {
    id?: string;
    name?: string;
    payload?: unknown;
    slug?: string;
    blurb?: string | null;
    preview_path?: string | null;
    is_featured?: boolean;
    is_active?: boolean;
    sort?: number;
  };
  if (!name || !payload) return NextResponse.json({ error: "name and payload are required" }, { status: 400 });

  const admin = supabaseAdmin();

  if (id) {
    const { data, error } = await admin
      .from("stall_templates")
      .update({ name, payload, slug, blurb, preview_path, is_featured, is_active, sort })
      .eq("id", id)
      .select()
      .single();
    if (error || !data) return NextResponse.json({ error: error?.message ?? "Template not found." }, { status: error ? 500 : 404 });
    return NextResponse.json({ template: data });
  }

  const derivedSlug = slug ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const { data, error } = await admin
    .from("stall_templates")
    .insert({
      name,
      payload,
      slug: derivedSlug,
      blurb: blurb ?? null,
      preview_path: preview_path ?? null,
      is_featured: is_featured ?? false,
      is_active: is_active ?? true,
      sort: sort ?? 0,
      times_used: 0,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAnySession(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const admin = supabaseAdmin();
  const { error } = await admin.from("stall_templates").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
