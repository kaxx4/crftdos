# crftd Stall OS — Product Requirements Document v2

**Supersedes:** v1.0 (4 Aug 2026)
**Owner:** AQUATERRA (crftd, commercial arm of AquaTerra / TerraRoots)
**Status:** Build-ready pending pricing numbers
**Stack:** Next.js 15 (App Router, TypeScript, Tailwind) + Supabase (Postgres, Realtime, Storage) + Vercel
**Build agent:** Claude Code

---

## 0. What changed from v1

Your answers added three modules and tightened five assumptions. In order of impact:

**New: Customer Design Studio (§4).** A customer-facing kiosk with best-seller presets and a live tee canvas where buyers place stickers themselves. This is now the second-largest surface in the app after Sell, and it fundamentally improves stall throughput because customers self-serve the slow part (choosing and arranging) while a volunteer serves someone else. It also introduces the single biggest fulfilment risk in the product, covered in §4.3.

**New: Receipts (§6).** Auto-generated, sequentially numbered, delivered by WhatsApp and email. Sequential numbering plus offline capability is a real engineering conflict, solved by per-device number block allocation (§6.2).

**New: B2B pipeline (§7).** Quote through deposit through dispatch, with a hard margin-floor gate.

**Tightened:** stickers are pre-cut physical transfers in folders, so stock is a simple count and I've added bin location so volunteers can actually find `M-014` in a box of 200. Press waste, returns, and holds are all now logged. Single TerraRoots UPI destination removes the reconciliation nightmare I was worried about. Both press scenarios supported via a per-shift toggle.

**Provisions added, not built:** hoodies, jackets, jerseys, uniforms as product types (schema-ready, seeded inactive). QR scanning (schema and label generation built, camera scan behind a flag). Thermal receipt printing (interface stubbed).

---

## 1. Decisions applied

| # | Decision | Rationale |
|---|---|---|
| D13 | **Design Studio locks sticker scale.** Customers position and rotate, never resize. | Your transfers are pre-cut at fixed S/M/L. A canvas that lets a customer scale a sticker produces an order you physically cannot fulfil. This is the most important constraint in the new module. |
| D14 | **Kiosk hands off by code or QR, never by shared cart state.** Customer finishes, gets a 4-character ticket like `A7K2` plus a QR; volunteer scans or types it on the till device. | Keeps the customer off the till device, works across 8 devices, survives the kiosk going offline mid-session. |
| D15 | **Receipt numbers are pre-allocated in blocks of 100 per device at shift open.** Unused numbers are voided at shift close. | Gapless-ish sequential numbering that survives offline operation. See §6.2. |
| D16 | **Press mode is a shift-level setting.** `press_on_site` on means live pending queue; off means collect-later with a mandatory promised date and mandatory customer contact. | You said both scenarios happen. One toggle changes the flow correctly instead of asking volunteers to remember. |
| D17 | **B2B blocks below 10% margin without admin PIN, hard-blocks below 0%.** No intern discounting on B2B, enforced. | Your stated floor is 10 to 15%. A floor nobody can see is not a floor. |
| D18 | **Products are generic (`product_type`), tees are the only active type at launch.** Colour becomes a settings-managed list, not a two-value enum. | Hoodies will not be black and white only. Cheap now, painful later. |
| D19 | **crftd skin is applied asymmetrically.** Full brutalist energy on the kiosk, receipts, and shift summary card. Restrained on volunteer POS screens: blue header band, Anton for numerals and headers, Chivo body, high contrast, large tap targets. | Collision layout is wrong for someone squinting at a phone in sunlight with a queue. The places where the brand sells are the places the brand goes loud. This matches your existing discipline of confining brights to content contexts. |
| D20 | **Auto-tagging runs at import via the Anthropic API on the design image**, producing 3 to 6 tags, always editable. | You want customer-facing search across 200 designs. Manual tagging of 200 designs will not happen. Costs a small amount of API credit once. |
| D21 | **Shift = one day.** Multi-day events group shifts under an `event_name`. | Paradox becomes queryable as a whole without breaking daily cash reconciliation. |
| D22 | **Sticker numbering is independent per size class.** `S-014` and `M-014` are unrelated by default. An optional `artwork_group` links them manually when the same art exists in two sizes. | Reading your original spec literally: stock divided into S, M, L each with its own sequence. |
| D23 | **"Raised for AquaTerra" is a first-class number.** Net profit after cost, shown on the admin dashboard, the shift summary card, and the receipt footer. | You said this is always the point. Make it visible to volunteers and customers, not buried in analytics. |

---

## 2. Information architecture

