/** Deterministic seed for the mock backend.
 *
 *  Matches the shape and the counts of the live database as documented in
 *  `CrftdOS/Database Map.md` — 12 sticker designs, 32 active product SKUs,
 *  2 colours, 3 fits — so anything that works here works against the same
 *  cardinality it will meet in production.
 *
 *  Prices are seed/placeholder, exactly as the live ones are. See
 *  `Known Issues.md`: pricing is replaced through /admin/pricing, not a deploy. */

import type {
  Color,
  Environment,
  Fit,
  ProductSize,
  ProductSku,
  StickerDesign,
  StockLocation,
  Template,
} from "../../domain/types";

export const SEED_EPOCH = new Date("2026-08-11T09:00:00.000Z");

// ─── Print geometry ─────────────────────────────────────────────────────────
// The mockup SVG is 800x1000. The printable rectangle drawn on it spans
// x 250-550, y 260-660 in those units. Expressed as fractions of the image and
// paired with its real size in centimetres, that is what gives the canvas its
// px-per-cm. Change one without the other and true-scale rendering silently
// lies about physical size — which is the single most important constraint in
// the kiosk (PRD D13: the transfers are pre-cut, so an unfulfillable size is a
// broken promise, not a cosmetic bug).
const PRINT_AREA = { x: 0.3125, y: 0.26, w: 0.375, h: 0.4, cm_w: 30, cm_h: 40 };

export const colors: Color[] = [
  { id: "col-black", name: "Black", hex: "#17171a", sort: 1, is_active: true },
  { id: "col-natural", name: "Natural", hex: "#efe9dc", sort: 2, is_active: true },
];

export const fits: Fit[] = [
  { id: "fit-oversized", name: "Oversized", applies_to: "tee", sort: 1, is_active: true },
  { id: "fit-regular", name: "Regular", applies_to: "tee", sort: 2, is_active: true },
  { id: "fit-crop", name: "Crop", applies_to: "tee", sort: 3, is_active: true },
];

const fitSizes: Record<string, ProductSize[]> = {
  "fit-oversized": ["S", "M", "L", "XL", "XXL"],
  "fit-regular": ["XS", "S", "M", "L", "XL", "XXL"],
  "fit-crop": ["S", "M", "L", "XL", "XXL"],
};

/** 2 colours x 16 size/fit combinations = 32, matching the live count. */
export const skus: ProductSku[] = colors.flatMap((c) =>
  fits.flatMap((f) =>
    fitSizes[f.id].map((size): ProductSku => {
      const slug = c.name.toLowerCase();
      return {
        id: `sku-${slug}-${f.name.toLowerCase()}-${size}`.toLowerCase(),
        product_type: "tee",
        color_id: c.id,
        fit_id: f.id,
        size,
        sku_code: `TEE-${c.name.slice(0, 3).toUpperCase()}-${f.name.slice(0, 3).toUpperCase()}-${size}`,
        stock_qty: size === "XS" || size === "XXL" ? 4 : 12,
        par_level: 5,
        unit_cost: 280,
        unit_price: f.id === "fit-oversized" ? 549 : 499,
        mockup_front: `/mockups/tee-${slug}-front.svg`,
        mockup_back: `/mockups/tee-${slug}-back.svg`,
        print_area: { front: PRINT_AREA, back: PRINT_AREA },
        is_active: true,
      };
    })
  )
);

// ─── Sticker designs ────────────────────────────────────────────────────────
// Numbering is independent per size class (PRD D22) — S-014 and M-014 are
// unrelated artwork unless linked through `artwork_group`. The seed links them
// so the "same design, bigger" relationship is testable.

