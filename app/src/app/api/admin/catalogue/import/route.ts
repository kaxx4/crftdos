import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE.admin)?.value;
  return verifySession("admin", token);
}

// PRD §16 item 10: "a CSV of code, name, size class, stock, cost, price, bin
// location" for the eventual 200-design catalogue. Header-driven so column
// order doesn't matter; only `code` and `size_class` are required, matching
// the two NOT NULL columns on stall_sticker_designs. Everything else is
// upserted by code — re-importing the same CSV after fixing a typo is safe.
const REQUIRED = ["code", "size_class"];
const KNOWN_COLUMNS = [
  "code",
  "name",
  "size_class",
  "stock_qty",
  "par_level",
  "unit_cost",
  "unit_price",
  "bin_location",
  "print_w_cm",
  "print_h_cm",
  "tags",
  "artwork_group",
];
const NUMERIC_COLUMNS = new Set(["stock_qty", "par_level", "unit_cost", "unit_price", "print_w_cm", "print_h_cm"]);

/** Minimal CSV parser: handles quoted fields with embedded commas/quotes,
 *  which a plain .split(",") does not. No dependency needed for this shape
 *  of data. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((f) => f.trim() !== "")) rows.push(row);
  }
  return rows;
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { csv } = await req.json().catch(() => ({}));
  if (typeof csv !== "string" || !csv.trim()) {
    return NextResponse.json({ error: "csv text required" }, { status: 400 });
  }

  const rows = parseCsv(csv);
  if (rows.length < 2) {
    return NextResponse.json({ error: "CSV needs a header row plus at least one data row" }, { status: 400 });
  }

  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const unknown = header.filter((h) => !KNOWN_COLUMNS.includes(h));
  const missingRequired = REQUIRED.filter((c) => !header.includes(c));
  if (missingRequired.length) {
    return NextResponse.json(
      { error: `Missing required column(s): ${missingRequired.join(", ")}` },
      { status: 400 }
    );
  }

  const results: { code: string; status: "created" | "updated" | "error"; error?: string }[] = [];
  const admin = supabaseAdmin();

  for (const raw of rows.slice(1)) {
    const record: Record<string, string> = {};
    header.forEach((col, i) => (record[col] = (raw[i] ?? "").trim()));
    const code = record.code;
    if (!code) continue;

    const patch: Record<string, unknown> = {};
    for (const col of KNOWN_COLUMNS) {
      if (!(col in record) || record[col] === "") continue;
      if (col === "code") continue;
      if (col === "tags") {
        patch.tags = record[col]
          .split(/[|;]/)
          .map((t) => t.trim())
          .filter(Boolean);
      } else if (NUMERIC_COLUMNS.has(col)) {
        const n = Number(record[col]);
        if (!Number.isNaN(n)) patch[col] = n;
      } else {
        patch[col] = record[col];
      }
    }
    if (!record.size_class) {
      results.push({ code, status: "error", error: "size_class required" });
      continue;
    }

    const { data: existing } = await admin.from("stall_sticker_designs").select("id").eq("code", code).maybeSingle();
    if (existing) {
      const { error } = await admin.from("stall_sticker_designs").update(patch).eq("code", code);
      results.push(error ? { code, status: "error", error: error.message } : { code, status: "updated" });
    } else {
      const { error } = await admin
        .from("stall_sticker_designs")
        .insert({ code, size_class: record.size_class, ...patch });
      results.push(error ? { code, status: "error", error: error.message } : { code, status: "created" });
    }
  }

  await admin.from("stall_admin_audit").insert({
    actor: "admin",
    action: "catalogue_csv_import",
    detail: {
      rows: results.length,
      created: results.filter((r) => r.status === "created").length,
      updated: results.filter((r) => r.status === "updated").length,
      errors: results.filter((r) => r.status === "error").length,
    },
  });

  return NextResponse.json({ results, unknownColumns: unknown });
}