```
VOLUNTEER (stall PIN)
/                    Sell
/orders              Shift log, pending press queue, voids
/holds               Active reservations
/stock/stickers      Sticker inventory
/stock/products      Product inventory matrix
/restock             Restock, print queue, dead stock
/waste               Log a failed press
/returns             Log a return or exchange

KIOSK (kiosk PIN, locked mode)
/kiosk               Customer-facing: presets + design canvas

ADMIN (admin PIN)
/admin               Dashboard
/admin/analytics
/admin/pricing       Editable price and cost matrix
/admin/b2b           B2B pipeline
/admin/bulk          One-off bulk entry
/admin/catalogue     Design management, import, auto-tag, QR labels
/admin/messaging     Templates, receipt template, message log
/admin/people        Volunteers, commission
/admin/shifts        History, summaries, exports
/admin/settings      Colours, sizes, product types, press defaults, PINs
```

Mobile tab bar: **Sell · Stock · Orders · Restock · More**. Kiosk is a separate locked route with no navigation out except by PIN.

Three PINs now, not two: stall, kiosk, admin. Kiosk PIN exists only so a customer cannot navigate out of kiosk mode.

---

## 3. Core sale flow (updated)

### 3.1 Sell screen

Single screen. Cart top, entry controls middle, total and Charge pinned bottom.

**Add product:** type (Tee, locked at launch) → colour → fit → size. Sizes not stocked in a fit are hidden. Out-of-stock is greyed with the count, still selectable behind a confirmation.

**Add sticker:** one control, four input modes.
1. Type the code. "14" matches `S-014`, `M-014`, `L-014`. "m14" matches `M-014`.
2. Browse the grid, filterable by size class and tag.
3. Tap from the Recent row (8 most-used this shift).
4. Scan the QR on the transfer sleeve, where labels have been printed (§9).

Search results show the **bin location** alongside the code so the volunteer knows where to physically go: `M-014 · Box 2 / Tab M · 12 left`.

**Load a design ticket:** a prominent field accepts the 4-character kiosk code or a QR scan, and pulls the customer's entire composed cart including sticker placements. This is the fast path and should be the first thing on the screen at a busy stall.

**Custom sticker:** size class, description, optional photo capture, price prefilled. Allocates the next `C-####` from an independent sequence.

**Discount:** amount or percentage plus a reason enum. Above 10% requires admin PIN. Manual total override exists and is flagged separately in analytics.

**Payment:** UPI / Cash / Split / Pending. Single TerraRoots UPI destination means the UPI reference field is optional and reconciliation is a simple sum against the bank statement. Split reveals two fields that must total.

**Charge:** writes optimistically, screen clears within 100ms regardless of network, 8-second undo toast, receipt generated (§6).

**Customer sheet:** slides up after charge. Name, phone, email, marketing consent unticked. Skippable in one tap **unless** the order contains a custom or canvas item on a collect-later shift, in which case contact is mandatory because you have to reach them.

### 3.2 Press mode

Shift setting `press_on_site`.

**On.** Any order with a custom sticker or a canvas placement enters `pending`. A badge on the Sell header shows count and oldest wait. `/orders` pins pending items at the top with a live timer, a press sheet view (§4.4), and one-tap Pressed and Handed Over.

**Off.** Same orders become `collect_later` with a mandatory promised date. Customer contact becomes mandatory. The receipt states the collection date. `/orders` shows a Collections tab grouped by date, and the admin dashboard shows overdue collections in red.

### 3.3 Holds

Reserve a specific SKU against a customer name and phone. Held units are subtracted from **available** but not from **on-hand**, and the two numbers are shown separately anywhere it matters. Default expiry two hours or shift close, whichever comes first, configurable. Expiring a hold returns availability silently and logs it. `/holds` lists active holds with a countdown, convert-to-sale, and release actions.

### 3.4 Waste

`/waste` is two taps from Sell. Log: transfer code (and quantity), product SKU if a blank was ruined, reason (misalignment, peel failure, temperature, print defect, garment defect, other), volunteer, note, optional photo. Decrements stock with movement reason `damage`.

Analytics surfaces waste rate per volunteer and per design. Some designs genuinely press worse than others and you will only find out if you log it.

### 3.5 Returns and exchanges

`/returns` links to an original order (searchable by receipt number, phone, or order number). Capture: items returned, reason (defect, wrong item supplied, size exchange, other), action (replace, refund, exchange, reject), whether returned stock is resaleable or written off, amount refunded, approver.

Policy reminder rendered in the UI at the point of entry: replace or refund on genuine defects, no change-of-mind returns, DTF rated 10 to 15 washes with hand wash recommended. Rejected returns are still logged, because the pattern of what you reject is data.

Exchanges create a linked replacement order at zero value so inventory moves correctly without inflating revenue.

---

## 4. Customer Design Studio (kiosk)

The highest-leverage addition and the highest-risk one. Runs on a tablet or spare phone facing the customer.

### 4.1 Entry

Kiosk boots to a full-screen attract state: crftd wordmark, blue baseline band, crop marks, rotating best-seller shots, and "Tap to build yours". No navigation chrome. Exiting requires the kiosk PIN.

### 4.2 Two paths

**Presets.** A grid of pre-composed best sellers: a tee mockup with stickers already arranged, a name, and a price. Admin marks any past composition as a preset, or builds one from scratch. Customer taps, chooses colour, fit, and size, done. Three taps to a ticket. This path should carry most volume and exists because most customers do not want to design anything, they want to buy the one they saw on Instagram.