const artworks: { no: string; name: string; tags: string[] }[] = [
  { no: "001", name: "Break Line", tags: ["ocean", "wave", "line"] },
  { no: "002", name: "Slow Traveller", tags: ["ocean", "animal", "turtle"] },
  { no: "003", name: "Reef Stack", tags: ["ocean", "coral", "colour"] },
  { no: "004", name: "One Drop", tags: ["water", "minimal", "icon"] },
  { no: "005", name: "Shoal", tags: ["ocean", "animal", "fish"] },
  { no: "006", name: "Canopy", tags: ["land", "leaf", "green"] },
  { no: "007", name: "Catchment", tags: ["land", "mountain", "bold"] },
  { no: "008", name: "Dry Season", tags: ["land", "sun", "colour"] },
  { no: "009", name: "Big Blue", tags: ["ocean", "animal", "whale"] },
  { no: "010", name: "Tide Pool", tags: ["ocean", "coral", "colour"] },
  { no: "011", name: "Root System", tags: ["land", "roots", "line"] },
  { no: "012", name: "Due South", tags: ["icon", "minimal", "bold"] },
];

const sizeCm: Record<"S" | "M" | "L", number> = { S: 8, M: 12, L: 18 };
const sizePrice: Record<"S" | "M" | "L", number> = { S: 99, M: 149, L: 199 };
const sizeCost: Record<"S" | "M" | "L", number> = { S: 30, M: 45, L: 62 };

/** 12 designs, as live. Deliberately NOT 12 x 3: the live catalogue has 12
 *  rows total, and each row is one physical pre-cut transfer at one size. */
export const designs: StickerDesign[] = artworks.map((a, i) => {
  const size: "S" | "M" | "L" = (["M", "L", "S"] as const)[i % 3];
  return {
    id: `dsn-${size}-${a.no}`,
    code: `${size}-${a.no}`,
    size_class: size,
    name: a.name,
    artwork_group: `art-${a.no}`,
    tags: a.tags,
    auto_tags: [],
    cutout_path: `/stickers/${size}-${a.no}.svg`,
    print_w_cm: sizeCm[size],
    print_h_cm: sizeCm[size],
    // One design deliberately seeded at zero so the out-of-stock path is
    // reachable without editing data: the kiosk must hide it, and the POS
    // must show it as unavailable rather than pretending.
    stock_qty: i === 7 ? 0 : 6 + ((i * 5) % 14),
    par_level: 10,
    bin_location: `Box ${1 + (i % 3)} / Tab ${size}`,
    unit_cost: sizeCost[size],
    unit_price: sizePrice[size],
    is_active: true,
    kiosk_visible: true,
  };
});

// ─── Environments [004] ─────────────────────────────────────────────────────

export const environments: Environment[] = [
  {
    id: "env-cloud",
    name: "Cloud (general)",
    prefix: "HQ",
    kind: "cloud",
    is_active: true,
    opened_at: SEED_EPOCH.toISOString(),
    closed_at: null,
    notes: "The default environment. Every device falls back here until bound.",
  },
  {
    id: "env-stall-a",
    name: "Stall A — Main Gate",
    prefix: "SA",
    kind: "stall",
    is_active: true,
    opened_at: SEED_EPOCH.toISOString(),
    closed_at: null,
  },
  {
    id: "env-stall-b",
    name: "Stall B — Food Court",
    prefix: "SB",
    kind: "stall",
    is_active: true,
    opened_at: SEED_EPOCH.toISOString(),
    closed_at: null,
  },
  {
    id: "env-online",
    name: "Online link",
    prefix: "ON",
    kind: "online",
    is_active: true,
    opened_at: SEED_EPOCH.toISOString(),
    closed_at: null,
  },
];

export const stockLocations: StockLocation[] = [
  { id: "loc-warehouse", environment_id: null, name: "Warehouse", is_warehouse: true },
  { id: "loc-cloud", environment_id: "env-cloud", name: "Cloud (general)", is_warehouse: false },
  { id: "loc-stall-a", environment_id: "env-stall-a", name: "Stall A — Main Gate", is_warehouse: false },
  { id: "loc-stall-b", environment_id: "env-stall-b", name: "Stall B — Food Court", is_warehouse: false },
  { id: "loc-online", environment_id: "env-online", name: "Online link", is_warehouse: false },
];

