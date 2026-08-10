import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE.admin)?.value;
  return verifySession("admin", token);
}

const BUCKET = "stall-public";
const MAX_BYTES = 5 * 1024 * 1024;

// PRD §16 item 10: "200 cutout PNGs with transparency named by code." Upload
// as many files as fit in one multipart request; each file's name (minus
// extension) is matched case-insensitively against stall_sticker_designs.code.
// A design with no matching file keeps whatever cutout_path it already had —
// this is additive, never clears existing art.
export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "multipart/form-data required" }, { status: 400 });

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) return NextResponse.json({ error: "No files in 'files' field" }, { status: 400 });

  const admin = supabaseAdmin();
  const results: { file: string; code: string; status: "ok" | "error"; error?: string }[] = [];

  for (const file of files) {
    const baseName = file.name.replace(/\.[^.]+$/, "");
    const code = baseName.trim().toUpperCase();

    if (!code) {
      results.push({ file: file.name, code: "", status: "error", error: "Could not derive a code from the filename" });
      continue;
    }
    if (file.type && file.type !== "image/png") {
      results.push({ file: file.name, code, status: "error", error: `Not a PNG (${file.type || "unknown type"})` });
      continue;
    }
    if (file.size > MAX_BYTES) {
      results.push({ file: file.name, code, status: "error", error: "File over 5MB" });
      continue;
    }

    const { data: design } = await admin
      .from("stall_sticker_designs")
      .select("id, code")
      .ilike("code", code)
      .maybeSingle();
    if (!design) {
      results.push({ file: file.name, code, status: "error", error: "No sticker design with this code" });
      continue;
    }

    const path = `cutouts/${design.code}.png`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadErr } = await admin.storage.from(BUCKET).upload(path, bytes, {
      contentType: "image/png",
      upsert: true,
    });
    if (uploadErr) {
      results.push({ file: file.name, code, status: "error", error: uploadErr.message });
      continue;
    }

    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
    const { error: updateErr } = await admin
      .from("stall_sticker_designs")
      .update({ cutout_path: pub.publicUrl })
      .eq("id", design.id);
    if (updateErr) {
      results.push({ file: file.name, code, status: "error", error: updateErr.message });
      continue;
    }

    results.push({ file: file.name, code: design.code, status: "ok" });
  }

  const ok = results.filter((r) => r.status === "ok").length;
  if (ok > 0) {
    await admin.from("stall_admin_audit").insert({
      actor: "admin",
      action: "catalogue_cutout_upload",
      detail: { uploaded: ok, failed: results.length - ok },
    });
  }

  return NextResponse.json({ results });
}