**Canvas.** Customer builds from scratch:
1. Choose product: colour, fit, size. Availability is live, out-of-stock sizes are disabled with "ask a volunteer".
2. Choose side: Front or Back. Both are available and priced independently.
3. Browse or search the sticker catalogue. Search covers code, name, and tags, which is why auto-tagging matters. Filters by size class and tag chips (anime, typography, band, abstract, and whatever the tagger produces).
4. Tap a sticker to drop it onto the tee. Drag to position. Rotate with a two-finger gesture or a slider.
5. Live price updates as stickers are added.
6. Review, then Get Ticket.

### 4.3 The constraints that keep it fulfillable

This is where a design tool becomes a broken promise if you get it wrong.

**No scaling.** Stickers render at their true relative size. S, M, and L map to real print dimensions in centimetres, stored in settings, and scaled against the tee mockup's known print-area dimensions. The customer sees what they will actually get. There is no resize handle. If they want it bigger they pick the L version if one exists.

**Print area bounds.** Drag is constrained to the printable rectangle for that product type and side. A sticker cannot go on a seam, a hem, or a sleeve from this interface.

**Overlap blocked.** Two transfers cannot be pressed on top of each other. The canvas detects bounding-box overlap and refuses the placement with a nudge, rather than accepting an order nobody can produce.

**Stock-aware.** A design with zero transfers left does not appear in the kiosk catalogue at all. Availability accounts for holds and for units already in other open kiosk sessions, so two customers on two kiosks cannot both compose using the last `M-014`. Session reservations expire after 15 minutes of inactivity.

**Price transparency.** Running total visible at all times. No surprises at the till.

### 4.4 Handoff

On Get Ticket, the kiosk generates:
- A 4-character code, unambiguous alphabet (no O/0, I/1), 30-minute expiry.
- A QR encoding the same.
- A **press sheet**: a composite PNG of the tee with stickers in position, plus a machine-readable placement list (sticker code, side, x and y as percentage of print area, rotation in degrees).

The customer walks to the till, the volunteer scans or types the code, the full cart loads with placements attached. The press sheet is what the person at the heat press actually looks at. It appears in the pending queue and on the order detail.

The ticket is a **quote, not a sale**. Nothing decrements until the volunteer charges. Expired tickets release their session reservations.

### 4.5 Offline behaviour

The kiosk caches the catalogue like every other device and can compose fully offline. Ticket codes are generated locally with a device prefix to avoid collision. Availability shown offline is last-known, so the overlap risk is that a customer composes with a design that just sold out. The volunteer's till device catches it at charge time with a clear swap prompt. Acceptable.

### 4.6 What this is not

Not an e-commerce storefront. No payment, no accounts, no order history, no delivery. It is a composition tool that outputs a ticket for an in-person transaction. Do not let it grow into a shop without a separate decision.

---

## 5. Pricing

Fully editable matrix at `/admin/pricing`, inline-editable cells, with a bulk-set control ("set all crop tops to X").

Price resolution for a sticker: per-design `unit_price` if set, otherwise the size-class default. For a product: per-SKU `unit_price`. Same pattern for cost.

**Prices snapshot onto the order line at time of sale.** Changing a price never rewrites history. This is what makes month-over-month comparison and margin analysis trustworthy.

Fill this in and I will seed it. Blank cells inherit from the size-class or fit default.

### Products (INR)

| Colour | Fit | XS | S | M | L | XL | XXL | Cost |
|---|---|---|---|---|---|---|---|---|
| Black | Oversized | | | | | | | |
| Black | Regular | | | | | | | |
| Black | Crop | | | | | n/a? | n/a? | |
| White | Oversized | | | | | | | |
| White | Regular | | | | | | | |
| White | Crop | | | | | n/a? | n/a? | |

### Stickers (INR)

| Size class | Print size (cm) | Price | Cost | Default par | Min reorder batch |
|---|---|---|---|---|---|
| S | | | | | |
| M | | | | | |
| L | | | | | |

Print size in centimetres is required, not optional. The kiosk canvas cannot render true-scale without it.

### Other

| Item | Value |
|---|---|
| Custom sticker surcharge over catalogue price | |
| Back print surcharge (if any) | |
| Printer minimum reorder batch (transfers) | |
| Blank tee lead time (days) | |
| Default hold duration | 2 hours |

---

## 6. Receipts

### 6.1 Content

Rendered from an editable template. Default fields: crftd wordmark and blue band, TerraRoots legal name and any registration number you want on it, receipt number, date and time, shift name and venue, itemised lines with per-item prices, sticker codes per garment, discount with reason, total, payment method, volunteer name, a line stating that proceeds support AquaTerra welfare work, care instructions (hand wash recommended, DTF rated for 10 to 15 washes minimum), and a QR linking to your Instagram.

Collect-later orders additionally show the promised collection date in the largest type on the receipt.

