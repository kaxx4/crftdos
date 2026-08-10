import Link from "next/link";
import { PosFrame } from "@/components/PosFrame";
import { TabBar } from "@/components/TabBar";

const LINKS = [
  { href: "/holds", label: "Holds", note: "Phase 3" },
  { href: "/waste", label: "Waste log", note: "Phase 3" },
  { href: "/returns", label: "Returns & exchanges", note: "Phase 3" },
  { href: "/admin", label: "Admin (PIN)", note: "partial" },
  { href: "/kiosk", label: "Kiosk (PIN)", note: "Phase 2" },
];

export default function MorePage() {
  return (
    <div className="min-h-dvh flex flex-col">
      <PosFrame kicker="STALL OS · MORE" title="More">
        <div className="flex flex-col gap-2">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="border-2 border-ink bg-white p-3 flex justify-between items-center font-extrabold text-sm"
            >
              {l.label}
              <span className="font-mono text-[10px] text-muted">{l.note}</span>
            </Link>
          ))}
        </div>
      </PosFrame>
      <TabBar />
    </div>
  );
}