/** Initial allocation. Deliberately uneven so the "two kiosks legitimately
 *  show different catalogues" behaviour (open question 6 in the requirements
 *  doc) is visible in the mock rather than a surprise in production. */
export const stockSplit: Record<string, number> = {
  "loc-warehouse": 0.4,
  "loc-cloud": 0.1,
  "loc-stall-a": 0.3,
  "loc-stall-b": 0.15,
  "loc-online": 0.05,
};

// ─── Templates [006] ────────────────────────────────────────────────────────
// Payload shape is identical to a design ticket's, so opening a template into
// the canvas reuses the ticket-redemption code path exactly.

function tpl(
  id: string,
  name: string,
  slug: string,
  blurb: string,
  skuId: string,
  picks: { code: string; x: number; y: number; r?: number }[],
  featured = false,
  used = 0
): Template {
  const sku = skus.find((s) => s.id === skuId)!;
  return {
    id,
    name,
    slug,
    blurb,
    is_featured: featured,
    is_active: true,
    sort: 0,
    times_used: used,
    preview_path: null,
    payload: {
      product_sku_id: sku.id,
      sku_code: sku.sku_code,
      unit_price: sku.unit_price,
      unit_cost: sku.unit_cost,
      placements: picks.map((p) => {
        const d = designs.find((x) => x.code === p.code);
        // Numbering is independent per size class, so M-004 existing does not
        // imply S-004 does. Fail loudly here rather than emitting a placement
        // with an undefined design id that only surfaces as a blank canvas.
        if (!d) throw new Error(`Seed template "${name}" references ${p.code}, which is not in the design set.`);
        return {
          sticker_design_id: d.id,
          code: d.code,
          side: "front" as const,
          pos_x: p.x,
          pos_y: p.y,
          rotation: p.r ?? 0,
          print_w_cm: d.print_w_cm!,
          print_h_cm: d.print_h_cm!,
          cutout_path: d.cutout_path,
          unit_price: d.unit_price,
          unit_cost: d.unit_cost,
        };
      }),
    },
  };
}

export const templates: Template[] = [
  tpl(
    "tpl-tide",
    "Tide Line",
    "tide-line",
    "The one everyone photographs. Two water marks, stacked.",
    "sku-black-oversized-l",
    [
      { code: "M-001", x: 50, y: 32 },
      { code: "M-004", x: 50, y: 70 },
    ],
    true,
    148
  ),
  tpl(
    "tpl-slow",
    "Slow Traveller",
    "slow-traveller",
    "One big turtle, dead centre. Nothing else needed.",
    "sku-natural-regular-m",
    [{ code: "L-002", x: 50, y: 46 }],
    true,
    132
  ),
  tpl(
    "tpl-catchment",
    "Catchment",
    "catchment",
    "Mountain and canopy. For the land half of AquaTerra.",
    "sku-natural-oversized-l",
    [
      { code: "M-007", x: 50, y: 36 },
      { code: "S-006", x: 66, y: 68, r: 12 },
    ],
    true,
    97
  ),
  tpl(
    "tpl-bigblue",
    "Big Blue",
    "big-blue",
    "A whale, small and quiet on the chest.",
    "sku-black-oversized-xl",
    [{ code: "S-009", x: 34, y: 30 }],
    false,
    64
  ),
  tpl(
    "tpl-roots",
    "Root System",
    "root-system",
    "The TerraRoots mark, worn plainly.",
    "sku-black-regular-m",
    [{ code: "L-011", x: 50, y: 46 }],
    false,
    41
  ),
  tpl(
    "tpl-reef",
    "Reef Stack",
    "reef-stack",
    "Colour-heavy. Best on natural.",
    "sku-natural-crop-m",
    [
      { code: "M-010", x: 50, y: 36 },
      { code: "S-003", x: 50, y: 70 },
    ],
    false,
    28
  ),
];