### 6.2 Numbering, and the offline conflict

Sequential receipt numbers and offline operation fight each other. If numbers are allocated on server insert, an order made at 4:02pm offline can receive a number after one made at 4:40pm online, and your sequence no longer reflects reality.

**Solution: block allocation.** At shift open, each device requests a block of 100 receipt numbers from the server. Numbers are consumed locally in order. At shift close, unused numbers in the block are marked `unused` in the ledger, so the sequence is complete and auditable with every number accounted for.

Format: `CR/26-27/000142`, where the middle segment is the Indian financial year. Stored on the order, immutable, never reused, never reassigned on void. Voided orders keep their number and are marked void.

### 6.3 Delivery

Rendered client-side to a PNG (canvas) for WhatsApp, and as HTML for email. Three delivery paths, all optional per order:
1. **WhatsApp**, the primary path: a one-tap `wa.me` deep link with the receipt text pre-filled and the PNG attached from the device gallery. Still a manual send, still free, still the highest delivery rate. Automated WhatsApp remains out of reach for the reasons in v1 §7.
2. **Email**, via Resend from a verified crftd domain, sent by an Edge Function on sync.
3. **Show on screen**, for customers who want neither.

Thermal printer support is stubbed behind an interface but not implemented. If you acquire a 58mm Bluetooth printer later, it is a day of work.

### 6.4 One flag

Auto-generating numbered receipts from a registered entity that sells goods can carry tax and invoicing obligations. I am not a tax advisor and I do not know what TerraRoots' registration obliges. Ask whoever handles your filings whether these need to be GST invoices, and whether the goods sales sit differently from the NGO's other activity. The design here (gapless numbering, immutable records, full line detail, cost stored) keeps every option open, so nothing needs rebuilding whichever way the answer goes.

---

## 7. B2B pipeline

Lives at `/admin/b2b`, admin PIN only.

**Stages:** Enquiry → Quoted → Confirmed (50% deposit received) → In production → Ready → Dispatched (balance received) → Closed. Lost is a terminal state with a reason.

**Fields:** client organisation, contact person, phone, email, product type, quantity, size breakdown, design references or uploaded artwork, unit price, unit cost, gross value, computed margin percentage, deposit amount and date and method, balance amount and date and method, promised dispatch date, actual dispatch date, **account owner** (required, selected from volunteers), notes, and an activity log.

**Margin gate.** Margin is computed live as quantity is entered. Below 15% shows an amber warning. Below 10% requires admin PIN to save. Below 0% is hard-blocked. Intern-level discounting is not available on this screen at all.

**Inventory.** `affects_inventory` defaults off, since B2B blanks are usually ordered specially. Turning it on requires SKU lines and decrements stall stock.

**Revenue recognition.** Deposit and balance are recorded separately with dates. The dashboard shows committed value (all confirmed orders) and collected value (money actually received) as two distinct numbers. Reporting only the gross of confirmed orders will overstate what you have raised, which matters because that number feeds AquaTerra.

**Note:** the required account-owner field will immediately surface the unassigned B2B owner role in your operating model. That is intentional. The form will not save without a name against it.

---

## 8. Data model v2

