"use client";
import { Chip } from "@/components/ui";

export function QueueTabs({
  tab,
  setTab,
  pendingCount,
  collectingCount,
}: {
  tab: "press" | "collections";
  setTab: (t: "press" | "collections") => void;
  pendingCount: number;
  collectingCount: number;
}) {
  if (pendingCount === 0 && collectingCount === 0) return null;
  return (
    <div className="flex gap-2" role="tablist" aria-label="Press and collection queues">
      <Chip role="tab" aria-selected={tab === "press"} active={tab === "press"} onClick={() => setTab("press")}>
        PRESS QUEUE{pendingCount ? ` · ${pendingCount}` : ""}
      </Chip>
      <Chip
        role="tab"
        aria-selected={tab === "collections"}
        active={tab === "collections"}
        onClick={() => setTab("collections")}
      >
        COLLECTIONS{collectingCount ? ` · ${collectingCount}` : ""}
      </Chip>
    </div>
  );
}
