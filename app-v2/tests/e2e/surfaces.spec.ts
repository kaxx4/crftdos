import { expect, test } from "@playwright/test";

/** The overhaul's remaining blind spot was that nothing had been RUN. Types
 *  and the conformance guard read source; this reads the rendered page.
 *
 *  It asserts the three things a build cannot see and a screenshot review
 *  would miss on at least one of thirty-one routes:
 *    - the page renders at all, without a runtime error
 *    - the body never scrolls sideways
 *    - no interactive control sits under its surface's tap floor
 *
 *  The last two are exactly the class of defect found by hand during the
 *  redesign (a placement table overflowing on a phone, a 48px select on POS),
 *  which is the argument for checking them mechanically from now on. */

const KIOSK = [
  "/kiosk",
  "/kiosk/start",
  "/kiosk/ready",
  "/kiosk/garment",
  "/kiosk/design",
  "/kiosk/details",
  "/kiosk/done",
];
const POS = [
  "/pos",
  "/pos/sell",
  "/pos/orders",
  "/pos/holds",
  "/pos/returns",
  "/pos/waste",
  "/pos/stock",
  "/pos/press",
  "/pos/leads",
  "/pos/receipt",
  "/pos/more",
];
const ADMIN = [
  "/admin",
  "/admin/analytics",
  "/admin/b2b",
  "/admin/bulk",
  "/admin/catalogue",
  "/admin/discounts",
  "/admin/environments",
  "/admin/pricing",
  "/admin/stock",
  "/admin/templates",
  "/design",
];

/** DESIGN-SPEC tap floors. Admin is the console surface and is allowed to be
 *  dense; kiosk is touched by a stranger and is not. */
const FLOOR = { kiosk: 64, pos: 56, admin: 40 } as const;

/** Phone is the volunteer's own handset, tablet is the stall kiosk, desk is
 *  the admin console. Every surface must survive every width — a POS screen
 *  gets opened on a laptop and an admin page gets checked on a phone. */
const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "desk", width: 1440, height: 900 },
];

type Probe = {
  overflowPx: number;
  bleeders: string[];
  small: string[];
  textLength: number;
};

async function probe(page: import("@playwright/test").Page, floor: number): Promise<Probe> {
  return page.evaluate((tapFloor) => {
    const de = document.documentElement;

    /** Content sitting outside the viewport INSIDE a scroll container is the
     *  system working — a wide table scrolling in its own box, the admin nav
     *  scrolling under its own overflow. Only content that escapes every
     *  scroller is pushing the page. */
    const inScroller = (el: Element): boolean => {
      let p = el.parentElement;
      while (p && p !== document.body) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === "auto" || ox === "scroll" || ox === "hidden") return true;
        p = p.parentElement;
      }
      return false;
    };

    const bleeders: string[] = [];
    for (const el of Array.from(document.querySelectorAll("body *"))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (inScroller(el)) continue;
      if (r.right > de.clientWidth + 1 || r.left < -1) {
        const cls = typeof el.className === "string" ? el.className.slice(0, 50) : "";
        bleeders.push(`<${el.tagName.toLowerCase()} class="${cls}">`);
        if (bleeders.length >= 3) break;
      }
    }

    const small: string[] = [];
    const sel = "button, a[href], input:not([type=hidden]), select, textarea, [role=button]";
    for (const el of Array.from(document.querySelectorAll(sel))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (getComputedStyle(el).display === "contents") continue;
      if (r.height < tapFloor - 0.5) {
        const label = (el.textContent || el.getAttribute("aria-label") || el.tagName)
          .trim()
          .slice(0, 34);
        small.push(`${Math.round(r.height)}px "${label}"`);
        if (small.length >= 5) break;
      }
    }

    /** Ask the page to scroll rather than measuring scrollWidth.
     *
     *  documentElement.scrollWidth is not trustworthy here: on a page with a
     *  horizontally scrollable child it reports that child's extent even when
     *  the page itself cannot move, so it reads as a bug on layouts that are
     *  fine. Scrolling and reading scrollX back is what the person holding
     *  the phone actually experiences. */
    window.scrollTo(99999, 0);
    const scrollsX = window.scrollX;
    window.scrollTo(0, 0);

    return {
      overflowPx: scrollsX,
      bleeders,
      small,
      textLength: (document.body.innerText || "").trim().length,
    };
  }, floor);
}

for (const vp of VIEWPORTS) {
  test.describe(`${vp.name} ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const [surface, routes] of [
      ["kiosk", KIOSK],
      ["pos", POS],
      ["admin", ADMIN],
    ] as const) {
      for (const route of routes) {
        test(`${route}`, async ({ page }) => {
          const errors: string[] = [];
          page.on("pageerror", (e) => errors.push(String(e).split("\n")[0]));

          const res = await page.goto(route, { waitUntil: "networkidle" });
          expect(res?.status(), `${route} returned ${res?.status()}`).toBeLessThan(400);

          // Kiosk steps guard their prerequisites and redirect back to the
          // step that can actually be completed. That is correct behaviour,
          // so this asserts a working page, not a specific URL.
          const p = await probe(page, FLOOR[surface]);

          expect(errors, `runtime error on ${route}: ${errors[0]}`).toEqual([]);
          expect(p.textLength, `${route} rendered essentially nothing`).toBeGreaterThan(20);
          expect(
            p.overflowPx,
            `${route} scrolls sideways by ${p.overflowPx}px — ${p.bleeders.join(", ") || "no element escapes a scroller; something positioned is escaping its scrollport"}`
          ).toBe(0);
          expect(
            p.small,
            `${route} has controls under the ${surface} ${FLOOR[surface]}px tap floor`
          ).toEqual([]);
        });
      }
    }
  });
}

test.describe("entry point", () => {
  test("/ redirects to the kiosk", async ({ page }) => {
    await page.goto("/");
    expect(new URL(page.url()).pathname).toBe("/kiosk");
  });
});