```sql
-- ENUMS
create type product_type    as enum ('tee','hoodie','jacket','jersey','uniform','other');
create type product_size    as enum ('XS','S','M','L','XL','XXL','XXXL');
create type sticker_size    as enum ('S','M','L');
create type order_channel   as enum ('stall','event','kiosk','bulk','b2b','dm','other');
create type payment_method  as enum ('upi','cash','split','pending');
create type fulfillment     as enum ('handed_over','pending_press','collect_later','collected');
create type movement_reason as enum ('sale','void','restock','recount','damage','sample','gift','return_restock','correction');
create type discount_reason as enum ('volunteer_discretion','freebie','bulk','damaged_item','price_match','other');
create type shift_type      as enum ('stall','event','popup','other');
create type print_side      as enum ('front','back');
create type b2b_stage       as enum ('enquiry','quoted','confirmed','production','ready','dispatched','closed','lost');
create type return_action   as enum ('replace','refund','exchange','reject');
create type waste_reason    as enum ('misalignment','peel_failure','temperature','print_defect','garment_defect','other');

create sequence custom_sticker_seq start 1;
create sequence order_no_seq start 1;
create sequence receipt_block_seq start 1;

-- SETTINGS-DRIVEN LOOKUPS
create table colors (
  id       uuid primary key default gen_random_uuid(),
  name     text unique not null,        -- 'black','white'
  hex      text,
  sort     int default 0,
  is_active bool default true
);

create table fits (
  id       uuid primary key default gen_random_uuid(),
  name     text not null,               -- 'oversized','regular','crop'
  applies_to product_type not null default 'tee',
  sort     int default 0,
  is_active bool default true,
  unique (name, applies_to)
);

-- CATALOGUE
create table sticker_designs (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,          -- 'M-014'
  size_class    sticker_size not null,
  name          text,
  artwork_group text,
  tags          text[] default '{}',
  auto_tags     text[] default '{}',
  image_path    text,
  thumb_path    text,
  cutout_path   text,                          -- transparent PNG for canvas rendering
  print_w_cm    numeric(5,2),                  -- overrides size-class default
  print_h_cm    numeric(5,2),
  stock_qty     int not null default 0,
  par_level     int not null default 10,
  bin_location  text,                          -- 'Box 2 / Tab M / 011-020'
  unit_cost     numeric(10,2) not null default 0,
  unit_price    numeric(10,2) not null default 0,
  is_active     bool not null default true,
  kiosk_visible bool not null default true,
  created_at    timestamptz default now()
);
create index on sticker_designs (size_class, is_active);
create index on sticker_designs using gin (tags);
create index on sticker_designs using gin (auto_tags);

create table product_skus (
  id           uuid primary key default gen_random_uuid(),
  product_type product_type not null default 'tee',
  color_id     uuid references colors(id),
  fit_id       uuid references fits(id),
  size         product_size not null,
  sku_code     text unique not null,
  stock_qty    int not null default 0,
  par_level    int not null default 5,
  unit_cost    numeric(10,2) not null default 0,
  unit_price   numeric(10,2) not null default 0,
  mockup_front text,                            -- kiosk canvas base image
  mockup_back  text,
  print_area   jsonb,                           -- {front:{x,y,w,h,cm_w,cm_h}, back:{...}}
  is_active    bool not null default true,
  unique (product_type, color_id, fit_id, size)
);

-- PEOPLE
create table volunteers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  commission_rate numeric(5,4) default 0.05,
  is_active bool default true
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone_e164 text,
  email text,
  consent_marketing bool not null default false,
  created_at timestamptz default now()
);
create index on customers (phone_e164);

-- SHIFTS
create table shifts (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  event_name    text,                     -- groups multi-day events
  type          shift_type not null default 'stall',
  venue         text,
  shift_date    date not null default current_date,
  volunteer_ids uuid[] default '{}',
  press_on_site bool not null default true,
  opening_float numeric(10,2) default 0,
  counted_cash  numeric(10,2),
  expected_cash numeric(10,2),
  variance      numeric(10,2),
  notes         text,
  opened_at     timestamptz default now(),
  closed_at     timestamptz
);
create unique index one_open_shift on shifts ((closed_at is null)) where closed_at is null;

create table receipt_blocks (
  id         uuid primary key default gen_random_uuid(),
  shift_id   uuid references shifts(id),
  device_id  text not null,
  fy         text not null,               -- '26-27'
  start_no   int not null,
  end_no     int not null,
  next_no    int not null,
  closed_at  timestamptz,
  unique (fy, start_no)
);

-- ORDERS
create table orders (
  id                 uuid primary key,     -- client-generated, idempotency key
  order_no           int not null default nextval('order_no_seq'),
  receipt_no         text unique,          -- 'CR/26-27/000142'
  shift_id           uuid references shifts(id),
  channel            order_channel not null default 'stall',
  design_ticket      text,                 -- kiosk handoff code, if any
  sold_by            uuid references volunteers(id),
  customer_id        uuid references customers(id),
  subtotal           numeric(10,2) not null default 0,
  discount_amount    numeric(10,2) not null default 0,
  discount_reason    discount_reason,
  discount_note      text,
  total              numeric(10,2) not null default 0,
  cost_total         numeric(10,2) not null default 0,
  manual_override    bool not null default false,
  payment_method     payment_method not null,
  paid_cash          numeric(10,2) default 0,
  paid_upi           numeric(10,2) default 0,
  payment_ref        text,
  fulfillment_status fulfillment not null default 'handed_over',
  promised_date      date,
  pressed_at         timestamptz,
  collected_at       timestamptz,
  affects_inventory  bool not null default true,
  notes              text,
  created_at         timestamptz not null default now(),
  client_created_at  timestamptz,
  device_id          text,
  voided_at          timestamptz,
  voided_by          text,
  void_reason        text
);
create index on orders (shift_id);
create index on orders (created_at desc);
create index on orders (receipt_no);
create index on orders (fulfillment_status) where fulfillment_status <> 'handed_over';

create table order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references orders(id) on delete cascade,
  product_sku_id uuid references product_skus(id),   -- null = sticker-only line
  qty            int not null default 1,
  unit_price     numeric(10,2) not null default 0,
  unit_cost      numeric(10,2) not null default 0,
  line_total     numeric(10,2) not null default 0
);
create index on order_items (order_id);

create table custom_stickers (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,    -- 'C-0001'
  size_class  sticker_size not null,
  description text not null,
  image_path  text,
  unit_price  numeric(10,2) not null default 0,
  order_id    uuid references orders(id),
  created_at  timestamptz default now()
);

create table order_item_stickers (
  id                uuid primary key default gen_random_uuid(),
  order_item_id     uuid not null references order_items(id) on delete cascade,
  sticker_design_id uuid references sticker_designs(id),
  custom_sticker_id uuid references custom_stickers(id),
  side              print_side default 'front',
  pos_x             numeric(6,3),      -- % of print area width
  pos_y             numeric(6,3),
  rotation          numeric(6,2) default 0,
  unit_price        numeric(10,2) not null default 0,
  unit_cost         numeric(10,2) not null default 0,
  check (num_nonnulls(sticker_design_id, custom_sticker_id) = 1)
);
create index on order_item_stickers (order_item_id);

-- KIOSK
create table design_tickets (
  id           uuid primary key default gen_random_uuid(),
  code         text unique not null,      -- 'A7K2'
  device_id    text,
  payload      jsonb not null,            -- full composed cart with placements
  composite_path text,                    -- press sheet PNG
  quoted_total numeric(10,2),
  status       text not null default 'open',  -- open | redeemed | expired
  order_id     uuid references orders(id),
  created_at   timestamptz default now(),
  expires_at   timestamptz not null
);
create index on design_tickets (code) where status = 'open';

create table presets (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  payload     jsonb not null,
  preview_path text,
  sort        int default 0,
  is_active   bool default true
);

-- HOLDS, WASTE, RETURNS
create table holds (
  id             uuid primary key default gen_random_uuid(),
  shift_id       uuid references shifts(id),
  product_sku_id uuid references product_skus(id),
  sticker_id     uuid references sticker_designs(id),
  qty            int not null default 1,
  customer_name  text,
  customer_phone text,
  created_by     uuid references volunteers(id),
  expires_at     timestamptz not null,
  released_at    timestamptz,
  converted_order uuid references orders(id),
  created_at     timestamptz default now()
);

create table waste_log (
  id             uuid primary key default gen_random_uuid(),
  shift_id       uuid references shifts(id),
  sticker_id     uuid references sticker_designs(id),
  sticker_qty    int default 0,
  product_sku_id uuid references product_skus(id),
  product_qty    int default 0,
  reason         waste_reason not null,
  note           text,
  photo_path     text,
  logged_by      uuid references volunteers(id),
  created_at     timestamptz default now()
);

create table returns (
  id              uuid primary key default gen_random_uuid(),
  original_order  uuid references orders(id),
  replacement_order uuid references orders(id),
  reason          text not null,
  action          return_action not null,
  refund_amount   numeric(10,2) default 0,
  restocked       bool default false,
  approved_by     uuid references volunteers(id),
  note            text,
  created_at      timestamptz default now()
);

-- B2B
create table b2b_orders (
  id              uuid primary key default gen_random_uuid(),
  client_org      text not null,
  contact_name    text,
  contact_phone   text,
  contact_email   text,
  account_owner   uuid not null references volunteers(id),
  stage           b2b_stage not null default 'enquiry',
  product_type    product_type default 'tee',
  quantity        int not null default 0,
  size_breakdown  jsonb,
  design_ref      text,
  artwork_path    text,
  unit_price      numeric(10,2) not null default 0,
  unit_cost       numeric(10,2) not null default 0,
  gross_value     numeric(12,2) generated always as (quantity * unit_price) stored,
  deposit_amount  numeric(12,2),
  deposit_date    date,
  deposit_method  payment_method,
  balance_amount  numeric(12,2),
  balance_date    date,
  balance_method  payment_method,
  promised_date   date,
  dispatched_date date,
  affects_inventory bool default false,
  lost_reason     text,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create table b2b_activity (
  id       uuid primary key default gen_random_uuid(),
  b2b_id   uuid references b2b_orders(id) on delete cascade,
  actor    text,
  event    text not null,
  detail   jsonb,
  created_at timestamptz default now()
);

-- LEDGER, SETTINGS, LOGS
create table inventory_movements (
  id         uuid primary key default gen_random_uuid(),
  sku_type   text not null check (sku_type in ('product','sticker')),
  sku_id     uuid not null,
  delta      int not null,
  reason     movement_reason not null,
  ref_order  uuid references orders(id),
  actor      text,
  note       text,
  created_at timestamptz default now()
);
create index on inventory_movements (sku_type, sku_id, created_at desc);

create table settings (key text primary key, value jsonb not null, updated_at timestamptz default now());
create table message_log (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id),
  channel text not null check (channel in ('email','whatsapp')),
  status text not null, error text, sent_at timestamptz,
  created_at timestamptz default now()
);
create table admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor text, action text not null, detail jsonb, created_at timestamptz default now()
);
create table keepalive (id int primary key default 1, pinged_at timestamptz);
```

