import Link from "next/link";
import { PosFrame } from "@/components/PosFrame";
import { TabBar } from "@/components/TabBar";

// Labels say what the thing DOES and when you would reach for it. This list
// used to be annotated "Phase 3" / "partial" — build-status notes that tell a
// volunteer nothing about whether they should tap it.
const LINKS = [
  {
    href: "/help",
    label: "How to use this",
    note: "Step-by-step guides and the open/close checklists",
    primary: true,
  },
  { href: "/holds", label: "Holds", note: "Put an item aside for someone coming back" },
  { href: "/waste", label: "Waste log", note: "Record a transfer or blank ruined in the press" },
  { href: "/returns", label: "Returns & exchanges", note: "Take something back against an old receipt" },
  { href: "/admin", label: "Admin", note: "Pricing, analytics and B2B — needs the admin PIN" },
  { href: "/", label: "Customer kiosk", note: "The tablet screen customers design on" },
];

export default function MorePage() {
  return (
    <div className="contents">
      <PosFrame
        helpTopic="first" nav={<TabBar />} kicker="STALL OS · MORE" title="More">
        <div className="flex flex-col gap-2">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`border-2 p-3 flex flex-col gap-0.5 min-h-[64px] justify-center focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-signal ${
                l.primary ? "border-blue bg-blue text-cream" : "border-ink bg-white"
              }`}
            >
              <span className="font-extrabold text-[15px]">{l.label}</span>
              <span
                className={`font-mono text-[12px] leading-snug ${
                  l.primary ? "text-cream/85" : "text-muted"
                }`}
              >
                {l.note}
              </span>
            </Link>
          ))}
        </div>
      </PosFrame>
    </div>
  );
}
