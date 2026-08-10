/** Self-contained kiosk→till handoff payload.
 *
 *  PRD §10 is explicit: "the QR encodes the full compressed payload, not just
 *  a lookup code. This makes the whole kiosk-to-till flow network-independent."
 *  Until now the kiosk only rendered the 4-character code, which is the
 *  *online-only fallback* — the till had to reach the server to resolve it. At
 *  a stall on mobile data, with the kiosk and the till on different phones,
 *  that is exactly the path that fails.
 *
 *  Encoding: JSON → deflate-raw → base64url, wrapped as `crftd:t:<payload>`
 *  to match the `crftd:s:<code>` scheme used by sticker labels (PRD §9).
 *
 *  Keys are deliberately one or two characters. A QR's capacity is the binding
 *  constraint: a six-sticker order in verbose JSON overflows what scans
 *  reliably on a scratched phone screen in daylight, and the difference
 *  between `sticker_design_id` and `d` across six entries is most of a
 *  version's worth of QR density. */

export type CompactSticker = {
  d: string; // sticker_design_id
  c: string; // code
  s: 0 | 1; // side: 0 front, 1 back
  x: number; // pos_x, % of print area
  y: number; // pos_y
  r: number; // rotation, degrees
  p: number; // unit_price
  o: number; // unit_cost
  h?: string; // hold_id
};

export type CompactGarment = {
  k: string; // product_sku_id
  c: string; // sku_code
  p: number; // unit_price
  o: number; // unit_cost
  s: CompactSticker[];
};

export type CompactTicket = {
  v: 1;
  t: string; // 4-char ticket code
  q: number; // quoted total
  g: CompactGarment[];
};

const PREFIX = "crftd:t:";

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
}

async function streamBytes(input: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const blob = new Blob([input as BlobPart]);
  const out = blob.stream().pipeThrough(stream as ReadableWritablePair<Uint8Array, Uint8Array>);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** Encode a ticket for a QR. Falls back to uncompressed base64url where
 *  CompressionStream is unavailable (older iOS Safari), which still scans —
 *  just at a higher QR version. */
export async function encodeTicket(ticket: CompactTicket): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(ticket));
  if (typeof CompressionStream === "undefined") {
    return `${PREFIX}0${toBase64Url(json)}`;
  }
  const deflated = await streamBytes(json, new CompressionStream("deflate-raw"));
  return `${PREFIX}1${toBase64Url(deflated)}`;
}

/** Decode a scanned QR back into a ticket. Returns null for anything that is
 *  not one of ours, so the till's single scan field can accept both a QR and a
 *  typed 4-character code without branching at the call site. */
export async function decodeTicket(scanned: string): Promise<CompactTicket | null> {
  if (!scanned.startsWith(PREFIX)) return null;
  const body = scanned.slice(PREFIX.length);
  const flag = body[0];
  const data = fromBase64Url(body.slice(1));
  try {
    const json =
      flag === "1" && typeof DecompressionStream !== "undefined"
        ? await streamBytes(data, new DecompressionStream("deflate-raw"))
        : data;
    const parsed = JSON.parse(new TextDecoder().decode(json)) as CompactTicket;
    return parsed?.v === 1 && Array.isArray(parsed.g) ? parsed : null;
  } catch {
    return null;
  }
}

/** Expand a scanned payload into the shape /api/tickets/[code] returns, so the
 *  till's redemption path is identical whether the cart arrived over the
 *  network or straight off the kiosk's screen. */
export function expandTicket(t: CompactTicket) {
  return {
    code: t.t,
    quoted_total: t.q,
    payload: {
      garments: t.g.map((g) => ({
        product_sku_id: g.k,
        sku_code: g.c,
        unit_price: g.p,
        unit_cost: g.o,
        stickers: g.s.map((s) => ({
          sticker_design_id: s.d,
          code: s.c,
          side: s.s === 1 ? ("back" as const) : ("front" as const),
          pos_x: s.x,
          pos_y: s.y,
          rotation: s.r,
          unit_price: s.p,
          unit_cost: s.o,
          hold_id: s.h,
        })),
      })),
    },
  };
}