**Availability view**

```sql
create view product_availability as
select p.*,
  p.stock_qty - coalesce((
    select sum(h.qty) from holds h
    where h.product_sku_id = p.id and h.released_at is null
      and h.converted_order is null and h.expires_at > now()
  ),0) as available_qty
from product_skus p;
```

---

## 9. QR provisions

**Label generation.** From `/admin/catalogue`, generate an A4 PDF sheet of labels: QR encoding `crftd:s:M-014`, the code in Archivo Expanded Black, the thumbnail, and the bin location. Print on sticker paper, one label per transfer sleeve or per folder tab. This is the cheap version and it pays for itself in search time alone.

**Scanning.** Sell and Stock screens expose a camera scan button. Uses the native `BarcodeDetector` API where available (Android Chrome), falls back to a small JS decoder on iOS Safari. Behind a settings flag, default off until you have labels printed.

**Kiosk handoff QR.** Always on. The 4-character code is the fallback, the QR is the fast path.

**Not building:** per-unit serialisation, inventory audit by scan sweep. Both are v3 if volume justifies.

---

## 10. Offline and sync

Unchanged from v1 in principle, with additions for the new device reality (8 devices, mixed Android and iOS, mobile data only).

**Outbox.** Every order, waste entry, return, and hold writes to IndexedDB first with a client UUID and `sync_status = queued`. Serial flush on reconnect. Server insert is idempotent on the UUID.

