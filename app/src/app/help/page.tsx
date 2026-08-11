"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PosFrame } from "@/components/PosFrame";
import { TabBar } from "@/components/TabBar";
import { Mono } from "@/components/ui";

/** In-app guide.
 *
 *  Written for the person who will actually use this: a volunteer, often
 *  sixteen, handed a phone five minutes before the stall opens, with a queue
 *  forming and no signal. So:
 *    - every entry is a numbered sequence of physical actions, not a feature tour
 *    - the section that gets read most (something has gone wrong) is near the top
 *    - it works offline, because that is exactly when it is needed
 *    - the two PRD checklists live here rather than in a document nobody
 *      opens at a stall
 */

type Step = { do: string; note?: string };
type Guide = { id: string; title: string; when: string; steps: Step[] };

const GUIDES: Guide[] = [
  {
    id: "first",
    title: "Starting your shift",
    when: "Do this once, when you pick up the phone.",
    steps: [
      { do: "Tap the app. If it asks for a PIN, type the stall PIN.", note: "Ask whoever is running the stall. Five wrong tries locks the phone out for 15 minutes." },
      { do: "If you see “Open shift”, fill in the name and venue and tap OPEN SHIFT.", note: "Only the first phone needs to do this. Everyone else joins the shift automatically." },
      { do: "Check the top-right of the Sell screen says something like “0/100 used”.", note: "That is your receipt number block. If it says NO RECEIPT BLOCK, you cannot charge — reopen the shift on this phone." },
      { do: "Do one test sale and void it from Orders.", note: "Proves the phone can reach the server before a real customer is standing there." },
    ],
  },
  {
    id: "sell",
    title: "Selling a tee",
    when: "The normal sale. Most of your shift is this.",
    steps: [
      { do: "Under ADD GARMENT pick the colour, then the fit, then the size.", note: "The number under each size is how many are left. Greyed out means none left — you can still tap it, but check the box first." },
      { do: "The garment appears in the CART. It now has a blue outline.", note: "That outline means “stickers go on this one”. Tap a different garment to switch." },
      { do: "Find the sticker. Type its number in the search box — “14” finds S-014, M-014 and L-014. “m14” finds only M-014.", note: "Under each result is the bin location, e.g. Box 2 / Tab M. That is where to physically go and get it." },
      { do: "Tap the sticker to add it to the outlined garment.", note: "Repeat for as many stickers as they want." },
      { do: "Pick the payment method: UPI, CASH, SPLIT or PENDING.", note: "SPLIT asks for two amounts that must add up to the total." },
      { do: "Tap CHARGE. Fill in the customer sheet or tap SKIP.", note: "The screen clears straight away — that is normal, the sale is saved even with no signal." },
    ],
  },
  {
    id: "ticket",
    title: "A customer shows you a kiosk code or QR",
    when: "They built a design on the tablet.",
    steps: [
      { do: "At the top of Sell, tap the box that says A7K2." },
      { do: "Scan their QR, or type the 4 characters and tap LOAD.", note: "The QR works with no signal at all. The typed code needs the internet — if you are offline, always scan." },
      { do: "Their whole design appears in the cart with the sticker positions attached.", note: "If you tap LOAD twice it will tell you the ticket is already in the cart. It will not charge them twice." },
      { do: "Charge as normal.", note: "The press sheet showing where each sticker goes appears in Orders for whoever is on the heat press." },
    ],
  },
  {
    id: "wrong",
    title: "Something looks wrong",
    when: "Read this one first when you are stuck.",
    steps: [
      { do: "Red bar saying OFFLINE — keep selling.", note: "Sales are saved on the phone and sent when signal returns. The number next to it is how many are waiting." },
      { do: "Red bar saying CACHED CATALOGUE.", note: "Stock numbers may be out of date because another phone has sold things since. Check the box before promising the last one." },
      { do: "“Item went out of stock during checkout”.", note: "Another phone sold it first. Nothing was charged and no stock moved. Pick a different size or design." },
      { do: "You charged the wrong thing.", note: "Go to Orders, find the receipt number, tap VOID. Stock goes back automatically. The receipt number stays used — that is intentional." },
      { do: "The phone will not charge at all.", note: "Check the top-right for a receipt block. No block means this phone was never given receipt numbers — reopen the shift on it." },
    ],
  },
  {
    id: "custom",
    title: "A sticker they want is not in the list",
    when: "One-off or hand-made transfers.",
    steps: [
      { do: "Tap + CUSTOM STICKER under ADD STICKER." },
      { do: "Pick the size class, describe it, set the price." },
      { do: "It gets its own code automatically, like C-0007.", note: "On a collect-later shift a custom item makes the customer's phone number compulsory — you have to be able to reach them." },
    ],
  },
  {
    id: "close",
    title: "Closing the shift",
    when: "End of the day. Do it in this order.",
    steps: [
      { do: "Clear the pending press queue in Orders, or give every remaining item a promised date and a contact number." },
      { do: "Check every phone shows no OFFLINE or SYNCING bar.", note: "Never close with unsynced sales. That is how sales get lost." },
      { do: "Log any failed presses in Waste.", note: "It feels like admin. It is how we find out which designs press badly." },
      { do: "Count the cash, type it into Orders → CLOSE SHIFT.", note: "Unused receipt numbers are voided automatically." },
      { do: "Share the summary card to the team group." },
    ],
  },
];