**iOS caveat.** Safari does not support Background Sync. Flushing must be triggered on `visibilitychange` and on network regain while the app is foregrounded, not on a background event. Practically: a volunteer must open the app for queued sales to sync. The connectivity bar must therefore be unmissable, and shift close must block on a non-empty outbox with a clear "3 sales not yet synced, connect to wifi" message.

**Catalogue cache.** Full sticker and product catalogue plus thumbnails and cutouts in IndexedDB. At 200 designs with cutouts for canvas rendering this is larger than v1 estimated, roughly 15 to 25MB. Acceptable, but cutouts must be aggressively compressed WebP with transparency and must be lazy-cached: the kiosk pre-fetches all of them on wifi at setup, volunteer devices fetch on demand.

**Receipt numbers.** Consumed from the local block, never requested at sale time.

**Design tickets.** Generated locally with a device prefix, synced when possible. A ticket generated offline on the kiosk can still be redeemed offline on the till device if both are on the same local network, which they will not be. Realistic path: the customer shows the QR on the kiosk screen, the volunteer scans it, and the payload travels in the QR itself, not through the server. **Requirement: the QR encodes the full compressed payload, not just a lookup code.** This makes the whole kiosk-to-till flow network-independent. The 4-character code is the online-only fallback.

**Stock display.** `available = server_stock - local queued deltas - active holds`. Converges via Realtime on reconnect.

---

## 11. Design system application

Tokens from the crftd spec, applied per surface.

| Token | Value |
|---|---|
| Blue | `#1F3A93` |
| Near-black | `#111111` |
| Cream | `#F4F0E6` |
| Signal orange | `#E8552A` |
| Display | Anton |
| Labels | Archivo Expanded Black 900 |
| Serif accent | Fraunces 900 italic |
| Body | Chivo |

**Volunteer POS (Sell, Orders, Stock, Restock).** Blue header band with crop marks. Cream background. Anton for numerals, totals, and screen titles. Archivo Expanded Black for field labels and status chips. Chivo for everything else. Signal orange reserved exclusively for destructive and warning states (void, negative stock, overdue collection), which means it must not be used decoratively anywhere in this surface. Minimum tap target 48px. Minimum body size 16px. Contrast ratio 7:1 or better throughout, because these screens get used in direct sunlight.

**Kiosk.** Full brutalist collision layout. Star-bursts, torn-paper tape, box labels, halftone grain. Blue-primary hero. Fraunces italic accent on the "yours" in "Build yours". This is the surface a customer photographs, so it carries the brand load.

**Receipt and shift summary card.** Print-shop treatment: crop marks, blue baseline band, box labels for the totals, halftone on the wordmark. Content brights stay out per your palette discipline.

**Responsive.** Light mode only. Mobile 360 to 480 (volunteer), tablet 768 to 1024 (kiosk, portrait locked), desktop 1280+ (admin). The admin dashboard is desktop-first; nobody reads analytics on a phone.

---

## 12. Security

Three PINs, all hashed with argon2, all verified in a server route, none present in client JavaScript. Success sets a signed httpOnly cookie scoped to the permitted routes. Admin PIN seeds from an environment variable at first deploy and is changeable in-app.

RLS denies anon by default on every table. Anon gets `SELECT` only on `sticker_designs`, `product_skus`, `colors`, `fits`, and `presets`, which is what Realtime stock sync and the kiosk catalogue need and which leaks nothing worse than design codes and stock counts. Everything else routes through server handlers using the service key.

Admin actions (price changes, PIN changes, stock adjustments above a threshold, discount overrides) write to `admin_audit`.

Rate limit: 5 failed PIN attempts per IP per 15 minutes.

**Customer data.** Contact capture stays optional and skippable except where fulfilment requires it. Marketing consent is separate and unticked. Default messaging is transactional only. Your buyers are largely 14 to 19 and India's DPDP Act 2023 has specific provisions for children's data; confirm the current position before any marketing use of this list. Retention: purge customers with no order in 24 months.

---

## 13. Analytics

Everything from v1, plus:

**Kiosk.** Ticket generation rate, ticket-to-sale conversion, average stickers per canvas design versus per till-entered order (tests whether the canvas actually increases attach rate, which is its entire justification), preset versus canvas split, most-used designs in canvas versus most-sold, abandonment rate.

**Fulfilment.** Average and worst press wait. Overdue collections. Collect-later no-show rate.

**Waste.** Waste rate by volunteer and by design. Waste as a percentage of transfers consumed. Cost of waste in rupees, which is the number that will actually change behaviour.

**Returns.** Return rate, by reason, by design, by SKU. A design with a high return rate has a print quality problem.

**Holds.** Conversion rate. Expiry rate.

**B2B.** Pipeline value by stage, committed versus collected, average margin, win rate, days from enquiry to dispatch.

**Headline.** A single "Raised for AquaTerra" figure, net profit after COGS, for the selected period, at the top of the dashboard, on the shift summary card, and on every receipt. This is the number the organisation exists for; it should not require three clicks.

---

## 14. Shift summary card

On shift close, render a crftd-skinned image: shift name and venue, gross, discounts, net, raised for AquaTerra, units sold, top three designs with thumbnails, volunteer leaderboard, cash variance, and the crop-mark frame. Download and native share sheet, formatted for the team WhatsApp group.

Costs half a day and is the single highest-leverage thing for getting volunteers to actually use the tool properly, because it makes their work visible.

---

## 15. Build plan

**Phase 0, half a day.** Supabase project, full schema, RLS, seed colours and fits and 36 tee SKUs, Vercel project, keep-alive cron, env wiring, design tokens and font loading.

**Phase 1, "stall-usable", 4 to 5 days.** PIN gates. Shift open and close with press-mode toggle and receipt blocks. Sell screen complete: product picker, sticker search with bin locations, custom stickers, discount, payment, charge. Receipts with numbering and WhatsApp deep link. Orders list with void and pending queue. Stock pages with CSV and image import. Offline outbox and PWA. Realtime stock. **Gate: run a real stall on this before building anything else.**

**Phase 2, 3 to 4 days.** Design Studio kiosk: presets, canvas with locked scale and bounds and overlap detection, ticket generation with QR payload, till-side redemption. This is the largest single piece and depends on having mockup images and print-area measurements.

**Phase 3, 2 to 3 days.** Restock, print queue, dead stock, waste, returns, holds. Admin analytics and pricing matrix.

**Phase 4, 2 days.** B2B pipeline. Bulk entry. Email via Resend. Message templates. Shift summary card. QR label generation.

**Phase 5, ongoing.** Auto-tagging batch run. Camera scanning. Whatever the first three stalls prove you need.

---

## 16. What I still need

**Blocking Phase 1:**
1. The filled pricing tables in §5, including sticker print sizes in centimetres.
2. Par levels, or confirmation to use defaults of 5 per product SKU and 10 per design.
3. Crop top sizes: do XL and XXL exist?
4. Volunteer list, or I seed with Rachit and Yuthika and you add the rest in-app.
5. Legal name and any registration detail you want on the receipt.
6. Your Instagram handle for the receipt QR.

**Blocking Phase 2 (kiosk):**
7. Tee mockup images, front and back, for each colour and fit. Six to twelve flat product shots on a plain background. Phone photos on a white sheet are fine if they are consistent and square-on.
8. Print area measurements: for each product type and side, the printable rectangle in centimetres and where it sits on the mockup. I can derive this from a photo with a ruler in frame if that is easier.

**Blocking Phase 4:**
9. A verified domain for email, or I drop email and ship WhatsApp-only.

**Not blocking, send when ready:**
10. The 200 designs: cutout PNGs with transparency named by code, plus a CSV of code, name, size class, stock, cost, price, bin location. Cutouts matter more than you might expect; the canvas cannot render a design that has a white box around it.

---

## Appendix A: Pre-stall checklist

1. Keep-alive ping succeeded in the last 24 hours (health line on `/admin`).
2. Every device opened on wifi within the last 24 hours, catalogue sync green.
3. Kiosk pre-fetched all cutouts on wifi. This is the big download; do not do it on mobile data.
4. Physical stock counted and reconciled against the app for the SKUs being carried.
5. Transfer folders in order, bin locations match the app.
6. Shift opened: name, event, venue, press mode set correctly, volunteers selected, opening float entered.
7. Receipt blocks allocated to each device (automatic on shift open, verify the count).
8. One test sale recorded and voided on each device.
9. Kiosk in locked mode, screen timeout disabled, charger connected.
10. Power banks charged. The app survives no network; it does not survive no phone.

## Appendix B: Shift close checklist

1. Pending press queue empty, or every remaining item converted to collect-later with a promised date and a contact.
2. Outbox empty on every device. Do not close with unsynced sales.
3. Waste logged.
4. Cash counted, variance under ₹200 or a note written.
5. Unused receipt numbers voided (automatic).
6. Summary card shared to the team group.