const CHECKLISTS: { title: string; note: string; items: string[] }[] = [
  {
    title: "Before the stall opens",
    note: "Do this on wifi, not on mobile data.",
    items: [
      "Every phone opened once on wifi today",
      "Kiosk tablet has loaded the design catalogue",
      "Physical stock counted and matches the app",
      "Transfer folders in order, bin locations match",
      "Shift opened: name, venue, press mode, volunteers, float",
      "Each phone shows its own receipt block",
      "One test sale made and voided on each phone",
      "Kiosk plugged in, screen timeout off",
      "Power banks charged",
    ],
  },
  {
    title: "Before you pack up",
    note: "In this order.",
    items: [
      "Pending press queue empty, or promised dates set",
      "No phone showing unsynced sales",
      "Waste logged",
      "Cash counted, variance under ₹200 or a note written",
      "Shift closed in the app",
      "Summary card shared",
    ],
  },
];

function Disclosure({ guide, startOpen }: { guide: Guide; startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <div id={guide.id} className="border-2 border-ink bg-white scroll-mt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full text-left p-3 flex justify-between items-center gap-3 min-h-[56px] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-signal"
      >
        <span>
          <span className="block font-extrabold text-[15px]">{guide.title}</span>
          <Mono>{guide.when}</Mono>
        </span>
        <span aria-hidden="true" className="font-extrabold text-xl shrink-0">
          {open ? "−" : "+"}
        </span>
      </button>
      {open && (
        <ol className="border-t-2 border-ink">
          {guide.steps.map((s, i) => (
            <li key={i} className="flex gap-3 p-3 border-b border-hairline last:border-b-0">
              <span className="shrink-0 w-7 h-7 bg-ink text-cream font-extrabold text-[13px] flex items-center justify-center">
                {i + 1}
              </span>
              <span className="flex-1">
                <span className="block text-[15px] leading-snug">{s.do}</span>
                {s.note && <span className="block mt-1 text-[13px] text-muted leading-snug">{s.note}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Checklist({ title, note, items }: { title: string; note: string; items: string[] }) {
  // Deliberately not persisted: a checklist that remembers yesterday's ticks
  // is worse than no checklist, because it looks done when it isn't.
  const [done, setDone] = useState<Record<number, boolean>>({});
  const count = Object.values(done).filter(Boolean).length;
  return (
    <div className="border-2 border-ink bg-white">
      <div className="bg-ink text-cream p-2.5 flex justify-between items-baseline gap-2">
        <h3 className="font-extrabold text-[13px] tracking-[0.1em] uppercase">{title}</h3>
        <span className="font-mono text-[12px]">
          {count}/{items.length}
        </span>
      </div>
      <p className="px-3 pt-2 text-[13px] text-muted">{note}</p>
      <ul className="p-3 pt-2 flex flex-col gap-1">
        {items.map((it, i) => (
          <li key={i}>
            <label className="flex items-start gap-2.5 py-1.5 cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                checked={!!done[i]}
                onChange={(e) => setDone((d) => ({ ...d, [i]: e.target.checked }))}
                className="w-6 h-6 shrink-0 mt-0.5 accent-blue"
              />
              <span className={`text-[15px] leading-snug ${done[i] ? "line-through text-muted" : ""}`}>{it}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function HelpPage() {
  // Arriving from a screen's "?" opens that screen's guide directly. Read
  // once on mount; the hash is a starting point, not live state.
  const [topic, setTopic] = useState("");
  useEffect(() => {
    const h = window.location.hash.replace("#", "");
    if (!h) return;
    setTopic(h);
    document.getElementById(h)?.scrollIntoView({ block: "start" });
  }, []);

  return (
    <div className="contents">
      <PosFrame nav={<TabBar />} kicker="STALL OS · HELP" title="How to use this">
        <p className="text-[15px] leading-snug">
          Tap a heading to open the steps. Everything here works with no signal.
        </p>

        <div className="flex flex-col gap-2">
          {GUIDES.map((g) => (
            <Disclosure key={g.id} guide={g} startOpen={g.id === topic} />
          ))}
        </div>

        <h2 className="font-extrabold text-[13px] tracking-[0.14em] uppercase mt-2">Checklists</h2>
        {CHECKLISTS.map((c) => (
          <Checklist key={c.title} {...c} />
        ))}

        <div className="border-2 border-dashed border-hairline p-3">
          <p className="text-[13px] text-muted leading-snug">
            Still stuck? Find whoever is running the stall. Nothing you can tap here loses a sale —
            voids, holds and returns are all reversible and all logged.
          </p>
        </div>

        <Link
          href="/sell"
          className="border-2 border-ink bg-blue text-cream p-3 text-center font-extrabold text-sm min-h-[52px] flex items-center justify-center"
        >
          BACK TO SELLING
        </Link>
      </PosFrame>
    </div>
  );
}
